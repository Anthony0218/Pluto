import { useEffect, useMemo, useRef, useState } from "react";

import { Chess, type Color, type PieceSymbol, type Square } from "chess.js";

import Board from "./Board";

import { useStockfishAnalysis } from "@/hooks/useStockfishAnalysis";

import {
  reviewGameMoves,
  type MoveQuality,
  type MoveReview,
} from "@/utils/chessAnalysis";

type Props = {
  moves: string[];
  orientation?: "white" | "black";
  open: boolean;
  onClose: () => void;
};

type SideFilter = "all" | "w" | "b";
type PieceFilter = "all" | PieceSymbol;
type QualityFilter = "all" | MoveQuality;
type MoveTypeFilter =
  | "all"
  | "capture"
  | "check"
  | "checkmate"
  | "castle"
  | "promotion"
  | "pawn"
  | "quiet";
type GamePhase = "Opening" | "Middlegame" | "Endgame";
type PhaseFilter = "all" | GamePhase;
type SortKey = "move" | "side" | "piece" | "quality" | "loss";
type SortDirection = "asc" | "desc";
type ReviewPreset =
  | "all"
  | "mistakes"
  | "critical"
  | "blunders"
  | "best"
  | "captures"
  | "checks";

type MoveTag = Exclude<MoveTypeFilter, "all">;

type EnrichedReviewRow = {
  review: MoveReview;
  pieceType: PieceSymbol | null;
  moveTags: MoveTag[];
  phase: GamePhase;
  capturedPiece: PieceSymbol | null;
  materialGain: number;
  promotionGain: number;
  evalBeforeWhite: number | null;
  evalAfterWhite: number | null;
  moverEvalBefore: number | null;
  moverEvalAfter: number | null;
  evalSwing: number | null;
  critical: boolean;
  criticalLabel: string | null;
  missedOpportunity: string | null;
};

type SideSummary = {
  color: "w" | "b";
  moves: number;
  acpl: number;
  appAccuracy: number;
  critical: number;
  counts: Record<MoveQuality, number>;
  goodOrBetterPercent: number;
};

type PiecePerformanceRow = {
  piece: PieceSymbol;
  moves: number;
  acpl: number;
  best: number;
  mistakes: number;
};

type PhasePerformanceRow = {
  phase: GamePhase;
  moves: number;
  acpl: number;
  goodOrBetterPercent: number;
};

type ContinuationState = {
  evaluation: string;
  moves: string[];
};

type AnalysisLineLike = {
  scoreCp: number | null;
  mate: number | null;
  pv: string[];
};

const pieceSymbols: Record<Color, Record<PieceSymbol, string>> = {
  w: {
    p: "♙",
    n: "♘",
    b: "♗",
    r: "♖",
    q: "♕",
    k: "♔",
  },
  b: {
    p: "♟",
    n: "♞",
    b: "♝",
    r: "♜",
    q: "♛",
    k: "♚",
  },
};

const pieceNames: Record<PieceSymbol, string> = {
  p: "Pawn",
  n: "Knight",
  b: "Bishop",
  r: "Rook",
  q: "Queen",
  k: "King",
};

const pieceValues: Record<PieceSymbol, number> = {
  p: 1,
  n: 3,
  b: 3,
  r: 5,
  q: 9,
  k: 0,
};

const pieceSortOrder: Record<PieceSymbol, number> = {
  p: 0,
  n: 1,
  b: 2,
  r: 3,
  q: 4,
  k: 5,
};

const qualitySortOrder: Record<MoveQuality, number> = {
  Best: 0,
  Excellent: 1,
  Good: 2,
  Inaccuracy: 3,
  Mistake: 4,
  Blunder: 5,
};

const qualityList: MoveQuality[] = [
  "Best",
  "Excellent",
  "Good",
  "Inaccuracy",
  "Mistake",
  "Blunder",
];

const phaseList: GamePhase[] = ["Opening", "Middlegame", "Endgame"];

const presetOptions: Array<{
  key: ReviewPreset;
  label: string;
}> = [
  { key: "all", label: "All Moves" },
  { key: "mistakes", label: "Mistakes" },
  { key: "critical", label: "Critical" },
  { key: "blunders", label: "Blunders" },
  { key: "best", label: "Best Moves" },
  { key: "captures", label: "Captures" },
  { key: "checks", label: "Checks" },
];

export default function ChessGameReview({
  moves,
  orientation = "white",
  open,
  onClose,
}: Props) {
  const { ready, analyzing, analyzePosition } = useStockfishAnalysis();

  const [reviews, setReviews] = useState<MoveReview[]>([]);
  const [selectedPly, setSelectedPly] = useState(0);
  const [highlightedBestMove, setHighlightedBestMove] = useState<string | null>(
    null,
  );
  const [reviewing, setReviewing] = useState(false);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [detailsOpen, setDetailsOpen] = useState(false);

  const [sideFilter, setSideFilter] = useState<SideFilter>("all");
  const [pieceFilter, setPieceFilter] = useState<PieceFilter>("all");
  const [qualityFilter, setQualityFilter] = useState<QualityFilter>("all");
  const [moveTypeFilter, setMoveTypeFilter] = useState<MoveTypeFilter>("all");
  const [phaseFilter, setPhaseFilter] = useState<PhaseFilter>("all");
  const [activePreset, setActivePreset] = useState<ReviewPreset>("all");
  const [sortKey, setSortKey] = useState<SortKey>("move");
  const [sortDirection, setSortDirection] = useState<SortDirection>("asc");

  const [continuation, setContinuation] = useState<ContinuationState | null>(
    null,
  );
  const [continuationLoading, setContinuationLoading] = useState(false);
  const [continuationError, setContinuationError] = useState<string | null>(
    null,
  );
  const continuationGenerationRef = useRef(0);

  const movesKey = moves.join("|");

  useEffect(() => {
    continuationGenerationRef.current += 1;

    setReviews([]);
    setDetailsOpen(false);
    setSelectedPly(0);
    setHighlightedBestMove(null);
    setProgress(0);
    setError(null);

    setSideFilter("all");
    setPieceFilter("all");
    setQualityFilter("all");
    setMoveTypeFilter("all");
    setPhaseFilter("all");
    setActivePreset("all");
    setSortKey("move");
    setSortDirection("asc");

    setContinuation(null);
    setContinuationLoading(false);
    setContinuationError(null);
  }, [movesKey]);

  useEffect(() => {
    if (open) {
      setDetailsOpen(false);
      setSideFilter("all");
      setPieceFilter("all");
      setQualityFilter("all");
      setMoveTypeFilter("all");
      setPhaseFilter("all");
      setActivePreset("all");
      setSortKey("move");
      setSortDirection("asc");
    }
  }, [open]);

  async function runReview() {
    if (reviewing || !ready || moves.length === 0) {
      return;
    }

    setReviewing(true);
    setProgress(0);
    setError(null);

    try {
      const result = await reviewGameMoves(
        moves,
        analyzePosition,
        (completed) => {
          setProgress(completed);
        },
      );

      setReviews(result);
      setSelectedPly(result.length);
      setHighlightedBestMove(null);
    } catch (reviewError) {
      console.error(reviewError);
      setError("Game review failed.");
    } finally {
      setReviewing(false);
    }
  }

  const selected = selectedPly > 0 ? reviews[selectedPly - 1] : null;

  /* =======================================================
     ENRICH REVIEW DATA
     ======================================================= */

  const reviewRows = useMemo<EnrichedReviewRow[]>(() => {
    return reviews.map((review, index) => {
      const moveInfo = getMoveInfo(review);
      const phase = getGamePhase(review.fenBefore, review.moveNumber);

      const beforeSideEval = parseEvaluation(
        review.bestMoves[0]?.evaluation ?? null,
      );

      const evalBeforeWhite =
        beforeSideEval === null
          ? null
          : review.color === "w"
            ? beforeSideEval
            : -beforeSideEval;

      const nextReview = reviews[index + 1];

      let evalAfterWhite: number | null = null;

      if (nextReview) {
        const nextSideEval = parseEvaluation(
          nextReview.bestMoves[0]?.evaluation ?? null,
        );

        if (nextSideEval !== null) {
          evalAfterWhite =
            nextReview.color === "w" ? nextSideEval : -nextSideEval;
        }
      } else {
        evalAfterWhite = terminalEvaluationWhite(review.fenAfter);
      }

      const moverSign = review.color === "w" ? 1 : -1;

      /*
       * A resignation can end a multiplayer game while the final
       * FEN itself is not a chess.js terminal position. In that case
       * derive the final plotted value from the already-computed
       * centipawn loss instead of launching another engine analysis.
       */
      if (evalAfterWhite === null && evalBeforeWhite !== null) {
        const beforeForMover = evalBeforeWhite * moverSign;
        const afterForMover = beforeForMover - review.centipawnLoss / 100;
        evalAfterWhite = Math.max(-10, Math.min(10, afterForMover)) * moverSign;
      }

      const moverEvalBefore =
        evalBeforeWhite === null ? null : evalBeforeWhite * moverSign;
      const moverEvalAfter =
        evalAfterWhite === null ? null : evalAfterWhite * moverSign;

      const evalSwing =
        evalBeforeWhite !== null && evalAfterWhite !== null
          ? evalAfterWhite - evalBeforeWhite
          : null;

      const critical =
        review.quality === "Mistake" ||
        review.quality === "Blunder" ||
        review.centipawnLoss >= 120;

      const criticalLabel = classifyCriticalMoment(
        review,
        moverEvalBefore,
        moverEvalAfter,
      );

      const missedOpportunity = classifyMissedOpportunity(
        review,
        moverEvalBefore,
        moverEvalAfter,
      );

      return {
        review,
        pieceType: moveInfo.pieceType,
        moveTags: moveInfo.tags,
        phase,
        capturedPiece: moveInfo.capturedPiece,
        materialGain: moveInfo.materialGain,
        promotionGain: moveInfo.promotionGain,
        evalBeforeWhite,
        evalAfterWhite,
        moverEvalBefore,
        moverEvalAfter,
        evalSwing,
        critical,
        criticalLabel,
        missedOpportunity,
      };
    });
  }, [reviews]);

  const selectedRow =
    selectedPly > 0
      ? reviewRows.find((row) => row.review.ply === selectedPly)
      : null;

  /* =======================================================
     SUMMARY DATA
     ======================================================= */

  const whiteSummary = useMemo(
    () => buildSideSummary(reviewRows, "w"),
    [reviewRows],
  );

  const blackSummary = useMemo(
    () => buildSideSummary(reviewRows, "b"),
    [reviewRows],
  );

  const totalCritical = reviewRows.filter((row) => row.critical).length;
  const totalBlunders = reviewRows.filter(
    (row) => row.review.quality === "Blunder",
  ).length;

  const piecePerformance = useMemo(
    () => buildPiecePerformance(reviewRows),
    [reviewRows],
  );

  const phasePerformance = useMemo(
    () => buildPhasePerformance(reviewRows),
    [reviewRows],
  );

  const criticalRows = useMemo(
    () => reviewRows.filter((row) => row.critical),
    [reviewRows],
  );

  const bestRow = useMemo(() => {
    const bestMoves = reviewRows.filter((row) => row.review.quality === "Best");

    if (bestMoves.length > 0) {
      return [...bestMoves].sort(
        (a, b) => a.review.centipawnLoss - b.review.centipawnLoss,
      )[0];
    }

    return [...reviewRows].sort(
      (a, b) => a.review.centipawnLoss - b.review.centipawnLoss,
    )[0];
  }, [reviewRows]);

  const worstRow = useMemo(() => {
    return [...reviewRows].sort(
      (a, b) => b.review.centipawnLoss - a.review.centipawnLoss,
    )[0];
  }, [reviewRows]);

  const biggestSwingRow = useMemo(() => {
    return [...reviewRows]
      .filter((row) => row.evalSwing !== null)
      .sort(
        (a, b) => Math.abs(b.evalSwing ?? 0) - Math.abs(a.evalSwing ?? 0),
      )[0];
  }, [reviewRows]);

  /* =======================================================
     BOARD POSITION
     ======================================================= */

  const reviewChess = useMemo(() => {
    if (!selected) {
      return new Chess();
    }

    if (highlightedBestMove) {
      return new Chess(selected.fenBefore);
    }

    return new Chess(selected.fenAfter);
  }, [selected, highlightedBestMove]);

  const board = reviewChess.board();

  const alternativeMove = highlightedBestMove
    ? {
        from: highlightedBestMove.slice(0, 2) as Square,
        to: highlightedBestMove.slice(2, 4) as Square,
      }
    : null;

  const playedMove = selected
    ? {
        from: selected.from,
        to: selected.to,
      }
    : null;

  const checkedKingSquare: Square | null = reviewChess.isCheck()
    ? (() => {
        const kingColor = reviewChess.turn();

        for (let row = 0; row < 8; row++) {
          for (let column = 0; column < 8; column++) {
            const piece = board[row][column];

            if (piece?.type === "k" && piece.color === kingColor) {
              return `${"abcdefgh"[column]}${8 - row}` as Square;
            }
          }
        }

        return null;
      })()
    : null;

  /* =======================================================
     FILTERING / SORTING
     ======================================================= */

  const filteredReviews = useMemo(() => {
    const filtered = reviewRows.filter((row) => {
      const { review, pieceType, moveTags, phase, critical } = row;

      if (sideFilter !== "all" && review.color !== sideFilter) {
        return false;
      }

      if (pieceFilter !== "all" && pieceType !== pieceFilter) {
        return false;
      }

      if (qualityFilter !== "all" && review.quality !== qualityFilter) {
        return false;
      }

      if (moveTypeFilter !== "all" && !moveTags.includes(moveTypeFilter)) {
        return false;
      }

      if (phaseFilter !== "all" && phase !== phaseFilter) {
        return false;
      }

      switch (activePreset) {
        case "mistakes":
          if (review.quality !== "Mistake" && review.quality !== "Blunder") {
            return false;
          }
          break;

        case "critical":
          if (!critical) {
            return false;
          }
          break;

        case "blunders":
          if (review.quality !== "Blunder") {
            return false;
          }
          break;

        case "best":
          if (review.quality !== "Best") {
            return false;
          }
          break;

        case "captures":
          if (!moveTags.includes("capture")) {
            return false;
          }
          break;

        case "checks":
          if (!moveTags.includes("check") && !moveTags.includes("checkmate")) {
            return false;
          }
          break;
      }

      return true;
    });

    return [...filtered].sort((a, b) => {
      let result = 0;

      switch (sortKey) {
        case "move":
          result = a.review.ply - b.review.ply;
          break;

        case "side": {
          const sideA = a.review.color === "w" ? 0 : 1;
          const sideB = b.review.color === "w" ? 0 : 1;
          result = sideA - sideB;
          break;
        }

        case "piece":
          result =
            (a.pieceType ? pieceSortOrder[a.pieceType] : 99) -
            (b.pieceType ? pieceSortOrder[b.pieceType] : 99);
          break;

        case "quality":
          result =
            qualitySortOrder[a.review.quality] -
            qualitySortOrder[b.review.quality];
          break;

        case "loss":
          result = a.review.centipawnLoss - b.review.centipawnLoss;
          break;
      }

      if (result === 0) {
        result = a.review.ply - b.review.ply;
      }

      return sortDirection === "asc" ? result : -result;
    });
  }, [
    reviewRows,
    sideFilter,
    pieceFilter,
    qualityFilter,
    moveTypeFilter,
    phaseFilter,
    activePreset,
    sortKey,
    sortDirection,
  ]);

  function changeSort(key: SortKey) {
    if (sortKey === key) {
      setSortDirection((current) => (current === "asc" ? "desc" : "asc"));
      return;
    }

    setSortKey(key);
    setSortDirection("asc");
  }

  function resetFilters() {
    setSideFilter("all");
    setPieceFilter("all");
    setQualityFilter("all");
    setMoveTypeFilter("all");
    setPhaseFilter("all");
    setActivePreset("all");
    setSortKey("move");
    setSortDirection("asc");
  }

  function selectReviewMove(ply: number) {
    continuationGenerationRef.current += 1;

    setSelectedPly(ply);
    setHighlightedBestMove(null);
    setContinuation(null);
    setContinuationLoading(false);
    setContinuationError(null);
  }

  function showSimpleReview() {
    setDetailsOpen(false);

    if (sortKey === "loss") {
      setSortKey("move");
      setSortDirection("asc");
    }
  }

  function selectRelativeCritical(direction: -1 | 1) {
    if (criticalRows.length === 0) {
      return;
    }

    if (direction === 1) {
      const next = criticalRows.find((row) => row.review.ply > selectedPly);
      selectReviewMove(next?.review.ply ?? criticalRows[0].review.ply);
      return;
    }

    const previous = [...criticalRows]
      .reverse()
      .find((row) => row.review.ply < selectedPly);

    selectReviewMove(
      previous?.review.ply ?? criticalRows[criticalRows.length - 1].review.ply,
    );
  }

  /* =======================================================
     SELECTED POSITION CONTINUATION
     ======================================================= */

  async function loadContinuation() {
    if (!selected || continuationLoading || analyzing || reviewing || !ready) {
      return;
    }

    const generation = ++continuationGenerationRef.current;

    setContinuationLoading(true);
    setContinuation(null);
    setContinuationError(null);

    try {
      const lines = await analyzePosition(selected.fenBefore, {
        multiPV: 1,
        moveTime: 700,
      });

      if (generation !== continuationGenerationRef.current) {
        return;
      }

      const line = lines[0] as AnalysisLineLike | undefined;

      if (!line || line.pv.length === 0) {
        setContinuationError("No continuation was returned for this position.");
        return;
      }

      setContinuation({
        evaluation: formatAnalysisEvaluation(line),
        moves: pvToSan(selected.fenBefore, line.pv.slice(0, 8)),
      });
    } catch (continuationFailure) {
      console.error(continuationFailure);

      if (generation === continuationGenerationRef.current) {
        setContinuationError("Continuation analysis failed.");
      }
    } finally {
      if (generation === continuationGenerationRef.current) {
        setContinuationLoading(false);
      }
    }
  }

  function renderMoveReviewPanel(showLoss: boolean) {
    return (
      <aside className="flex h-full min-h-0 flex-col overflow-hidden rounded-2xl border border-white/10 bg-zinc-900">
        <div className="shrink-0 border-b border-white/10 px-3 py-2.5">
          <div className="flex items-center justify-between gap-3">
            <div>
              <h3 className="text-sm font-bold">Move Review</h3>
              <p className="mt-0.5 text-[10px] text-zinc-500">
                Filter, sort and inspect moves
              </p>
            </div>

            <span className="rounded-full bg-white/5 px-2 py-0.5 text-[9px] font-bold text-zinc-500">
              {filteredReviews.length}/{reviews.length}
            </span>
          </div>

          {/* QUICK PRESETS */}

          <div className="mt-2 flex flex-wrap gap-1">
            {presetOptions.map((preset) => (
              <button
                key={preset.key}
                type="button"
                onClick={() => setActivePreset(preset.key)}
                className={`rounded-md border px-1.5 py-0.5 text-[8px] font-bold transition ${
                  activePreset === preset.key
                    ? "border-amber-400/30 bg-amber-400/10 text-amber-300"
                    : "border-white/5 bg-black/20 text-zinc-500 hover:bg-white/5"
                }`}
              >
                {preset.label}
              </button>
            ))}
          </div>

          {/* COMPACT FILTERS */}

          <div className="mt-2 grid grid-cols-3 gap-1.5">
            <FilterSelect
              label="Side"
              value={sideFilter}
              onChange={(value) => setSideFilter(value as SideFilter)}
              options={[
                ["all", "All"],
                ["w", "White"],
                ["b", "Black"],
              ]}
            />

            <FilterSelect
              label="Figure"
              value={pieceFilter}
              onChange={(value) => setPieceFilter(value as PieceFilter)}
              options={[
                ["all", "All"],
                ["p", "Pawn"],
                ["n", "Knight"],
                ["b", "Bishop"],
                ["r", "Rook"],
                ["q", "Queen"],
                ["k", "King"],
              ]}
            />

            <FilterSelect
              label="Review"
              value={qualityFilter}
              onChange={(value) => setQualityFilter(value as QualityFilter)}
              options={[
                ["all", "All"],
                ...qualityList.map(
                  (quality) => [quality, quality] as [string, string],
                ),
              ]}
            />

            <FilterSelect
              label="Move Type"
              value={moveTypeFilter}
              onChange={(value) => setMoveTypeFilter(value as MoveTypeFilter)}
              options={[
                ["all", "All"],
                ["capture", "Capture"],
                ["check", "Check"],
                ["checkmate", "Checkmate"],
                ["castle", "Castle"],
                ["promotion", "Promotion"],
                ["pawn", "Pawn Move"],
                ["quiet", "Quiet Move"],
              ]}
            />

            <FilterSelect
              label="Phase"
              value={phaseFilter}
              onChange={(value) => setPhaseFilter(value as PhaseFilter)}
              options={[
                ["all", "All"],
                ["Opening", "Opening"],
                ["Middlegame", "Middlegame"],
                ["Endgame", "Endgame"],
              ]}
            />

            <div className="flex items-end">
              <button
                type="button"
                onClick={resetFilters}
                className="w-full rounded-lg border border-white/10 bg-white/5 px-1.5 py-1.5 text-[9px] font-bold text-zinc-400 transition hover:bg-white/10 hover:text-white"
              >
                Reset
              </button>
            </div>
          </div>
        </div>

        {/* TABLE */}

        <div className="min-h-0 flex-1 overflow-y-auto">
          <table className="w-full border-collapse text-left">
            <thead className="sticky top-0 z-10 bg-zinc-900">
              <tr className="border-b border-white/5 text-[8px] font-black uppercase tracking-wider text-zinc-600">
                <SortableHeader
                  label="#"
                  active={sortKey === "move"}
                  direction={sortDirection}
                  onClick={() => changeSort("move")}
                  className="px-2"
                />

                <SortableHeader
                  label="Side"
                  active={sortKey === "side"}
                  direction={sortDirection}
                  onClick={() => changeSort("side")}
                />

                <SortableHeader
                  label="Figure"
                  active={sortKey === "piece"}
                  direction={sortDirection}
                  onClick={() => changeSort("piece")}
                />

                <th className="px-1.5 py-2">Played</th>

                <SortableHeader
                  label="Review"
                  active={sortKey === "quality"}
                  direction={sortDirection}
                  onClick={() => changeSort("quality")}
                />

                {showLoss && (
                  <SortableHeader
                    label="Loss"
                    active={sortKey === "loss"}
                    direction={sortDirection}
                    onClick={() => changeSort("loss")}
                  />
                )}
              </tr>
            </thead>

            <tbody>
              {filteredReviews.length === 0 ? (
                <tr>
                  <td
                    colSpan={showLoss ? 6 : 5}
                    className="px-4 py-8 text-center"
                  >
                    <div className="text-2xl text-zinc-700">♟</div>

                    <p className="mt-2 text-[10px] font-semibold text-zinc-500">
                      No matching moves
                    </p>

                    <button
                      type="button"
                      onClick={resetFilters}
                      className="mt-2 text-[10px] font-bold text-amber-300 hover:text-amber-200"
                    >
                      Clear filters
                    </button>
                  </td>
                </tr>
              ) : (
                filteredReviews.map((row) => {
                  const { review, pieceType } = row;

                  return (
                    <tr
                      key={review.ply}
                      onClick={() => selectReviewMove(review.ply)}
                      className={`cursor-pointer border-b border-white/5 transition last:border-0 ${
                        selectedPly === review.ply
                          ? "bg-amber-400/[0.08]"
                          : "hover:bg-white/[0.04]"
                      }`}
                    >
                      <td className="px-2 py-2 text-[10px] text-zinc-600">
                        {review.moveNumber}
                        {review.color === "w" ? "." : "..."}
                      </td>

                      <td className="px-1.5 py-2">
                        <CompactSideBadge color={review.color} />
                      </td>

                      <td className="px-1.5 py-2">
                        {pieceType ? (
                          <div className="flex items-center gap-1">
                            <span className="w-5 text-center text-lg leading-none">
                              {pieceSymbols[review.color][pieceType]}
                            </span>

                            <span className="hidden text-[8px] text-zinc-600 2xl:inline">
                              {pieceNames[pieceType]}
                            </span>
                          </div>
                        ) : (
                          <span className="text-zinc-700">·</span>
                        )}
                      </td>

                      <td className="px-1.5 py-2">
                        <p className="font-mono text-xs font-bold text-zinc-200">
                          {review.san}
                        </p>

                        <div className="mt-0.5 flex flex-wrap gap-1">
                          <span className="text-[7px] text-zinc-600">
                            {row.phase}
                          </span>

                          {row.moveTags.slice(0, 2).map((tag) => (
                            <span
                              key={tag}
                              className="text-[7px] text-zinc-700"
                            >
                              · {formatMoveTag(tag)}
                            </span>
                          ))}
                        </div>
                      </td>

                      <td className="px-1.5 py-2">
                        <QualityBadge quality={review.quality} />
                      </td>

                      {showLoss && (
                        <td className="px-1.5 py-2 text-[9px] font-bold text-zinc-500">
                          {(review.centipawnLoss / 100).toFixed(2)}
                        </td>
                      )}
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </aside>
    );
  }

  if (!open) {
    return null;
  }

  const selectedSidePiecePerformance = selected
    ? piecePerformance[selected.color]
    : [];

  const selectedSidePhasePerformance = selected
    ? phasePerformance[selected.color]
    : [];

  return (
    <div
      className="
        fixed
        inset-0
        z-[100]
        flex
        items-center
        justify-center
        bg-black/80
        p-3
        backdrop-blur-md
        sm:p-5
      "
    >
      <div
        className="
          flex
          h-[94vh]
          w-full
          max-w-[1800px]
          flex-col
          overflow-hidden
          rounded-3xl
          border
          border-white/10
          bg-zinc-950
          shadow-2xl
          shadow-black/60
        "
      >
        {/* HEADER */}

        <header className="flex shrink-0 items-center justify-between border-b border-white/10 bg-zinc-900/90 px-5 py-3">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-amber-400/10 text-2xl text-amber-200">
              ♞
            </div>

            <div>
              <p className="text-[9px] font-black uppercase tracking-[0.25em] text-amber-400">
                Stockfish
              </p>

              <h2 className="text-lg font-black text-white">Game Review</h2>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {reviews.length > 0 && (
              <button
                type="button"
                onClick={() => {
                  if (detailsOpen) {
                    showSimpleReview();
                  } else {
                    setDetailsOpen(true);
                  }
                }}
                className={`rounded-xl border px-3 py-2 text-xs font-black transition ${
                  detailsOpen
                    ? "border-amber-400/30 bg-amber-400/10 text-amber-300 hover:bg-amber-400/15"
                    : "border-white/10 bg-white/5 text-zinc-300 hover:bg-white/10 hover:text-white"
                }`}
              >
                {detailsOpen ? "← Simple" : "Details"}
              </button>
            )}

            <button
              type="button"
              onClick={onClose}
              className="flex h-9 w-9 items-center justify-center rounded-xl border border-white/10 bg-white/5 text-xl text-zinc-400 transition hover:bg-white/10 hover:text-white"
            >
              ×
            </button>
          </div>
        </header>

        {/* BEFORE ANALYSIS */}

        {reviews.length === 0 ? (
          <div className="flex min-h-0 flex-1 items-center justify-center overflow-y-auto p-8">
            <div className="max-w-md text-center">
              <div className="text-6xl">♞</div>

              <h3 className="mt-5 text-2xl font-black">Analyse this game</h3>

              <p className="mt-3 text-sm leading-6 text-zinc-500">
                Every move will be evaluated together with Stockfish's three
                best alternatives.
              </p>

              {error && <p className="mt-4 text-sm text-red-300">{error}</p>}

              <button
                type="button"
                disabled={
                  !ready || reviewing || analyzing || moves.length === 0
                }
                onClick={runReview}
                className="mt-7 rounded-xl bg-amber-400 px-7 py-3 font-black text-zinc-950 transition hover:bg-amber-300 disabled:opacity-40"
              >
                {reviewing
                  ? `Analyzing ${progress}/${moves.length}`
                  : "Analyse Game"}
              </button>
            </div>
          </div>
        ) : detailsOpen ? (
          <div className="grid min-h-0 flex-1 gap-4 overflow-hidden p-4 xl:grid-cols-[320px_minmax(500px,1fr)_540px]">
            {/* ===============================================
                LEFT — WHITE SUMMARY + EDUCATIONAL DETAILS
               =============================================== */}

            <div className="flex min-h-0 flex-col gap-3">
              <SideSummaryCard summary={whiteSummary} />

              {/* ===============================================
                    LEFT SIDEBAR — EDUCATIONAL DETAILS
                   =============================================== */}

              <aside className="min-h-0 flex-1 overflow-y-auto rounded-2xl border border-white/10 bg-zinc-900/75 p-4">
                {selected && selectedRow && (
                  <>
                    <p className="text-[10px] font-black uppercase tracking-widest text-zinc-500">
                      Current Move
                    </p>

                    <div className="mt-3 flex items-start justify-between gap-3">
                      <div>
                        <SideBadge color={selected.color} />

                        <div className="mt-3 flex items-center gap-2">
                          <MovePiece review={selected} />

                          <span className="font-mono text-2xl font-black">
                            {selected.san}
                          </span>
                        </div>
                      </div>

                      <QualityBadge quality={selected.quality} />
                    </div>

                    <div className="mt-3 flex flex-wrap gap-1.5">
                      <PhaseBadge phase={selectedRow.phase} />

                      {selectedRow.moveTags.map((tag) => (
                        <MoveTagBadge key={tag} tag={tag} />
                      ))}
                    </div>

                    {/* EVALUATION */}

                    <div className="mt-4 grid grid-cols-2 gap-2">
                      <EvaluationCard
                        title="Before"
                        evaluation={selectedRow.evalBeforeWhite}
                      />

                      <EvaluationCard
                        title="After"
                        evaluation={selectedRow.evalAfterWhite}
                      />
                    </div>

                    <div className="mt-2 rounded-xl bg-black/20 p-3">
                      <div className="flex items-center justify-between gap-3">
                        <span className="text-xs text-zinc-500">
                          Evaluation loss
                        </span>

                        <strong className="text-sm text-zinc-200">
                          {(selected.centipawnLoss / 100).toFixed(2)} pawns
                        </strong>
                      </div>

                      {selectedRow.criticalLabel && (
                        <div className="mt-2 rounded-lg border border-orange-400/20 bg-orange-400/[0.07] px-2.5 py-2 text-xs font-bold text-orange-300">
                          ⚠ {selectedRow.criticalLabel}
                        </div>
                      )}

                      {selectedRow.missedOpportunity && (
                        <p className="mt-2 text-xs leading-5 text-zinc-400">
                          {selectedRow.missedOpportunity}
                        </p>
                      )}
                    </div>

                    {/* EDUCATIONAL EXPLANATION */}

                    <div className="mt-5">
                      <p className="text-[10px] font-black uppercase tracking-widest text-zinc-500">
                        What happened?
                      </p>

                      <div className="mt-2 space-y-2 rounded-xl border border-white/5 bg-black/20 p-3">
                        {buildEducationBullets(selectedRow).map(
                          (bullet, index) => (
                            <div
                              key={`${bullet}-${index}`}
                              className="flex gap-2 text-xs leading-5"
                            >
                              <span className="mt-0.5 text-amber-400">•</span>
                              <span className="text-zinc-400">{bullet}</span>
                            </div>
                          ),
                        )}
                      </div>
                    </div>

                    {/* MATERIAL */}

                    {(selectedRow.capturedPiece ||
                      selectedRow.promotionGain > 0) && (
                      <div className="mt-4 rounded-xl border border-white/5 bg-black/20 p-3">
                        <p className="text-[9px] font-black uppercase tracking-wider text-zinc-600">
                          Material Change
                        </p>

                        {selectedRow.capturedPiece && (
                          <p className="mt-2 text-xs text-zinc-300">
                            Captured {pieceNames[selectedRow.capturedPiece]} (+
                            {selectedRow.materialGain})
                          </p>
                        )}

                        {selectedRow.promotionGain > 0 && (
                          <p className="mt-1 text-xs text-zinc-300">
                            Promotion gain +{selectedRow.promotionGain}
                          </p>
                        )}
                      </div>
                    )}

                    {/* PLAYED MOVE */}

                    <button
                      type="button"
                      onClick={() => setHighlightedBestMove(null)}
                      className={`
                          mt-5
                          flex
                          w-full
                          items-center
                          justify-between
                          rounded-xl
                          border
                          px-3
                          py-3
                          text-left
                          transition

                          ${
                            highlightedBestMove === null
                              ? "border-blue-400/30 bg-blue-400/10"
                              : "border-white/5 bg-black/20 hover:bg-white/5"
                          }
                        `}
                    >
                      <div>
                        <p className="text-[9px] font-black uppercase tracking-wider text-zinc-500">
                          Played
                        </p>

                        <p className="mt-1 font-mono font-bold">
                          {selected.san}
                        </p>
                      </div>

                      <span className="text-lg">↪</span>
                    </button>

                    {/* TOP 3 */}

                    <div className="mt-5">
                      <p className="text-[10px] font-black uppercase tracking-widest text-amber-400">
                        Best Alternatives
                      </p>

                      <div className="mt-3 space-y-2">
                        {selected.bestMoves.map((suggestion, index) => {
                          const active = highlightedBestMove === suggestion.uci;

                          return (
                            <button
                              key={`${suggestion.uci}-${index}`}
                              type="button"
                              onClick={() =>
                                setHighlightedBestMove(suggestion.uci)
                              }
                              className={`
                                  flex
                                  w-full
                                  items-center
                                  justify-between
                                  rounded-xl
                                  border
                                  px-3
                                  py-3
                                  text-left
                                  transition

                                  ${
                                    active
                                      ? "border-amber-400/40 bg-amber-400/10"
                                      : "border-white/5 bg-black/20 hover:bg-white/5"
                                  }
                                `}
                            >
                              <div className="flex items-center gap-3">
                                <span
                                  className={`
                                      flex
                                      h-7
                                      w-7
                                      items-center
                                      justify-center
                                      rounded-lg
                                      text-xs
                                      font-black
                                      ${
                                        active
                                          ? "bg-amber-400 text-zinc-950"
                                          : "bg-amber-400/10 text-amber-300"
                                      }
                                    `}
                                >
                                  {index + 1}
                                </span>

                                <div>
                                  <p className="font-mono font-bold text-zinc-100">
                                    {suggestion.san}
                                  </p>

                                  <p className="mt-0.5 text-[10px] text-zinc-600">
                                    {active
                                      ? "Highlighted on board"
                                      : "Click to highlight"}
                                  </p>
                                </div>
                              </div>

                              <span className="text-xs text-zinc-500">
                                {suggestion.evaluation}
                              </span>
                            </button>
                          );
                        })}
                      </div>
                    </div>

                    {/* SELECTED CONTINUATION */}

                    <div className="mt-5 rounded-xl border border-white/5 bg-black/20 p-3">
                      <div className="flex items-center justify-between gap-3">
                        <div>
                          <p className="text-[10px] font-black uppercase tracking-widest text-zinc-500">
                            Best Continuation
                          </p>
                          <p className="mt-1 text-[10px] text-zinc-600">
                            Extra analysis only for this selected position
                          </p>
                        </div>

                        {!continuation && (
                          <button
                            type="button"
                            disabled={
                              continuationLoading ||
                              analyzing ||
                              reviewing ||
                              !ready
                            }
                            onClick={() => void loadContinuation()}
                            className="rounded-lg border border-amber-400/20 bg-amber-400/10 px-2.5 py-1.5 text-[10px] font-bold text-amber-300 disabled:opacity-40"
                          >
                            {continuationLoading ? "Analyzing..." : "Show"}
                          </button>
                        )}
                      </div>

                      {continuation && (
                        <div className="mt-3">
                          <div className="flex items-center justify-between">
                            <span className="text-[10px] text-zinc-600">
                              Engine eval
                            </span>
                            <span className="text-xs font-bold text-zinc-300">
                              {continuation.evaluation}
                            </span>
                          </div>

                          <div className="mt-3 rounded-lg border border-white/5 bg-black/15 p-2.5">
                            <p className="text-[9px] leading-4 text-zinc-600">
                              Read from left to right. Each move alternates
                              between the two players, starting with the side
                              whose turn it is in this position.
                            </p>

                            <div className="mt-2 flex flex-wrap items-center gap-1.5">
                              {continuation.moves.map((move, index) => {
                                const startingColor = new Chess(
                                  selected.fenBefore,
                                ).turn();
                                const moveColor =
                                  index % 2 === 0
                                    ? startingColor
                                    : startingColor === "w"
                                      ? "b"
                                      : "w";

                                return (
                                  <div
                                    key={`${move}-${index}`}
                                    className="flex items-center gap-1.5"
                                  >
                                    {index > 0 && (
                                      <span className="text-[10px] font-black text-zinc-700">
                                        →
                                      </span>
                                    )}

                                    <span
                                      className={`
                                          inline-flex
                                          items-center
                                          gap-1.5
                                          rounded-lg
                                          border
                                          px-2
                                          py-1
                                          ${
                                            moveColor === "w"
                                              ? "border-[#fff3d5]/15 bg-[#fff3d5]/8 text-[#fff3d5]"
                                              : "border-white/5 bg-white/5 text-zinc-400"
                                          }
                                        `}
                                    >
                                      <span className="text-[10px]">
                                        {moveColor === "w" ? "♔" : "♚"}
                                      </span>

                                      <span className="text-[8px] font-black uppercase tracking-wide">
                                        {moveColor === "w" ? "White" : "Black"}
                                      </span>

                                      <span className="font-mono text-[11px] font-bold text-zinc-200">
                                        {move}
                                      </span>
                                    </span>
                                  </div>
                                );
                              })}
                            </div>
                          </div>
                        </div>
                      )}

                      {continuationError && (
                        <p className="mt-2 text-xs text-red-300">
                          {continuationError}
                        </p>
                      )}
                    </div>

                    {/* PIECE PERFORMANCE */}

                    <div className="mt-5">
                      <p className="text-[10px] font-black uppercase tracking-widest text-zinc-500">
                        {selected.color === "w" ? "White" : "Black"} Piece
                        Performance
                      </p>

                      <div className="mt-2 space-y-1.5">
                        {selectedSidePiecePerformance.map((performance) => (
                          <div
                            key={performance.piece}
                            className="grid grid-cols-[32px_1fr_auto] items-center gap-2 rounded-lg bg-black/20 px-2.5 py-2"
                          >
                            <span className="text-center text-xl">
                              {pieceSymbols[selected.color][performance.piece]}
                            </span>

                            <div>
                              <p className="text-xs font-bold text-zinc-300">
                                {pieceNames[performance.piece]}
                              </p>
                              <p className="text-[9px] text-zinc-600">
                                {performance.moves} moves · {performance.best}{" "}
                                best · {performance.mistakes} errors
                              </p>
                            </div>

                            <span className="text-[10px] font-bold text-zinc-500">
                              {performance.acpl} ACPL
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* PHASE PERFORMANCE */}

                    <div className="mt-5">
                      <p className="text-[10px] font-black uppercase tracking-widest text-zinc-500">
                        Phase Performance
                      </p>

                      <div className="mt-2 grid gap-2">
                        {selectedSidePhasePerformance.map((performance) => (
                          <div
                            key={performance.phase}
                            className="rounded-lg bg-black/20 px-3 py-2"
                          >
                            <div className="flex items-center justify-between gap-2">
                              <span className="text-xs font-bold text-zinc-300">
                                {performance.phase}
                              </span>

                              <span className="text-[10px] text-zinc-500">
                                {performance.acpl} ACPL
                              </span>
                            </div>

                            <div className="mt-1 flex items-center justify-between text-[9px] text-zinc-600">
                              <span>{performance.moves} moves</span>
                              <span>
                                {performance.goodOrBetterPercent}%
                                good-or-better
                              </span>
                            </div>
                          </div>
                        ))}
                      </div>

                      <p className="mt-2 text-[9px] leading-4 text-zinc-700">
                        Opening / middlegame / endgame is classified
                        heuristically from move number and remaining material.
                      </p>
                    </div>
                  </>
                )}
              </aside>
            </div>

            {/* ===============================================
                CENTER — QUICK NAVIGATION + BOARD + EVALUATION
               =============================================== */}

            <div className="flex min-h-0 flex-col gap-3">
              <section className="shrink-0 rounded-2xl border border-white/10 bg-zinc-900/75 px-3 py-2.5">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <p className="text-[9px] font-black uppercase tracking-widest text-zinc-600">
                      Quick Navigation
                    </p>
                    <p className="mt-0.5 text-[9px] text-zinc-600">
                      Jump directly to the most useful teaching moments
                    </p>
                  </div>

                  <span className="rounded-full bg-amber-400/10 px-2 py-1 text-[9px] font-bold text-amber-300">
                    {totalCritical} critical
                  </span>
                </div>

                <div className="mt-2 grid grid-cols-5 gap-1.5">
                  <JumpButton
                    label="★ Best"
                    disabled={!bestRow}
                    onClick={() =>
                      bestRow && selectReviewMove(bestRow.review.ply)
                    }
                  />

                  <JumpButton
                    label="⚠ Worst"
                    disabled={!worstRow}
                    onClick={() =>
                      worstRow && selectReviewMove(worstRow.review.ply)
                    }
                  />

                  <JumpButton
                    label="↕ Swing"
                    disabled={!biggestSwingRow}
                    onClick={() =>
                      biggestSwingRow &&
                      selectReviewMove(biggestSwingRow.review.ply)
                    }
                  />

                  <JumpButton
                    label="◀ Critical"
                    disabled={criticalRows.length === 0}
                    onClick={() => selectRelativeCritical(-1)}
                  />

                  <JumpButton
                    label="Critical ▶"
                    disabled={criticalRows.length === 0}
                    onClick={() => selectRelativeCritical(1)}
                  />
                </div>

                <p className="mt-2 text-[9px] leading-4 text-zinc-600">
                  <strong className="text-zinc-400">ACPL</strong> means Average
                  Centipawn Loss: the average amount of engine evaluation a
                  player loses per move. Lower ACPL is better. App accuracy is
                  this app&apos;s own ACPL-based metric, not Chess.com accuracy.
                </p>
              </section>

              <main className="min-h-0 flex-1 overflow-y-auto">
                <div className="mx-auto max-w-[620px]">
                  <Board
                    board={board}
                    selectedSquare={
                      alternativeMove ? alternativeMove.from : null
                    }
                    legalMoves={alternativeMove ? [alternativeMove.to] : []}
                    lastMove={alternativeMove ? null : playedMove}
                    checkedKingSquare={checkedKingSquare}
                    onSquareClick={() => {}}
                    orientation={orientation}
                    pieceScale={0.8}
                  />

                  {alternativeMove && selected && (
                    <div className="mt-2 rounded-xl border border-amber-400/20 bg-amber-400/[0.07] px-3 py-2 text-center text-xs text-amber-200">
                      Showing Stockfish alternative instead of the played move
                    </div>
                  )}

                  {/* EVALUATION GRAPH */}

                  <section className="mt-3 rounded-2xl border border-white/10 bg-zinc-900/75 p-3">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div>
                        <h3 className="text-sm font-bold text-zinc-100">
                          Evaluation Timeline
                        </h3>
                        <p className="mt-0.5 text-[9px] text-zinc-600">
                          White advantage above center · Black below
                        </p>
                      </div>

                      {selectedRow && (
                        <div className="text-right">
                          <p className="text-[8px] uppercase tracking-wider text-zinc-600">
                            Selected
                          </p>
                          <p className="text-[10px] font-bold text-zinc-300">
                            {formatWhiteEvaluation(selectedRow.evalAfterWhite)}{" "}
                            · {getAdvantageLabel(selectedRow.evalAfterWhite)}
                          </p>
                        </div>
                      )}
                    </div>

                    <EvaluationGraph
                      rows={reviewRows}
                      selectedPly={selectedPly}
                      onSelect={selectReviewMove}
                    />
                  </section>
                </div>
              </main>
            </div>

            {/* ===============================================
                RIGHT — BLACK SUMMARY + SHARED MOVE REVIEW
               =============================================== */}

            <div className="flex min-h-0 flex-col gap-3">
              <div className="ml-auto w-full max-w-[320px]">
                <SideSummaryCard summary={blackSummary} />
              </div>

              <div className="min-h-0 flex-1">
                {renderMoveReviewPanel(true)}
              </div>
            </div>
          </div>
        ) : (
          <div className="grid min-h-0 flex-1 gap-4 overflow-hidden p-4 xl:grid-cols-[300px_minmax(520px,1fr)_540px]">
            {/* ===============================================
                SIMPLE — CURRENT MOVE
               =============================================== */}

            <aside className="min-h-0 overflow-y-auto rounded-2xl border border-white/10 bg-zinc-900/75 p-4">
              {selected && (
                <>
                  <p className="text-[10px] font-black uppercase tracking-widest text-zinc-500">
                    Current Move
                  </p>

                  <div className="mt-3 flex items-center justify-between gap-3">
                    <div>
                      <SideBadge color={selected.color} />

                      <div className="mt-3 flex items-center gap-2">
                        <MovePiece review={selected} />
                        <span className="font-mono text-2xl font-black">
                          {selected.san}
                        </span>
                      </div>
                    </div>

                    <QualityBadge quality={selected.quality} />
                  </div>

                  <div className="mt-4 rounded-xl bg-black/20 p-3 text-xs text-zinc-500">
                    Evaluation loss{" "}
                    <strong className="text-zinc-200">
                      {(selected.centipawnLoss / 100).toFixed(2)} pawns
                    </strong>
                  </div>

                  <button
                    type="button"
                    onClick={() => setHighlightedBestMove(null)}
                    className={`mt-5 flex w-full items-center justify-between rounded-xl border px-3 py-3 text-left transition ${
                      highlightedBestMove === null
                        ? "border-blue-400/30 bg-blue-400/10"
                        : "border-white/5 bg-black/20 hover:bg-white/5"
                    }`}
                  >
                    <div>
                      <p className="text-[9px] font-black uppercase tracking-wider text-zinc-500">
                        Played
                      </p>
                      <p className="mt-1 font-mono font-bold">{selected.san}</p>
                    </div>
                    <span className="text-lg">↪</span>
                  </button>

                  <div className="mt-5">
                    <p className="text-[10px] font-black uppercase tracking-widest text-amber-400">
                      Best Alternatives
                    </p>

                    <div className="mt-3 space-y-2">
                      {selected.bestMoves.map((suggestion, index) => {
                        const active = highlightedBestMove === suggestion.uci;

                        return (
                          <button
                            key={`${suggestion.uci}-${index}`}
                            type="button"
                            onClick={() =>
                              setHighlightedBestMove(suggestion.uci)
                            }
                            className={`flex w-full items-center justify-between rounded-xl border px-3 py-3 text-left transition ${
                              active
                                ? "border-amber-400/40 bg-amber-400/10"
                                : "border-white/5 bg-black/20 hover:bg-white/5"
                            }`}
                          >
                            <div className="flex items-center gap-3">
                              <span
                                className={`flex h-7 w-7 items-center justify-center rounded-lg text-xs font-black ${
                                  active
                                    ? "bg-amber-400 text-zinc-950"
                                    : "bg-amber-400/10 text-amber-300"
                                }`}
                              >
                                {index + 1}
                              </span>

                              <div>
                                <p className="font-mono font-bold text-zinc-100">
                                  {suggestion.san}
                                </p>
                                <p className="mt-0.5 text-[10px] text-zinc-600">
                                  {active
                                    ? "Highlighted on board"
                                    : "Click to highlight"}
                                </p>
                              </div>
                            </div>

                            <span className="text-xs text-zinc-500">
                              {suggestion.evaluation}
                            </span>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                </>
              )}
            </aside>

            {/* ===============================================
                SIMPLE — BOARD
               =============================================== */}

            <main className="min-h-0 overflow-y-auto">
              <div className="mx-auto max-w-[760px]">
                <Board
                  board={board}
                  selectedSquare={alternativeMove ? alternativeMove.from : null}
                  legalMoves={alternativeMove ? [alternativeMove.to] : []}
                  lastMove={alternativeMove ? null : playedMove}
                  checkedKingSquare={checkedKingSquare}
                  onSquareClick={() => {}}
                  orientation={orientation}
                  pieceScale={0.8}
                />

                {alternativeMove && selected && (
                  <div className="mt-3 rounded-xl border border-amber-400/20 bg-amber-400/[0.07] px-4 py-3 text-center text-sm text-amber-200">
                    Showing Stockfish alternative instead of the played move
                  </div>
                )}
              </div>
            </main>

            {/* ===============================================
                SIMPLE — SAME MOVE REVIEW AS DETAILS
               =============================================== */}

            {renderMoveReviewPanel(false)}
          </div>
        )}
      </div>
    </div>
  );
}

/* =========================================================
   REVIEW DATA HELPERS
   ========================================================= */

function getMoveInfo(review: MoveReview) {
  const game = new Chess(review.fenBefore);
  const movingPiece = game.get(review.from);

  let moved;

  try {
    moved = game.move(review.san);
  } catch {
    return {
      pieceType: movingPiece?.type ?? null,
      tags: [] as MoveTag[],
      capturedPiece: null as PieceSymbol | null,
      materialGain: 0,
      promotionGain: 0,
    };
  }

  const tags: MoveTag[] = [];

  const isCastle = moved.isKingsideCastle() || moved.isQueensideCastle();
  const isPromotion = moved.isPromotion();
  const isCapture = Boolean(moved.captured);
  const isCheckmate = review.san.includes("#");
  const isCheck = !isCheckmate && review.san.includes("+");

  if (isCapture) tags.push("capture");
  if (isCheck) tags.push("check");
  if (isCheckmate) tags.push("checkmate");
  if (isCastle) tags.push("castle");
  if (isPromotion) tags.push("promotion");
  if (moved.piece === "p") tags.push("pawn");

  if (!isCapture && !isCheck && !isCheckmate && !isCastle && !isPromotion) {
    tags.push("quiet");
  }

  const capturedPiece = moved.captured ?? null;
  const materialGain = capturedPiece ? pieceValues[capturedPiece] : 0;

  const promotionGain = moved.promotion
    ? Math.max(0, pieceValues[moved.promotion] - pieceValues.p)
    : 0;

  return {
    pieceType: moved.piece,
    tags,
    capturedPiece,
    materialGain,
    promotionGain,
  };
}

function getGamePhase(fen: string, moveNumber: number): GamePhase {
  const game = new Chess(fen);
  const board = game.board();

  let nonPawnMaterial = 0;
  let queens = 0;

  for (const row of board) {
    for (const piece of row) {
      if (!piece) continue;

      if (piece.type === "q") {
        queens += 1;
      }

      if (piece.type !== "p" && piece.type !== "k") {
        nonPawnMaterial += pieceValues[piece.type];
      }
    }
  }

  if (moveNumber <= 10 && nonPawnMaterial >= 46) {
    return "Opening";
  }

  if (nonPawnMaterial <= 20 || (queens === 0 && nonPawnMaterial <= 30)) {
    return "Endgame";
  }

  return "Middlegame";
}

function parseEvaluation(value: string | null): number | null {
  if (!value) {
    return null;
  }

  if (value.startsWith("M")) {
    return 10;
  }

  if (value.startsWith("-M")) {
    return -10;
  }

  const parsed = Number(value);

  return Number.isFinite(parsed) ? parsed : null;
}

function terminalEvaluationWhite(fen: string): number | null {
  const game = new Chess(fen);

  if (game.isCheckmate()) {
    return game.turn() === "w" ? -10 : 10;
  }

  if (game.isDraw() || game.isStalemate() || game.isInsufficientMaterial()) {
    return 0;
  }

  return null;
}

function classifyCriticalMoment(
  review: MoveReview,
  moverEvalBefore: number | null,
  moverEvalAfter: number | null,
) {
  if (
    review.centipawnLoss < 120 &&
    review.quality !== "Mistake" &&
    review.quality !== "Blunder"
  ) {
    return null;
  }

  if (
    moverEvalBefore !== null &&
    moverEvalAfter !== null &&
    moverEvalBefore >= 4 &&
    moverEvalAfter < 2
  ) {
    return "Missed winning advantage";
  }

  if (
    moverEvalBefore !== null &&
    moverEvalAfter !== null &&
    moverEvalBefore >= 1.5 &&
    moverEvalAfter <= 0.5
  ) {
    return "Lost advantage";
  }

  if (
    moverEvalBefore !== null &&
    moverEvalAfter !== null &&
    moverEvalBefore > -0.5 &&
    moverEvalAfter <= -1.5
  ) {
    return "Turning point";
  }

  if (review.centipawnLoss >= 300) {
    return "Major evaluation swing";
  }

  if (review.quality === "Blunder") {
    return "Critical blunder";
  }

  if (review.quality === "Mistake") {
    return "Critical mistake";
  }

  return "Critical moment";
}

function classifyMissedOpportunity(
  review: MoveReview,
  moverEvalBefore: number | null,
  moverEvalAfter: number | null,
) {
  if (review.centipawnLoss < 80) {
    return null;
  }

  if (
    moverEvalBefore !== null &&
    moverEvalAfter !== null &&
    moverEvalBefore >= 5 &&
    moverEvalAfter < 3
  ) {
    return "A winning position was available, but this move gave away a large part of that advantage.";
  }

  if (
    moverEvalBefore !== null &&
    moverEvalAfter !== null &&
    moverEvalBefore >= 2 &&
    moverEvalAfter < 0.75
  ) {
    return "A clear advantage was available before this move.";
  }

  if (
    moverEvalBefore !== null &&
    moverEvalAfter !== null &&
    moverEvalBefore >= -0.5 &&
    moverEvalAfter <= -2
  ) {
    return "The position changed from roughly balanced to a clear disadvantage.";
  }

  if (review.bestMoveSan) {
    return `Stockfish preferred ${review.bestMoveSan}, which preserved more of the position's value.`;
  }

  return null;
}

function buildEducationBullets(row: EnrichedReviewRow) {
  const bullets: string[] = [];
  const { review } = row;

  if (review.quality === "Best") {
    bullets.push("This matched Stockfish's first choice in the position.");
  } else {
    bullets.push(
      `This move lost about ${(review.centipawnLoss / 100).toFixed(2)} pawns compared with best play.`,
    );

    if (review.bestMoveSan) {
      bullets.push(`The engine's first choice was ${review.bestMoveSan}.`);
    }
  }

  if (row.evalBeforeWhite !== null && row.evalAfterWhite !== null) {
    bullets.push(
      `The position changed from ${getAdvantageLabel(row.evalBeforeWhite)} to ${getAdvantageLabel(row.evalAfterWhite)}.`,
    );
  }

  if (row.moveTags.includes("checkmate")) {
    bullets.push("The move delivered checkmate.");
  } else if (row.moveTags.includes("check")) {
    bullets.push("The move gave check.");
  }

  if (row.moveTags.includes("castle")) {
    bullets.push("The move castled the king and rook in one move.");
  }

  if (row.capturedPiece) {
    bullets.push(
      `The move captured a ${pieceNames[row.capturedPiece].toLowerCase()} worth ${row.materialGain} material point${row.materialGain === 1 ? "" : "s"}.`,
    );
  }

  if (row.moveTags.includes("promotion")) {
    bullets.push(
      `The pawn promoted, increasing immediate material value by about ${row.promotionGain} points.`,
    );
  }

  if (row.moveTags.includes("quiet")) {
    bullets.push(
      "This was a quiet move: no capture, check, castling or promotion.",
    );
  }

  bullets.push(`This occurred in the ${row.phase.toLowerCase()} phase.`);

  return bullets;
}

function buildSideSummary(
  rows: EnrichedReviewRow[],
  color: "w" | "b",
): SideSummary {
  const sideRows = rows.filter((row) => row.review.color === color);

  const counts = qualityList.reduce(
    (result, quality) => {
      result[quality] = sideRows.filter(
        (row) => row.review.quality === quality,
      ).length;
      return result;
    },
    {} as Record<MoveQuality, number>,
  );

  const acpl =
    sideRows.length === 0
      ? 0
      : Math.round(
          sideRows.reduce((sum, row) => sum + row.review.centipawnLoss, 0) /
            sideRows.length,
        );

  const goodOrBetter = counts.Best + counts.Excellent + counts.Good;

  const goodOrBetterPercent =
    sideRows.length === 0
      ? 0
      : Math.round((goodOrBetter / sideRows.length) * 100);

  return {
    color,
    moves: sideRows.length,
    acpl,
    appAccuracy: Math.round(100 * Math.exp(-acpl / 250)),
    critical: sideRows.filter((row) => row.critical).length,
    counts,
    goodOrBetterPercent,
  };
}

function buildPiecePerformance(rows: EnrichedReviewRow[]) {
  const result: Record<"w" | "b", PiecePerformanceRow[]> = {
    w: [],
    b: [],
  };

  for (const color of ["w", "b"] as const) {
    for (const piece of ["p", "n", "b", "r", "q", "k"] as PieceSymbol[]) {
      const pieceRows = rows.filter(
        (row) => row.review.color === color && row.pieceType === piece,
      );

      if (pieceRows.length === 0) {
        continue;
      }

      result[color].push({
        piece,
        moves: pieceRows.length,
        acpl: Math.round(
          pieceRows.reduce((sum, row) => sum + row.review.centipawnLoss, 0) /
            pieceRows.length,
        ),
        best: pieceRows.filter((row) => row.review.quality === "Best").length,
        mistakes: pieceRows.filter(
          (row) =>
            row.review.quality === "Mistake" ||
            row.review.quality === "Blunder",
        ).length,
      });
    }

    result[color].sort((a, b) => b.moves - a.moves || a.acpl - b.acpl);
  }

  return result;
}

function buildPhasePerformance(rows: EnrichedReviewRow[]) {
  const result: Record<"w" | "b", PhasePerformanceRow[]> = {
    w: [],
    b: [],
  };

  for (const color of ["w", "b"] as const) {
    for (const phase of phaseList) {
      const phaseRows = rows.filter(
        (row) => row.review.color === color && row.phase === phase,
      );

      if (phaseRows.length === 0) {
        continue;
      }

      const goodOrBetter = phaseRows.filter(
        (row) =>
          row.review.quality === "Best" ||
          row.review.quality === "Excellent" ||
          row.review.quality === "Good",
      ).length;

      result[color].push({
        phase,
        moves: phaseRows.length,
        acpl: Math.round(
          phaseRows.reduce((sum, row) => sum + row.review.centipawnLoss, 0) /
            phaseRows.length,
        ),
        goodOrBetterPercent: Math.round(
          (goodOrBetter / phaseRows.length) * 100,
        ),
      });
    }
  }

  return result;
}

function getAdvantageLabel(evaluation: number | null) {
  if (evaluation === null) {
    return "Unknown";
  }

  if (evaluation >= 5) return "White is winning";
  if (evaluation >= 2) return "White has a clear advantage";
  if (evaluation >= 0.75) return "White has a slight advantage";
  if (evaluation > -0.75) return "Approximately equal";
  if (evaluation > -2) return "Black has a slight advantage";
  if (evaluation > -5) return "Black has a clear advantage";
  return "Black is winning";
}

function formatWhiteEvaluation(evaluation: number | null) {
  if (evaluation === null) {
    return "—";
  }

  if (evaluation >= 9.5) return "M+";
  if (evaluation <= -9.5) return "M-";

  return evaluation >= 0 ? `+${evaluation.toFixed(2)}` : evaluation.toFixed(2);
}

function formatMoveTag(tag: MoveTag) {
  const labels: Record<MoveTag, string> = {
    capture: "Capture",
    check: "Check",
    checkmate: "Checkmate",
    castle: "Castle",
    promotion: "Promotion",
    pawn: "Pawn move",
    quiet: "Quiet",
  };

  return labels[tag];
}

function formatAnalysisEvaluation(line: AnalysisLineLike) {
  if (line.mate !== null) {
    return line.mate > 0 ? `M${line.mate}` : `-M${Math.abs(line.mate)}`;
  }

  const pawns = (line.scoreCp ?? 0) / 100;

  return pawns >= 0 ? `+${pawns.toFixed(2)}` : pawns.toFixed(2);
}

function pvToSan(fen: string, pv: string[]) {
  const game = new Chess(fen);
  const result: string[] = [];

  for (const uci of pv) {
    const from = uci.slice(0, 2) as Square;
    const to = uci.slice(2, 4) as Square;
    const promotion =
      uci.length > 4 ? (uci[4] as "q" | "r" | "b" | "n") : undefined;

    try {
      const move = game.move({ from, to, promotion });
      result.push(move.san);
    } catch {
      break;
    }
  }

  return result;
}

/* =========================================================
   EVALUATION GRAPH
   ========================================================= */

function EvaluationGraph({
  rows,
  selectedPly,
  onSelect,
}: {
  rows: EnrichedReviewRow[];
  selectedPly: number;
  onSelect: (ply: number) => void;
}) {
  const width = 760;
  const height = 145;
  const padX = 34;
  const padY = 15;
  const plotWidth = width - padX * 2;
  const plotHeight = height - padY * 2;
  const centerY = height / 2;

  const rawValues = rows
    .flatMap((row) => [row.evalBeforeWhite, row.evalAfterWhite])
    .filter((value): value is number => value !== null)
    .map((value) => Math.abs(value));

  const maximum = rawValues.length === 0 ? 3 : Math.max(...rawValues);
  const scaleMax = Math.max(3, Math.min(10, Math.ceil(maximum)));

  const graphPoints: Array<{
    ply: number;
    value: number;
    critical: boolean;
    quality: MoveQuality | null;
  }> = [];

  const initial = rows[0]?.evalBeforeWhite ?? 0;

  graphPoints.push({
    ply: 0,
    value: initial,
    critical: false,
    quality: null,
  });

  for (const row of rows) {
    if (row.evalAfterWhite === null) {
      continue;
    }

    graphPoints.push({
      ply: row.review.ply,
      value: row.evalAfterWhite,
      critical: row.critical,
      quality: row.review.quality,
    });
  }

  const lastPly = Math.max(rows[rows.length - 1]?.review.ply ?? 1, 1);

  const xFor = (ply: number) => padX + (ply / lastPly) * plotWidth;
  const yFor = (value: number) => {
    const clamped = Math.max(-scaleMax, Math.min(scaleMax, value));
    return centerY - (clamped / scaleMax) * (plotHeight / 2);
  };

  const polyline = graphPoints
    .map((point) => `${xFor(point.ply)},${yFor(point.value)}`)
    .join(" ");

  return (
    <div className="mt-3 overflow-hidden rounded-xl border border-white/5 bg-black/20 p-2">
      <svg
        viewBox={`0 0 ${width} ${height}`}
        className="h-auto w-full"
        aria-label="Chess evaluation graph"
      >
        <line
          x1={padX}
          y1={centerY}
          x2={width - padX}
          y2={centerY}
          stroke="rgba(255,255,255,0.14)"
          strokeWidth="1"
        />

        <line
          x1={padX}
          y1={padY}
          x2={width - padX}
          y2={padY}
          stroke="rgba(255,255,255,0.04)"
          strokeWidth="1"
        />

        <line
          x1={padX}
          y1={height - padY}
          x2={width - padX}
          y2={height - padY}
          stroke="rgba(255,255,255,0.04)"
          strokeWidth="1"
        />

        <text x="4" y={padY + 4} fill="rgba(255,255,255,0.35)" fontSize="10">
          White
        </text>
        <text
          x="4"
          y={height - padY}
          fill="rgba(255,255,255,0.35)"
          fontSize="10"
        >
          Black
        </text>
        <text x="8" y={centerY + 4} fill="rgba(255,255,255,0.25)" fontSize="9">
          0.0
        </text>

        {polyline && (
          <polyline
            points={polyline}
            fill="none"
            stroke="#fbbf24"
            strokeWidth="2.5"
            strokeLinejoin="round"
            strokeLinecap="round"
          />
        )}

        {graphPoints
          .filter((point) => point.ply > 0)
          .map((point) => {
            const selected = point.ply === selectedPly;
            const radius = selected ? 6 : point.critical ? 5 : 3.5;
            const fill = point.critical ? "#fb923c" : "#fbbf24";

            return (
              <circle
                key={point.ply}
                cx={xFor(point.ply)}
                cy={yFor(point.value)}
                r={radius}
                fill={fill}
                stroke={selected ? "white" : "rgba(0,0,0,0.45)"}
                strokeWidth={selected ? 2 : 1}
                className="cursor-pointer"
                role="button"
                tabIndex={0}
                onClick={() => onSelect(point.ply)}
                onKeyDown={(event) => {
                  if (event.key === "Enter" || event.key === " ") {
                    event.preventDefault();
                    onSelect(point.ply);
                  }
                }}
              >
                <title>
                  Move {point.ply}: {formatWhiteEvaluation(point.value)}
                  {point.quality ? ` · ${point.quality}` : ""}
                </title>
              </circle>
            );
          })}
      </svg>

      <div className="mt-1 flex items-center justify-between text-[9px] text-zinc-700">
        <span>Start</span>
        <span>Click a point to inspect that move</span>
        <span>Move {lastPly}</span>
      </div>
    </div>
  );
}

/* =========================================================
   SMALL UI COMPONENTS
   ========================================================= */

function SideSummaryCard({ summary }: { summary: SideSummary }) {
  const isWhite = summary.color === "w";

  return (
    <div className="rounded-2xl border border-white/10 bg-zinc-900/75 p-2.5">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-[9px] font-black uppercase tracking-widest text-zinc-600">
            {isWhite ? "White" : "Black"}
          </p>

          <div className="mt-1 flex items-baseline gap-2">
            <span className="text-2xl">{isWhite ? "♔" : "♚"}</span>
            <span className="text-xl font-black text-zinc-100">
              {summary.appAccuracy}
            </span>
            <span className="text-[9px] font-bold uppercase text-zinc-600">
              App accuracy
            </span>
          </div>
        </div>

        <div className="text-right">
          <p className="text-lg font-black text-amber-300">{summary.acpl}</p>
          <p className="text-[8px] uppercase text-zinc-600">ACPL</p>
          <p className="max-w-28 text-[8px] leading-3 text-zinc-700">
            Average Centipawn Loss · lower is better
          </p>
        </div>
      </div>

      <div className="mt-2 flex flex-wrap gap-1">
        <TinyCount label="Best" value={summary.counts.Best} />
        <TinyCount label="Ex" value={summary.counts.Excellent} />
        <TinyCount label="Good" value={summary.counts.Good} />
        <TinyCount label="Inaccuracy" value={summary.counts.Inaccuracy} />
        <TinyCount label="Mist" value={summary.counts.Mistake} />
        <TinyCount label="Blunder" value={summary.counts.Blunder} />
      </div>

      <div className="mt-2 flex items-center justify-between text-[9px] text-zinc-600">
        <span>{summary.moves} moves</span>
        <span>{summary.goodOrBetterPercent}% good-or-better</span>
        <span>{summary.critical} critical</span>
      </div>
    </div>
  );
}

function TinyCount({ label, value }: { label: string; value: number }) {
  return (
    <span className="rounded-md bg-black/20 px-1.5 py-1 text-[8px] font-bold text-zinc-500">
      {label} {value}
    </span>
  );
}

function JumpButton({
  label,
  disabled,
  onClick,
}: {
  label: string;
  disabled: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className="rounded-lg border border-white/10 bg-black/20 px-2 py-2 text-[10px] font-bold text-zinc-400 transition hover:bg-white/5 hover:text-zinc-200 disabled:opacity-30"
    >
      {label}
    </button>
  );
}

function EvaluationCard({
  title,
  evaluation,
}: {
  title: string;
  evaluation: number | null;
}) {
  return (
    <div className="rounded-xl border border-white/5 bg-black/20 p-3">
      <p className="text-[9px] font-black uppercase tracking-wider text-zinc-600">
        {title}
      </p>
      <p className="mt-1 text-lg font-black text-zinc-200">
        {formatWhiteEvaluation(evaluation)}
      </p>
      <p className="mt-0.5 text-[9px] leading-4 text-zinc-600">
        {getAdvantageLabel(evaluation)}
      </p>
    </div>
  );
}

function PhaseBadge({ phase }: { phase: GamePhase }) {
  return (
    <span className="rounded-full border border-white/5 bg-white/5 px-2 py-1 text-[8px] font-black uppercase tracking-wider text-zinc-500">
      {phase}
    </span>
  );
}

function MoveTagBadge({ tag }: { tag: MoveTag }) {
  return (
    <span className="rounded-full border border-amber-400/10 bg-amber-400/[0.05] px-2 py-1 text-[8px] font-black uppercase tracking-wider text-amber-300/80">
      {formatMoveTag(tag)}
    </span>
  );
}

function FilterSelect({
  label,
  value,
  onChange,
  options,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  options: Array<[string, string]>;
}) {
  return (
    <div>
      <label className="mb-0.5 block text-[8px] font-black uppercase tracking-wider text-zinc-600">
        {label}
      </label>

      <select
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="w-full rounded-lg border border-white/10 bg-black/30 px-1.5 py-1.5 text-[10px] font-semibold text-zinc-300 outline-none transition hover:border-white/20 focus:border-amber-400/40"
      >
        {options.map(([optionValue, optionLabel]) => (
          <option key={optionValue} value={optionValue}>
            {optionLabel}
          </option>
        ))}
      </select>
    </div>
  );
}

function MovePiece({ review }: { review: MoveReview }) {
  const position = new Chess(review.fenBefore);
  const piece = position.get(review.from);

  if (!piece) {
    return <span className="w-6 text-center text-zinc-600">·</span>;
  }

  return (
    <span className="w-6 text-center text-xl leading-none">
      {pieceSymbols[piece.color][piece.type]}
    </span>
  );
}

function SortableHeader({
  label,
  active,
  direction,
  onClick,
  className = "",
}: {
  label: string;
  active: boolean;
  direction: SortDirection;
  onClick: () => void;
  className?: string;
}) {
  return (
    <th className={`px-1.5 py-2 ${className}`}>
      <button
        type="button"
        onClick={onClick}
        className={`flex items-center gap-1 transition ${
          active ? "text-amber-300" : "text-zinc-600 hover:text-zinc-400"
        }`}
      >
        {label}

        <span className={`text-[8px] ${active ? "opacity-100" : "opacity-25"}`}>
          {active ? (direction === "asc" ? "▲" : "▼") : "◆"}
        </span>
      </button>
    </th>
  );
}

function SideBadge({ color }: { color: "w" | "b" }) {
  return color === "w" ? (
    <span className="inline-flex items-center gap-1 rounded-full bg-[#fff3d5]/10 px-2 py-1 text-[9px] font-black text-[#fff3d5]">
      ♔ White
    </span>
  ) : (
    <span className="inline-flex items-center gap-1 rounded-full bg-white/5 px-2 py-1 text-[9px] font-black text-zinc-300">
      ♚ Black
    </span>
  );
}

function CompactSideBadge({ color }: { color: "w" | "b" }) {
  return color === "w" ? (
    <span className="inline-flex items-center gap-1 rounded-md bg-[#fff3d5]/10 px-1.5 py-1 text-[8px] font-black text-[#fff3d5]">
      ♔ W
    </span>
  ) : (
    <span className="inline-flex items-center gap-1 rounded-md bg-white/5 px-1.5 py-1 text-[8px] font-black text-zinc-400">
      ♚ B
    </span>
  );
}

function QualityBadge({ quality }: { quality: MoveQuality }) {
  const styles: Record<MoveQuality, string> = {
    Best: "bg-emerald-500/15 text-emerald-300",
    Excellent: "bg-cyan-500/15 text-cyan-300",
    Good: "bg-blue-500/15 text-blue-300",
    Inaccuracy: "bg-yellow-500/15 text-yellow-300",
    Mistake: "bg-orange-500/15 text-orange-300",
    Blunder: "bg-red-500/15 text-red-300",
  };

  return (
    <span
      className={`inline-flex rounded-full px-2 py-1 text-[8px] font-black uppercase ${styles[quality]}`}
    >
      {quality}
    </span>
  );
}
