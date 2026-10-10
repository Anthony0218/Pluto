import { gameUi } from "../../../i18n/gameUi.ts";
import { isMissedWin, REVIEW_SPEEDS, playbackDelay } from "./reviewPlayback.ts";
import ChessPageHeader from "@/components/chess/ChessPageHeader";
import { ui, useUiLanguage } from "@/i18n/ui";
import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useNavigate } from "react-router-dom";
import { ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight, Pause, Play } from "lucide-react";

import { Chess, type Color, type PieceSymbol, type Square } from "chess.js";

import Board from "./Board";
import QualityBadge, { ReviewQualityIcon } from "./ReviewQualityBadge";
import { AlternativeMoveButton } from "./ReviewMoveButtons";
import { qualityColor, type ReviewVisualQuality } from "./reviewQualityVisuals";
import { alternativeQuality, qualityList } from "./reviewQualities";
import { reviewMoveAnnotations, type BoardAnnotations } from "./boardAnnotations";

import { useStockfishAnalysis, type StockfishAnalysisLine } from "@/hooks/useStockfishAnalysis";

import {
  reviewGameMoves,
  type AnalyzePosition,
  type MoveQuality,
  type MoveReview,
} from "@/utils/chessAnalysis";

import { useAuth } from "../../../context/AuthContext.tsx";
import {
  savePersonalGamePuzzle,
  type GamePuzzleSourceMode,
  type PersonalPuzzleQuality,
} from "./personalGamePuzzleSource.ts";
import {
  HOTSEAT_PATH,
  continuationGameName,
  storePendingContinuation,
  type ReviewContinuation,
} from "./reviewContinuation";

type Props = {
  moves: string[];
  orientation?: "white" | "black";
  open: boolean;
  onClose: () => void;
  puzzleSource?: GamePuzzleSourceMode;
  puzzlePlayerColor?: "white" | "black";
  /**
   * "Play from here" on a best-continuation move. Without it the position is
   * stored as a pending game and the Hotseat board loads it.
   */
  onPlayFromPosition?: (continuation: ReviewContinuation) => void;
  /** Render in place instead of portalling out of the page (e.g. inside a modal <dialog>). */
  inline?: boolean;
};

type SideFilter = "all" | "w" | "b";
type PieceFilter = "all" | PieceSymbol;
type QualityFilter = "all" | ReviewVisualQuality;
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

function displayQuality(row: EnrichedReviewRow): ReviewVisualQuality {
  if (isMissedWin(row.review, row.moverEvalBefore, row.moverEvalAfter)) return "Missed Win";
  return row.review.quality;
}

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

const qualitySortOrder: Record<ReviewVisualQuality, number> = {
  Book: -1,
  Best: 0,
  Excellent: 1,
  Good: 2,
  Inaccuracy: 3,
  Mistake: 4,
  Blunder: 5,
  "Missed Win": 6,
};

const REWIND_MS = 380;
const LINE_MOVE_MS = 480;
const LINE_GAP_MS = 140;
/** How long the winning piece stays marked before it moves. */
const MARK_BEFORE_MOVE_MS = 650;
const CONTINUATION_COLOR = "#fcd34d";

type MoveAnimation = { id: string; from: Square; to: Square; durationMs?: number };
type LineMove = { from: Square; to: Square; promotion?: "q" | "r" | "b" | "n" };

/**
 * A position shown while the board plays from one preview to another;
 * `line` holds the moves played from the position before the selected move.
 */
type ReviewFrame = {
  fen: string;
  line: LineMove[];
  lastMove: { from: Square; to: Square } | null;
  annotations: BoardAnnotations | null;
};

function uciMove(uci: string): LineMove {
  return {
    from: uci.slice(0, 2) as Square,
    to: uci.slice(2, 4) as Square,
    promotion: (uci[4] || undefined) as LineMove["promotion"],
  };
}

function sanLine(fen: string, moves: string[]): LineMove[] {
  const game = new Chess(fen);
  const line: LineMove[] = [];

  for (const san of moves) {
    try {
      const move = game.move(san);
      line.push({ from: move.from, to: move.to, promotion: move.promotion as LineMove["promotion"] });
    } catch {
      break;
    }
  }

  return line;
}

function sameLineMove(left: LineMove, right: LineMove) {
  return left.from === right.from && left.to === right.to && (left.promotion ?? "") === (right.promotion ?? "");
}

/** The position after the first `count` moves of `line`, or null when a move does not fit. */
function linePosition(fen: string, line: LineMove[], count: number) {
  const game = new Chess(fen);

  try {
    for (const move of line.slice(0, count)) game.move(move);
  } catch {
    return null;
  }

  return game.fen();
}

const phaseList: GamePhase[] = ["Opening", "Middlegame", "Endgame"];

const sideOptions: Array<{ key: SideFilter; label: string }> = [
  { key: "all", label: "All moves" },
  { key: "w", label: "White's moves" },
  { key: "b", label: "Black's moves" },
];

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

/* =========================================================
   REVIEW CACHE
   =========================================================
   A finished review is kept per game (also in sessionStorage), so closing
   the review, leaving the page or a remount after tabbing out never makes
   the player analyse the same game again. Engine lines are cached per
   position, so an interrupted review resumes where it stopped.
   ========================================================= */

type CachedReview = {
  reviews: MoveReview[];
  puzzleStatus: string | null;
  ply: number;
};

// v3: refresh opening-book grades and missed-mate categories.
const REVIEW_STORAGE_KEY = "chess-game-review-cache-v3";
const MAX_STORED_REVIEWS = 6;

const reviewCache = new Map<string, CachedReview>(readStoredReviews());
const positionAnalysisCache = new Map<string, StockfishAnalysisLine[]>();
/** Reviews that started but never finished, resumed on the next open. */
const interruptedReviews = new Set<string>();

function readStoredReviews(): Array<[string, CachedReview]> {
  try {
    const raw = sessionStorage.getItem(REVIEW_STORAGE_KEY);
    const parsed = raw ? (JSON.parse(raw) as Array<[string, CachedReview]>) : [];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function cacheReview(key: string, entry: CachedReview) {
  reviewCache.delete(key);
  reviewCache.set(key, entry);

  while (reviewCache.size > MAX_STORED_REVIEWS) {
    reviewCache.delete(reviewCache.keys().next().value as string);
  }

  try {
    sessionStorage.setItem(REVIEW_STORAGE_KEY, JSON.stringify([...reviewCache]));
  } catch {
    // Storage full or blocked: the in-memory cache still covers this visit.
  }
}

function defaultPersonalPuzzleName(source: GamePuzzleSourceMode) {
  const sourceName = source === "singleplayer" ? "Singleplayer" : "Multiplayer";

  const timestamp = new Intl.DateTimeFormat(undefined, {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(new Date());

  return `${sourceName} · ${timestamp}`;
}

export default function ChessGameReview({
  moves,
  orientation = "white",
  open,
  onClose,
  puzzleSource,
  puzzlePlayerColor,
  onPlayFromPosition,
  inline = false,
}: Props) {
  useUiLanguage();
  const { ready, analyzing, analyzePosition } = useStockfishAnalysis();
  const { user } = useAuth();
  const navigate = useNavigate();

  const movesKey = moves.join("|");
  const movesKeyRef = useRef(movesKey);
  movesKeyRef.current = movesKey;
  /** Game whose review this instance is currently running. */
  const reviewRunRef = useRef<string | null>(null);

  const [reviews, setReviews] = useState<MoveReview[]>(
    () => reviewCache.get(movesKey)?.reviews ?? [],
  );
  const [selectedPly, setSelectedPly] = useState(
    () => reviewCache.get(movesKey)?.ply ?? 0,
  );
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
  const [trainingPuzzleStatus, setTrainingPuzzleStatus] = useState<
    string | null
  >(() => reviewCache.get(movesKey)?.puzzleStatus ?? null);
  const [puzzleName, setPuzzleName] = useState("");
  const [continuationPreviewIndex, setContinuationPreviewIndex] = useState<
    number | null
  >(null);
  const continuationGenerationRef = useRef(0);

  const [playing, setPlaying] = useState(false);
  const [playbackSpeed, setPlaybackSpeed] = useState(1);
  const [moveAnimation, setMoveAnimation] = useState<MoveAnimation | null>(null);
  const [showingCorrectMove, setShowingCorrectMove] = useState(false);
  const [frame, setFrame] = useState<ReviewFrame | null>(null);
  const animationCounterRef = useRef(0);
  const sequenceTimersRef = useRef<number[]>([]);

  useEffect(() => () => sequenceTimersRef.current.forEach((timer) => window.clearTimeout(timer)), []);

  useEffect(() => {
    continuationGenerationRef.current += 1;

    const cached = reviewCache.get(movesKey);

    setReviews(cached?.reviews ?? []);
    setDetailsOpen(false);
    setSelectedPly(cached?.ply ?? 0);
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
    setContinuationPreviewIndex(null);
    setTrainingPuzzleStatus(cached?.puzzleStatus ?? null);
    stopBoardEffects();
  }, [movesKey]);

  useEffect(() => {
    setPuzzleName(puzzleSource ? defaultPersonalPuzzleName(puzzleSource) : "");
  }, [movesKey, puzzleSource]);

  useEffect(() => {
    stopBoardEffects();

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

  /** Saves the personal puzzle and returns the status line to show (and cache). */
  async function createTrainingPuzzleFromReview(
    result: MoveReview[],
  ): Promise<string | null> {
    if (!user || !puzzleSource || !puzzlePlayerColor) {
      return null;
    }

    const targetColor = puzzlePlayerColor === "white" ? "w" : "b";

    /*
     * Pick one meaningful missed opportunity from this user's moves.
     * 61cp is the first point above the app's "Good" range, so clean
     * games do not get an artificial puzzle.
     */
    const missed = [...result]
      .filter(
        (review) =>
          review.color === targetColor &&
          review.bestMoveUci !== null &&
          review.bestMoveUci !== review.uci &&
          (review.missedMate || review.centipawnLoss >= 61),
      )
      .sort((left, right) => right.centipawnLoss - left.centipawnLoss)[0];

    if (!missed) {
      return "No meaningful missed opportunity was found for a personal puzzle.";
    }

    try {
      setTrainingPuzzleStatus(
        "Creating a training puzzle from your biggest miss...",
      );

      const lines = await analyzePosition(missed.fenBefore, {
        multiPV: 1,
        moveTime: 900,
      });

      const solutionMoves = lines[0]?.pv.slice(0, 8) ?? [];

      if (solutionMoves.length === 0) {
        return "Review finished, but no stable puzzle continuation was returned.";
      }

      const quality: PersonalPuzzleQuality =
        missed.quality === "Blunder"
          ? "Blunder"
          : missed.quality === "Mistake"
            ? "Mistake"
            : "Inaccuracy";

      const resolvedPuzzleName =
        puzzleName.trim() || defaultPersonalPuzzleName(puzzleSource);

      await savePersonalGamePuzzle({
        name: resolvedPuzzleName,
        sourceMode: puzzleSource,
        moves,
        playerColor: puzzlePlayerColor,
        moveNumber: missed.moveNumber,
        fen: missed.fenBefore,
        solutionMoves,
        playedMoveUci: missed.uci,
        playedMoveSan: missed.san,
        bestMoveSan: missed.bestMoveSan,
        centipawnLoss: missed.centipawnLoss,
        quality,
      });

      return `Training puzzle “${resolvedPuzzleName}” saved from your ${
        puzzleSource === "singleplayer" ? "Singleplayer" : "Multiplayer"
      } game.`;
    } catch (puzzleError) {
      const message =
        puzzleError instanceof Error
          ? puzzleError.message
          : String(puzzleError);

      console.error("Could not create personal game puzzle:", message);

      return `Game review finished, but the personal training puzzle could not be saved. ${message}`;
    }
  }

  /** Engine lines are cached per position, so a resumed review skips everything already analysed. */
  const cachedAnalyzePosition: AnalyzePosition = async (fen, options) => {
    const cacheKey = `${fen}|${options?.multiPV ?? 1}|${options?.depth ?? options?.moveTime ?? ""}`;
    const cachedLines = positionAnalysisCache.get(cacheKey);

    if (cachedLines) {
      return cachedLines;
    }

    const lines = await analyzePosition(fen, options);

    if (lines.length > 0) {
      positionAnalysisCache.set(cacheKey, lines);
    }

    return lines;
  };

  async function runReview() {
    if (reviewing || reviewRunRef.current || !ready || moves.length === 0) {
      return;
    }

    const key = movesKey;
    const isCurrentGame = () => movesKeyRef.current === key;

    reviewRunRef.current = key;
    interruptedReviews.add(key);

    setReviewing(true);
    setProgress(0);
    setError(null);
    setTrainingPuzzleStatus(null);

    try {
      const result = await reviewGameMoves(
        moves,
        cachedAnalyzePosition,
        (completed) => {
          if (isCurrentGame()) setProgress(completed);
        },
      );

      interruptedReviews.delete(key);
      cacheReview(key, { reviews: result, puzzleStatus: null, ply: result.length });

      if (isCurrentGame()) {
        setReviews(result);
        setSelectedPly(result.length);
        setHighlightedBestMove(null);
      }

      const puzzleStatus = await createTrainingPuzzleFromReview(result);
      const cached = reviewCache.get(key);

      cacheReview(key, { reviews: result, puzzleStatus, ply: cached?.ply ?? result.length });

      if (isCurrentGame()) setTrainingPuzzleStatus(puzzleStatus);
    } catch (reviewError) {
      console.error(reviewError);
      interruptedReviews.delete(key);
      if (isCurrentGame()) setError("Game review failed.");
    } finally {
      reviewRunRef.current = null;
      setReviewing(false);
    }
  }

  // A review cut off by a remount (tabbing out, leaving the page) continues by itself.
  useEffect(() => {
    if (
      open &&
      ready &&
      interruptedReviews.has(movesKey) &&
      !reviewCache.has(movesKey) &&
      !reviewRunRef.current
    ) {
      void runReview();
    }
    // runReview reads the same render's state.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, ready, movesKey]);

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

  // The move that would have kept the win, for a "Missed Win" move.
  const winningMove =
    selected &&
    selectedRow &&
    displayQuality(selectedRow) === "Missed Win" &&
    selected.bestMoveUci &&
    selected.bestMoveUci !== selected.uci
      ? {
          from: selected.bestMoveUci.slice(0, 2) as Square,
          to: selected.bestMoveUci.slice(2, 4) as Square,
          promotion: selected.bestMoveUci[4] as "q" | "r" | "b" | "n" | undefined,
          san: selected.bestMoveSan,
        }
      : null;

  /* =======================================================
     SUMMARY DATA
     ======================================================= */

  const piecePerformance = useMemo(
    () => buildPiecePerformance(reviewRows),
    [reviewRows],
  );

  const phasePerformance = useMemo(
    () => buildPhasePerformance(reviewRows),
    [reviewRows],
  );

  /* =======================================================
     BOARD POSITION
     ======================================================= */

  const continuationPreview = useMemo(() => {
    if (
      !selected ||
      !continuation ||
      continuationPreviewIndex === null ||
      continuationPreviewIndex < 0 ||
      continuationPreviewIndex >= continuation.moves.length
    ) {
      return null;
    }

    const game = new Chess(selected.fenBefore);
    let previewMove: { from: Square; to: Square } | null = null;

    try {
      for (let index = 0; index <= continuationPreviewIndex; index += 1) {
        const move = game.move(continuation.moves[index]);

        if (index === continuationPreviewIndex) {
          previewMove = {
            from: move.from,
            to: move.to,
          };
        }
      }
    } catch {
      return null;
    }

    return {
      game,
      move: previewMove,
    };
  }, [selected, continuation, continuationPreviewIndex]);

  // The board shows the move from the game, not an alternative, continuation or the correct move.
  const showingPlayedMove = highlightedBestMove === null && continuationPreviewIndex === null && !showingCorrectMove;

  // A clicked engine alternative is played out on the board, like the played move.
  const alternativePreview = useMemo(() => {
    if (!selected || !highlightedBestMove || continuationPreview) {
      return null;
    }

    const index = selected.bestMoves.findIndex((suggestion) => suggestion.uci === highlightedBestMove);
    const game = new Chess(selected.fenBefore);

    try {
      const move = game.move({
        from: highlightedBestMove.slice(0, 2) as Square,
        to: highlightedBestMove.slice(2, 4) as Square,
        promotion: highlightedBestMove[4] as "q" | "r" | "b" | "n" | undefined,
      });

      return {
        game,
        move: { from: move.from, to: move.to },
        quality: index >= 0 ? alternativeQuality(selected.bestMoves, index) : ("Best" as MoveQuality),
      };
    } catch {
      return null;
    }
  }, [selected, highlightedBestMove, continuationPreview]);

  // "Show correct move": the winning move played instead of the played move.
  const correctMovePreview = useMemo(() => {
    if (!selected || !winningMove || !showingCorrectMove || continuationPreview || alternativePreview) {
      return null;
    }

    const game = new Chess(selected.fenBefore);

    try {
      const move = game.move({ from: winningMove.from, to: winningMove.to, promotion: winningMove.promotion });
      return { game, move: { from: move.from, to: move.to } };
    } catch {
      return null;
    }
    // winningMove is derived from `selected`.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selected, showingCorrectMove, continuationPreview, alternativePreview]);

  const reviewChess = useMemo(() => {
    if (frame) {
      return new Chess(frame.fen);
    }

    if (continuationPreview) {
      return continuationPreview.game;
    }

    if (alternativePreview) {
      return alternativePreview.game;
    }

    if (correctMovePreview) {
      return correctMovePreview.game;
    }

    if (!selected) {
      return new Chess();
    }

    return new Chess(selected.fenAfter);
  }, [frame, selected, alternativePreview, continuationPreview, correctMovePreview]);

  const board = reviewChess.board();

  const alternativeMove = alternativePreview?.move ?? null;

  const continuationMove = continuationPreview?.move ?? null;

  const selectedAnnotations: BoardAnnotations | null = frame
    ? frame.annotations
    : continuationMove
    ? {
        // The clicked continuation move: border its target square.
        marks: [{ square: continuationMove.to, kind: "outline", color: CONTINUATION_COLOR, opacity: 1 }],
        arrows: [],
      }
    : alternativePreview
      ? reviewMoveAnnotations({
          from: alternativePreview.move.from,
          to: alternativePreview.move.to,
          quality: alternativePreview.quality,
          fenAfter: alternativePreview.game.fen(),
        })
      : correctMovePreview?.move
        ? reviewMoveAnnotations({
            from: correctMovePreview.move.from,
            to: correctMovePreview.move.to,
            quality: "Missed Win",
            fenAfter: correctMovePreview.game.fen(),
          })
      : selected && selectedRow
        ? reviewMoveAnnotations({
            from: selected.from,
            to: selected.to,
            quality: displayQuality(selectedRow),
            fenAfter: selected.fenAfter,
            bestMoveUci: selected.bestMoveUci,
          })
        : null;

  const playedMove =
    selected && !continuationPreview && !correctMovePreview
      ? {
          from: selected.from,
          to: selected.to,
        }
      : null;

  const boardLastMove = frame
    ? frame.lastMove
    : continuationMove ?? alternativeMove ?? correctMovePreview?.move ?? playedMove;

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

      if (qualityFilter !== "all" && displayQuality(row) !== qualityFilter) {
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
            qualitySortOrder[displayQuality(a)] -
            qualitySortOrder[displayQuality(b)];
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

  /*
   * "All moves" in move order reads like a score sheet:
   * White's move on the left, Black's reply on the right.
   */
  const pairedReviews = useMemo(() => {
    if (sideFilter !== "all" || sortKey !== "move") {
      return null;
    }

    const pairs: Array<{
      moveNumber: number;
      white: EnrichedReviewRow | null;
      black: EnrichedReviewRow | null;
    }> = [];
    const byMoveNumber = new Map<number, (typeof pairs)[number]>();

    for (const row of filteredReviews) {
      let pair = byMoveNumber.get(row.review.moveNumber);

      if (!pair) {
        pair = { moveNumber: row.review.moveNumber, white: null, black: null };
        byMoveNumber.set(row.review.moveNumber, pair);
        pairs.push(pair);
      }

      pair[row.review.color === "w" ? "white" : "black"] = row;
    }

    return pairs;
  }, [filteredReviews, sideFilter, sortKey]);

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

  function animateMove(from: Square, to: Square, durationMs?: number) {
    animationCounterRef.current += 1;
    setMoveAnimation({ id: `review-move-${animationCounterRef.current}`, from, to, durationMs });
  }

  function clearSequence() {
    sequenceTimersRef.current.forEach((timer) => window.clearTimeout(timer));
    sequenceTimersRef.current = [];
  }

  /** Stops playback and any move sequence, and drops any running piece slide. */
  function stopBoardEffects() {
    clearSequence();
    setPlaying(false);
    setShowingCorrectMove(false);
    setFrame(null);
    setMoveAnimation(null);
  }

  /** The moves, from the position before the selected move, behind what the board shows now. */
  function shownLine(): LineMove[] {
    if (frame) return frame.line;
    if (!selected) return [];
    if (continuationPreview && continuation && continuationPreviewIndex !== null) {
      return sanLine(selected.fenBefore, continuation.moves.slice(0, continuationPreviewIndex + 1));
    }
    if (alternativePreview && highlightedBestMove) return [uciMove(highlightedBestMove)];
    if (correctMovePreview && winningMove) return [winningMove];
    return [uciMove(selected.uci)];
  }

  /**
   * Plays the board from what it shows now to `target`: the moves that differ are
   * taken back one by one, then the target moves are played. Board draws a square's
   * border and icon only once the moving piece has landed there.
   */
  function playLine(target: LineMove[], markBeforeMove?: BoardAnnotations) {
    if (!selected) return;

    const base = selected.fenBefore;
    const current = shownLine();
    let shared = 0;

    while (shared < current.length && shared < target.length && sameLineMove(current[shared], target[shared])) {
      shared += 1;
    }

    // Asking for the line already shown plays its last move again.
    if (shared === current.length && shared === target.length) {
      shared = Math.max(0, shared - 1);
    }

    type Step = { frame: ReviewFrame | null; slide: { from: Square; to: Square; durationMs: number } | null; holdMs: number };
    const steps: Step[] = [];

    for (let index = current.length - 1; index >= shared; index -= 1) {
      const fen = linePosition(base, current, index);
      if (!fen) break;
      steps.push({
        frame: { fen, line: current.slice(0, index), lastMove: null, annotations: null },
        slide: { from: current[index].to, to: current[index].from, durationMs: REWIND_MS },
        holdMs: REWIND_MS + LINE_GAP_MS,
      });
    }

    if (markBeforeMove) {
      const fen = linePosition(base, target, shared);
      if (fen) {
        steps.push({
          frame: { fen, line: target.slice(0, shared), lastMove: null, annotations: markBeforeMove },
          slide: null,
          holdMs: MARK_BEFORE_MOVE_MS,
        });
      }
    }

    for (let index = shared; index < target.length - 1; index += 1) {
      const fen = linePosition(base, target, index + 1);
      if (!fen) break;
      const move = target[index];
      steps.push({
        frame: {
          fen,
          line: target.slice(0, index + 1),
          lastMove: { from: move.from, to: move.to },
          annotations: { marks: [{ square: move.to, kind: "outline", color: CONTINUATION_COLOR, opacity: 1 }], arrows: [] },
        },
        slide: { from: move.from, to: move.to, durationMs: LINE_MOVE_MS },
        holdMs: LINE_MOVE_MS + LINE_GAP_MS,
      });
    }

    const last = target.length > shared ? target[target.length - 1] : null;
    steps.push({ frame: null, slide: last ? { from: last.from, to: last.to, durationMs: LINE_MOVE_MS } : null, holdMs: 0 });

    clearSequence();
    setPlaying(false);

    let delay = 0;

    for (const step of steps) {
      const show = () => {
        setFrame(step.frame);
        if (step.slide) animateMove(step.slide.from, step.slide.to, step.slide.durationMs);
        else setMoveAnimation(null);
      };

      if (delay === 0) show();
      else sequenceTimersRef.current.push(window.setTimeout(show, delay));

      delay += step.holdMs;
    }
  }

  function selectReviewMove(ply: number, fromPlayback = false) {
    continuationGenerationRef.current += 1;

    const next = ply === selectedPly + 1 ? reviews[ply - 1] : undefined;

    if (!fromPlayback) {
      setPlaying(false);
    }

    clearSequence();
    setFrame(null);
    setShowingCorrectMove(false);

    // Stepping one move forward slides the moved piece; jumps just switch positions.
    if (next) {
      animateMove(next.from, next.to, fromPlayback ? Math.min(LINE_MOVE_MS, playbackDelay(playbackSpeed) * 0.7) : LINE_MOVE_MS);
    } else {
      setMoveAnimation(null);
    }

    setSelectedPly(ply);
    setHighlightedBestMove(null);
    setContinuation(null);

    // Reopening the review returns to this move.
    const cached = reviewCache.get(movesKey);
    if (cached) cached.ply = ply;
    setContinuationLoading(false);
    setContinuationError(null);
    setContinuationPreviewIndex(null);
  }

  function showPlayedMove() {
    if (!selected) return;

    playLine([uciMove(selected.uci)]);
    setShowingCorrectMove(false);
    setContinuationPreviewIndex(null);
    setHighlightedBestMove(null);
  }

  function showAlternative(uci: string) {
    // The engine's pick is the move from the game: the board already shows it, or goes back to it.
    if (selected && uci === selected.uci) {
      if (!showingPlayedMove) showPlayedMove();
      return;
    }

    playLine([uciMove(uci)]);
    setShowingCorrectMove(false);
    setContinuationPreviewIndex(null);
    setHighlightedBestMove(uci);
  }

  function showContinuationMove(index: number) {
    if (!selected || !continuation) return;

    playLine(sanLine(selected.fenBefore, continuation.moves.slice(0, index + 1)));
    setShowingCorrectMove(false);
    setHighlightedBestMove(null);
    setContinuationPreviewIndex(index);
  }

  /** Continues the game from the clicked best-continuation move. */
  function playFromContinuation() {
    if (!selected || !continuation || continuationPreviewIndex === null) {
      return;
    }

    const continuationGame: ReviewContinuation = {
      moves: [
        ...reviews.slice(0, selected.ply - 1).map((review) => review.san),
        ...continuation.moves.slice(0, continuationPreviewIndex + 1),
      ],
      name: continuationGameName(selected.moveNumber),
    };

    stopBoardEffects();

    if (onPlayFromPosition) {
      onPlayFromPosition(continuationGame);
      return;
    }

    storePendingContinuation(continuationGame);
    onClose();
    navigate(HOTSEAT_PATH);
  }

  function showCorrectMove() {
    if (!selected || !winningMove) {
      return;
    }

    const violet = qualityColor("Missed Win");

    // The played piece walks back home, the winning piece is marked, then it moves.
    playLine([winningMove], {
      icon: { square: winningMove.from, quality: "Missed Win" },
      marks: [{ square: winningMove.from, kind: "outline", color: violet, opacity: 0.95 }],
      arrows: [],
    });
    setShowingCorrectMove(true);
    setContinuationPreviewIndex(null);
    setHighlightedBestMove(null);
  }

  function togglePlayback() {
    if (playing) {
      setPlaying(false);
      return;
    }

    if (selectedPly >= reviews.length) {
      selectReviewMove(0, true);
    }

    setPlaying(true);
  }

  useEffect(() => {
    if (!playing) {
      return;
    }

    if (selectedPly >= reviews.length) {
      return;
    }

    const timer = window.setTimeout(() => {
      selectReviewMove(selectedPly + 1, true);

      if (selectedPly + 1 >= reviews.length) {
        setPlaying(false);
      }
    }, playbackDelay(playbackSpeed));

    return () => window.clearTimeout(timer);
    // selectReviewMove reads the same render's state.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [playing, selectedPly, reviews.length, playbackSpeed]);

  function showSimpleReview() {
    setDetailsOpen(false);

    if (sortKey === "loss") {
      setSortKey("move");
      setSortDirection("asc");
    }
  }

  /* =======================================================
     SELECTED POSITION CONTINUATION
     ======================================================= */

  async function loadContinuation() {
    if (!selected || continuationLoading || analyzing || reviewing) {
      return;
    }

    // Reuse the review's own top line so the eval matches the first alternative.
    const reviewedLine = selected.bestMoves[0];

    if (reviewedLine?.pv?.length) {
      continuationGenerationRef.current++;
      setContinuationPreviewIndex(null);
      setContinuationError(null);
      setContinuation({
        evaluation: reviewedLine.evaluation,
        moves: pvToSan(selected.fenBefore, reviewedLine.pv.slice(0, 8)),
      });
      return;
    }

    if (!ready) {
      return;
    }

    const generation = ++continuationGenerationRef.current;

    setContinuationLoading(true);
    setContinuation(null);
    setContinuationPreviewIndex(null);
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
      <aside className="flex h-full min-h-0 flex-col overflow-hidden rounded-[1.35rem] max-xl:max-h-[75dvh] border border-amber-100/[0.08] bg-[linear-gradient(145deg,rgba(9,18,28,.88),rgba(5,10,16,.86))] shadow-lg shadow-black/15">
        <div className="shrink-0 border-b border-white/10 px-3 py-2.5">
          <div className="flex items-center justify-between gap-3">
            <div>
              <h3 className="font-serif text-base font-semibold text-[#eee0c5]">{ui("Move Review")}</h3>
              <p className="mt-0.5 text-[10px] text-zinc-500">{ui("Filter, sort and inspect every move")}</p>
            </div>

            <div className="flex items-center gap-1.5">
              <span className="rounded-full bg-white/5 px-2 py-0.5 text-[9px] font-bold text-zinc-500">
                {gameUi(filteredReviews.length)}/{gameUi(reviewRows.length)}
              </span>
            </div>
          </div>

          {/* SIDE */}

          <div className="mt-2 grid grid-cols-3 gap-1 rounded-lg border border-white/5 bg-black/25 p-0.5" role="group" aria-label={ui("Moves to show")}>
            {sideOptions.map((option) => (
              <button
                key={option.key}
                type="button"
                aria-pressed={sideFilter === option.key}
                onClick={() => setSideFilter(option.key)}
                className={`flex items-center justify-center gap-1 rounded-md px-1.5 py-1 text-[9px] font-black transition ${
                  sideFilter === option.key
                    ? "bg-[#fff3d5]/[0.12] text-[#f6e6c6] shadow-inner"
                    : "text-zinc-500 hover:bg-white/5 hover:text-zinc-300"
                }`}
              >
                {gameUi(option.key !== "all" && (
                  <span
                    aria-hidden="true"
                    className={`h-2 w-2 rounded-full border ${option.key === "w" ? "border-white/60 bg-zinc-100" : "border-zinc-500 bg-zinc-900"}`}
                  />
                ))}
                {ui(option.label)}
              </button>
            ))}
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
                {ui(preset.label)}
              </button>
            ))}
          </div>

          {/* COMPACT FILTERS */}

          <div className="mt-2 grid grid-cols-2 gap-1.5">
            <FilterSelect
              label={ui("Figure")}
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
              label={ui("Review")}
              value={qualityFilter}
              onChange={(value) => setQualityFilter(value as QualityFilter)}
              options={[
                ["all", "All"],
                ...[...qualityList, "Missed Win"].map(
                  (quality) => [quality, ui(quality)] as [string, string],
                ),
              ]}
            />

            <FilterSelect
              label={ui("Move Type")}
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
              label={ui("Phase")}
              value={phaseFilter}
              onChange={(value) => setPhaseFilter(value as PhaseFilter)}
              options={[
                ["all", "All"],
                ["Opening", "Opening"],
                ["Middlegame", "Middlegame"],
                ["Endgame", "Endgame"],
              ]}
            />

            <FilterSelect
              label={ui("Sort")}
              value={sortKey}
              onChange={(value) => setSortKey(value as SortKey)}
              options={[
                ["move", "Move order"],
                ["piece", "Figure"],
                ["quality", "Review"],
                ...(showLoss ? [["loss", "Loss"] as [string, string]] : []),
              ]}
            />

            <div className="flex items-end">
              <button
                type="button"
                onClick={resetFilters}
                className="w-full rounded-lg border border-white/10 bg-white/5 px-1.5 py-1.5 text-[9px] font-bold text-zinc-400 transition hover:bg-white/10 hover:text-white"
              >{ui("Reset")}</button>
            </div>
          </div>
        </div>

        {/* TABLE */}

        <div className="min-h-0 flex-1 overflow-y-auto">
          {pairedReviews ? (
            <table className="w-full table-fixed border-collapse text-left">
              <thead className="sticky top-0 z-10 bg-[#081019]/95">
                <tr className="border-b border-white/5 text-[8px] font-black uppercase tracking-wider text-zinc-600">
                  <SortableHeader
                    label={ui("#")}
                    active
                    direction={sortDirection}
                    onClick={() => changeSort("move")}
                    className="w-9 px-2"
                  />
                  <th className="px-1.5 py-2">
                    <span className="inline-flex items-center gap-1">
                      <span aria-hidden="true" className="h-2 w-2 rounded-full border border-white/60 bg-zinc-100" />
                      {ui("White")}
                    </span>
                  </th>
                  <th className="px-1.5 py-2">
                    <span className="inline-flex items-center gap-1">
                      <span aria-hidden="true" className="h-2 w-2 rounded-full border border-zinc-500 bg-zinc-900" />
                      {ui("Black")}
                    </span>
                  </th>
                </tr>
              </thead>

              <tbody>
                {gameUi(pairedReviews.length === 0 ? (
                  <tr>
                    <td colSpan={3} className="px-4 py-8 text-center">
                      <div className="text-2xl text-zinc-700">♟</div>
                      <p className="mt-2 text-[10px] font-semibold text-zinc-500">{ui("No matching moves")}</p>
                      <button
                        type="button"
                        onClick={resetFilters}
                        className="mt-2 text-[10px] font-bold text-amber-300 hover:text-amber-200"
                      >{ui("Clear filters")}</button>
                    </td>
                  </tr>
                ) : (
                  pairedReviews.map((pair) => (
                    <tr key={pair.moveNumber} className="border-b border-white/5 last:border-0">
                      <td className="px-2 py-1.5 text-[10px] text-zinc-600">{gameUi(pair.moveNumber)}.</td>
                      {[pair.white, pair.black].map((row, index) => (
                        <td key={index} className="px-1 py-1">
                          {gameUi(row && (
                            <PairedReviewCell
                              row={row}
                              quality={displayQuality(row)}
                              selected={selectedPly === row.review.ply}
                              showLoss={showLoss}
                              onSelect={() => selectReviewMove(row.review.ply)}
                            />
                          ))}
                        </td>
                      ))}
                    </tr>
                  ))
                ))}
              </tbody>
            </table>
          ) : (
            <table className="w-full border-collapse text-left">
              <thead className="sticky top-0 z-10 bg-[#081019]/95">
                <tr className="border-b border-white/5 text-[8px] font-black uppercase tracking-wider text-zinc-600">
                  <SortableHeader
                    label={ui("#")}
                    active={sortKey === "move"}
                    direction={sortDirection}
                    onClick={() => changeSort("move")}
                    className="px-2"
                  />

                  <SortableHeader
                    label={ui("Figure")}
                    active={sortKey === "piece"}
                    direction={sortDirection}
                    onClick={() => changeSort("piece")}
                  />

                  <th className="px-1.5 py-2">{ui("Played")}</th>

                  <SortableHeader
                    label={ui("Review")}
                    active={sortKey === "quality"}
                    direction={sortDirection}
                    onClick={() => changeSort("quality")}
                  />

                  {gameUi(showLoss && (
                    <SortableHeader
                      label={ui("Loss")}
                      active={sortKey === "loss"}
                      direction={sortDirection}
                      onClick={() => changeSort("loss")}
                    />
                  ))}
                </tr>
              </thead>

              <tbody>
                {filteredReviews.length === 0 ? (
                  <tr>
                    <td
                      colSpan={showLoss ? 5 : 4}
                      className="px-4 py-8 text-center"
                    >
                      <div className="text-2xl text-zinc-700">♟</div>

                      <p className="mt-2 text-[10px] font-semibold text-zinc-500">{ui("No matching moves")}</p>

                      <button
                        type="button"
                        onClick={resetFilters}
                        className="mt-2 text-[10px] font-bold text-amber-300 hover:text-amber-200"
                      >{ui("Clear filters")}</button>
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
                            ? "bg-amber-300/[0.075]"
                            : "hover:bg-amber-100/[0.025]"
                        }`}
                      >
                        <td className="px-2 py-2 text-[10px] text-zinc-600">
                          {gameUi(review.moveNumber)}
                          {gameUi(review.color === "w" ? "." : "...")}
                        </td>

                        <td className="px-1.5 py-2">
                          {gameUi(pieceType ? (
                            <div className="flex items-center gap-1">
                              <span className="w-5 text-center text-lg leading-none">
                                {gameUi(pieceSymbols[review.color][pieceType])}
                              </span>

                              <span className="hidden text-[8px] text-zinc-600 2xl:inline">
                                {gameUi(pieceNames[pieceType])}
                              </span>
                            </div>
                          ) : (
                            <span className="text-zinc-700">·</span>
                          ))}
                        </td>

                        <td className="px-1.5 py-2">
                          <p className="font-mono text-xs font-bold text-zinc-200">
                            {gameUi(review.san)}
                          </p>

                          <div className="mt-0.5 flex flex-wrap gap-1">
                            <span className="text-[7px] text-zinc-600">
                              {gameUi(row.phase)}
                            </span>

                            {row.moveTags.slice(0, 2).map((tag) => (
                              <span
                                key={tag}
                                className="text-[7px] text-zinc-700"
                              >
                                · {gameUi(formatMoveTag(tag))}
                              </span>
                            ))}
                          </div>
                        </td>

                        <td className="px-1.5 py-2">
                          <QualityBadge quality={displayQuality(row)} />
                        </td>

                        {gameUi(showLoss && (
                          <td className="px-1.5 py-2 text-[9px] font-bold text-zinc-500">
                            {gameUi((review.centipawnLoss / 100).toFixed(2))}
                          </td>
                        ))}
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          )}
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

  /*
   * The review is a page of its own: it covers the whole app viewport, and
   * below xl it scrolls like a normal page. It is portalled out of the game
   * page because game pages are horizontally translated, which would anchor
   * this fixed layer to the page instead of the screen (the game showed first).
   */
  const reviewPage = (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={ui("Game Review")}
      className="
        fixed
        inset-x-0
        bottom-0
        top-[var(--public-header-height)]
        z-[100]
        overflow-y-auto
        overflow-x-hidden
        overscroll-contain
        bg-[#03070c]
        xl:overflow-hidden
      "
    >
      <div
        className="
          relative
          isolate
          flex
          min-h-full
          w-full
          flex-col
          bg-[radial-gradient(circle_at_50%_0%,rgba(126,88,37,.12),transparent_34%),linear-gradient(145deg,rgba(5,10,16,.985),rgba(3,7,12,.98))]
          xl:h-full
          xl:overflow-hidden
        "
      >
        <div className="pointer-events-none absolute inset-0 -z-10 overflow-hidden">
          <div className="absolute -right-20 -top-32 select-none font-serif text-[27rem] leading-none text-amber-100/[0.018]">
            ♞
          </div>
          <div className="absolute inset-x-[8%] top-0 h-px bg-gradient-to-r from-transparent via-amber-200/25 to-transparent" />
          <div className="absolute left-1/2 top-0 h-64 w-[65%] -translate-x-1/2 bg-[radial-gradient(ellipse_at_top,rgba(190,139,72,.08),transparent_68%)]" />
        </div>

        {/* HEADER */}

        {/* z-20: the Audio / Appearance menus drop down over the review body. */}
        <ChessPageHeader className="relative z-20 flex shrink-0 items-center justify-between border-b border-amber-100/[0.08] bg-[#08111b]/88 px-3 py-2.5 sm:px-5 sm:py-3.5" title={gameUi("Game Review")}>


          <div className="flex items-center gap-2">
            {gameUi(reviews.length > 0 && (
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
                    ? "border-amber-300/25 bg-amber-300/[0.07] text-amber-200 hover:bg-amber-300/[0.12]"
                    : "border-white/[0.08] bg-white/[0.035] text-zinc-400 hover:border-amber-200/15 hover:bg-amber-200/[0.05] hover:text-[#f3e7cf]"
                }`}
              >
                {gameUi(detailsOpen ? ui("← Simple") : ui("Details"))}
              </button>
            ))}

            <button
              type="button"
              onClick={onClose}
              className="flex h-9 w-9 items-center justify-center rounded-xl border border-white/[0.08] bg-black/20 text-xl text-zinc-500 transition hover:border-amber-200/15 hover:bg-amber-200/[0.05] hover:text-[#f3e7cf]"
            >
              ×
            </button>
          </div>
        </ChessPageHeader>

        {gameUi((trainingPuzzleStatus || reviews.length > 0) && (
          <div className="mx-3 mt-3 flex shrink-0 flex-col gap-2 sm:mx-4 lg:flex-row lg:items-stretch">
            {gameUi(trainingPuzzleStatus && (
              <div className="flex items-center rounded-2xl border border-amber-300/15 bg-[linear-gradient(135deg,rgba(111,76,32,.14),rgba(7,14,22,.68))] px-4 py-2 text-xs leading-5 text-amber-100/80 shadow-inner shadow-black/20 lg:w-[34%] lg:max-w-[520px] lg:shrink-0">
                <span className="mr-2 shrink-0 text-amber-300">✦</span>
                <span className="min-w-0">{gameUi(trainingPuzzleStatus)}</span>
              </div>
            ))}

            {gameUi(reviews.length > 0 && (
              <ReviewPlaybackBar
                rows={reviewRows}
                ply={selectedPly}
                playing={playing}
                speed={playbackSpeed}
                onSpeedChange={setPlaybackSpeed}
                onTogglePlay={togglePlayback}
                onSeek={(ply) => selectReviewMove(Math.max(0, Math.min(reviews.length, ply)))}
              />
            ))}
          </div>
        ))}

        {/* BEFORE ANALYSIS */}

        {reviews.length === 0 ? (
          <div className="min-h-0 flex-auto px-3 py-4 sm:px-7 sm:py-6 lg:px-9 xl:flex-1 xl:overflow-y-auto">
            <section className="relative mx-auto flex min-h-full max-w-7xl items-center overflow-hidden rounded-[2.1rem] border border-amber-100/[0.10] bg-[linear-gradient(145deg,rgba(10,20,31,.88),rgba(4,9,15,.94))] p-6 shadow-[0_28px_80px_rgba(0,0,0,.30)] sm:p-8 lg:p-10">
              <div className="pointer-events-none absolute -right-10 -top-20 font-serif text-[18rem] leading-none text-amber-100/[0.025]">
                ♞
              </div>
              <div className="pointer-events-none absolute left-[12%] top-0 h-48 w-[60%] bg-[radial-gradient(ellipse_at_top,rgba(201,146,70,.08),transparent_70%)]" />

              <div className="relative mx-auto w-full max-w-6xl">
                <p className="text-[9px] font-black uppercase tracking-[0.30em] text-amber-300/75">{ui("Complete Game Analysis")}</p>

                <h3 className="mt-2 max-w-3xl font-serif text-3xl font-semibold tracking-tight text-[#f4e8d1] sm:text-4xl lg:text-[2.7rem] lg:leading-[1.08]">{ui("Turn the game you just played into something you can learn from.")}</h3>

                <p className="mt-4 max-w-3xl text-sm leading-6 text-zinc-500">{ui("Every move is reviewed with Stockfish, including the three strongest alternatives, evaluation loss, critical moments, and missed opportunities.")}</p>

                <div className="mt-6 grid gap-2 sm:grid-cols-3">
                  <div className="rounded-2xl border border-white/[0.06] bg-black/20 p-3.5">
                    <p className="text-[8px] font-black uppercase tracking-wider text-zinc-700">{ui("Moves")}</p>
                    <p className="mt-1 font-serif text-2xl font-semibold text-[#eadbbc]">
                      {gameUi(moves.length)}
                    </p>
                  </div>

                  <div className="rounded-2xl border border-white/[0.06] bg-black/20 p-3.5">
                    <p className="text-[8px] font-black uppercase tracking-wider text-zinc-700">{ui("Review")}</p>
                    <p className="mt-1 text-xs font-black text-zinc-300">{ui("Best moves · mistakes · blunders")}</p>
                  </div>

                  <div className="rounded-2xl border border-white/[0.06] bg-black/20 p-3.5">
                    <p className="text-[8px] font-black uppercase tracking-wider text-zinc-700">{ui("Training")}</p>
                    <p className="mt-1 text-xs font-black text-zinc-300">{ui("Personal puzzle when eligible")}</p>
                  </div>
                </div>

                <div className="mt-6 rounded-[1.6rem] border border-amber-300/18 bg-[linear-gradient(135deg,rgba(97,66,29,.14),rgba(5,12,19,.66))] p-4 sm:p-5">
                  <div className="flex items-start gap-3">
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl border border-amber-300/20 bg-amber-300/[0.08] text-lg text-amber-200">
                      ?
                    </div>

                    <div className="min-w-0">
                      <p className="text-[9px] font-black uppercase tracking-[0.24em] text-amber-300/75">{ui("Did you know?")}</p>

                      {gameUi(puzzleSource ? (
                        <>
                          <h4 className="mt-1 font-serif text-lg font-semibold text-[#f2e4c9]">{ui("You have to press “Analyse Game” to create your personal puzzle.")}</h4>

                          <p className="mt-2 max-w-4xl text-xs leading-5 text-zinc-400">{ui("Let the analysis finish. Afterwards, your biggest meaningful missed opportunity is turned into one private training position under")}{gameUi(" ")}
                            <strong className="text-violet-200">{ui("Puzzles → My Games")}</strong>
                            .
                          </p>

                          <div className="mt-3 flex flex-wrap items-center gap-2">
                            <span
                              className={`h-2 w-2 rounded-full ${
                                puzzleSource === "singleplayer"
                                  ? "bg-sky-300"
                                  : "bg-violet-300"
                              }`}
                            />

                            <span className="rounded-full border border-white/[0.07] bg-black/20 px-2.5 py-1 text-[9px] font-black text-zinc-300">
                              {gameUi(puzzleSource === "singleplayer" ? ui("From your Singleplayer game") : ui("From your Multiplayer game"))}
                            </span>

                            <span className="text-[9px] text-zinc-600">{ui("No puzzle is created before the analysis finishes.")}</span>
                          </div>

                          <label className="mt-4 block max-w-xl">
                            <span className="text-[9px] font-black uppercase tracking-[0.16em] text-zinc-600">{ui("Puzzle name")}</span>
                            <input
                              type="text"
                              value={puzzleName}
                              maxLength={80}
                              onChange={(event) =>
                                setPuzzleName(event.target.value)
                              }
                              placeholder={gameUi(defaultPersonalPuzzleName(
                                puzzleSource,
                              ))}
                              className="mt-1.5 w-full rounded-xl border border-white/[0.08] bg-black/25 px-3 py-2.5 text-sm font-semibold text-[#f1e4ca] outline-none transition placeholder:text-zinc-700 focus:border-amber-300/35 focus:bg-black/35"
                            />
                            <span className="mt-1.5 block text-[9px] leading-4 text-zinc-700">{ui("Suggested convention: mode · date · time. You can replace it with any memorable name before analysis.")}</span>
                          </label>

                          {gameUi(!user && (
                            <p className="mt-3 rounded-xl border border-rose-400/15 bg-rose-400/[0.05] px-3 py-2 text-xs text-rose-200/80">{ui("Sign in before analysing if you want the personal puzzle saved to your account.")}</p>
                          ))}
                        </>
                      ) : (
                        <>
                          <h4 className="mt-1 font-serif text-lg font-semibold text-[#f2e4c9]">{ui("Personal puzzles are available for Singleplayer and Multiplayer games.")}</h4>
                          <p className="mt-2 text-xs leading-5 text-zinc-500">{ui("Hotseat Game Review can still analyse the game, but it never creates a personal training puzzle.")}</p>
                        </>
                      ))}
                    </div>
                  </div>
                </div>

                {gameUi(error && (
                  <p className="mt-4 rounded-xl border border-red-400/20 bg-red-400/[0.06] px-3 py-2 text-sm text-red-200">
                    {ui(error)}
                  </p>
                ))}

                <div className="mt-7 flex flex-wrap items-center gap-4">
                  <button
                    type="button"
                    disabled={
                      !ready || reviewing || analyzing || moves.length === 0
                    }
                    onClick={runReview}
                    className="inline-flex min-w-52 items-center justify-center gap-2 rounded-2xl border border-amber-200/25 bg-[linear-gradient(180deg,rgba(245,190,92,.98),rgba(207,145,53,.96))] px-8 py-4 text-sm font-black text-[#161007] shadow-[0_12px_30px_rgba(190,126,40,.18)] transition hover:-translate-y-0.5 hover:brightness-105 disabled:translate-y-0 disabled:cursor-wait disabled:opacity-40"
                  >
                    {gameUi(reviewing ? (
                      <>
                        <span className="inline-block h-3.5 w-3.5 animate-spin rounded-full border-2 border-[#161007]/25 border-t-[#161007]" />{ui("Analyzing")}{gameUi(progress)}/{gameUi(moves.length)}
                      </>
                    ) : (
                      <>
                        <span>✦</span>{ui("Analyse Game")}</>
                    ))}
                  </button>

                  <p className="text-[10px] leading-4 text-zinc-700">{ui("Keep this window open until the analysis has finished.")}</p>
                </div>
              </div>
            </section>
          </div>
        ) : detailsOpen ? (
          <div className="grid min-h-0 flex-auto auto-rows-max gap-2 bg-[radial-gradient(circle_at_50%_12%,rgba(176,126,61,.035),transparent_28%)] p-3 sm:p-4 xl:flex-1 xl:auto-rows-auto xl:grid-cols-[330px_minmax(0,1fr)_460px] xl:overflow-hidden">
            {/* ===============================================
                LEFT — WHITE SUMMARY + EDUCATIONAL DETAILS
               =============================================== */}

            <div className="flex min-h-0 flex-col gap-3">
              {/* ===============================================
                    LEFT SIDEBAR — EDUCATIONAL DETAILS
                   =============================================== */}

              <aside className="min-h-0 flex-1 overflow-y-auto rounded-2xl border border-white/10 bg-[#09121c]/78 p-4">
                <details className="mb-4 rounded-xl border border-white/10 bg-white/[.035] p-3"><summary className="cursor-pointer text-xs font-bold text-[#f2e4c9]">{ui("Move quality legend")}</summary><div className="mt-3 grid grid-cols-2 gap-2">{(["Book", "Best", "Excellent", "Good", "Inaccuracy", "Mistake", "Blunder", "Missed Win"] as ReviewVisualQuality[]).map(quality => <QualityBadge key={quality} quality={quality} />)}</div></details>
                {selected && selectedRow && (
                  <>
                    <CurrentMoveButton
                      review={selected}
                      quality={displayQuality(selectedRow)}
                      active={showingPlayedMove}
                      onClick={showPlayedMove}
                    />
                    {selected.openingName && <p className="mt-2 text-xs font-semibold text-purple-300">{gameUi(selected.openingName)}</p>}

                    {winningMove && (
                      <CorrectMoveButton
                        san={winningMove.san}
                        showing={showingCorrectMove}
                        onClick={showingCorrectMove ? showPlayedMove : showCorrectMove}
                      />
                    )}

                    <div className="mt-3 flex flex-wrap gap-1.5">
                      <PhaseBadge phase={selectedRow.phase} />

                      {selectedRow.moveTags.map((tag) => (
                        <MoveTagBadge key={tag} tag={tag} />
                      ))}
                    </div>

                    <div className="mt-2 rounded-xl bg-black/20 p-3">
                      <div className="flex items-center justify-between gap-3">
                        <span className="text-xs text-zinc-500">{ui("Evaluation loss")}</span>

                        <strong className="text-sm text-zinc-200">
                          {gameUi((selected.centipawnLoss / 100).toFixed(2))}</strong>
                      </div>

                      {gameUi(selectedRow.criticalLabel && (
                        <div className="mt-2 rounded-lg border border-orange-400/20 bg-orange-400/[0.07] px-2.5 py-2 text-xs font-bold text-orange-300">
                          ⚠ {gameUi(selectedRow.criticalLabel)}
                        </div>
                      ))}

                      {gameUi(selectedRow.missedOpportunity && (
                        <p className="mt-2 text-xs leading-5 text-zinc-400">
                          {gameUi(selectedRow.missedOpportunity)}
                        </p>
                      ))}
                    </div>

                    {/* EDUCATIONAL EXPLANATION */}

                    <div className="mt-5">
                      <p className="text-[9px] font-black uppercase tracking-[0.18em] text-amber-200/45">{ui("What happened?")}</p>

                      <div className="mt-2 space-y-2 rounded-xl border border-white/5 bg-black/20 p-3">
                        {buildEducationBullets(selectedRow).map(
                          (bullet, index) => (
                            <div
                              key={`${bullet}-${index}`}
                              className="flex gap-2 text-xs leading-5"
                            >
                              <span className="mt-0.5 text-amber-400">•</span>
                              <span className="text-zinc-400">{gameUi(bullet)}</span>
                            </div>
                          ),
                        )}
                      </div>
                    </div>

                    {/* MATERIAL */}

                    {gameUi((selectedRow.capturedPiece ||
                      selectedRow.promotionGain > 0) && (
                      <div className="mt-4 rounded-xl border border-white/5 bg-black/20 p-3">
                        <p className="text-[9px] font-black uppercase tracking-wider text-zinc-600">{ui("Material Change")}</p>

                        {gameUi(selectedRow.capturedPiece && (
                          <p className="mt-2 text-xs text-zinc-300">{ui("Captured")}{gameUi(pieceNames[selectedRow.capturedPiece])} (+
                            {gameUi(selectedRow.materialGain)})
                          </p>
                        ))}

                        {gameUi(selectedRow.promotionGain > 0 && (
                          <p className="mt-1 text-xs text-zinc-300">{ui("Promotion gain +")}{gameUi(selectedRow.promotionGain)}
                          </p>
                        ))}
                      </div>
                    ))}

                    {/* TOP 3 */}

                    <div className="mt-5">
                      <p className="text-[10px] font-black uppercase tracking-widest text-amber-400">{ui("Best 3 Choices")}</p>

                      <div className="mt-3 space-y-2">
                        {selected.bestMoves.map((suggestion, index) => (
                          <AlternativeMoveButton
                            key={`${suggestion.uci}-${index}`}
                            index={index}
                            san={suggestion.san}
                            evaluation={suggestion.evaluation}
                            quality={alternativeQuality(selected.bestMoves, index)}
                            played={suggestion.uci === selected.uci}
                            active={suggestion.uci === selected.uci ? showingPlayedMove : highlightedBestMove === suggestion.uci}
                            onClick={() => showAlternative(suggestion.uci)}
                          />
                        ))}
                      </div>
                    </div>

                    {/* SELECTED CONTINUATION */}

                    <div className="mt-5 rounded-xl border border-white/5 bg-black/20 p-3">
                      <div className="flex items-center justify-between gap-3">
                        <div>
                          <p className="text-[9px] font-black uppercase tracking-[0.18em] text-amber-200/45">{ui("Best Continuation")}</p>
                          <p className="mt-1 text-[10px] text-zinc-600">{ui("Click a continuation move to preview it on the board")}</p>
                        </div>

                        {gameUi(!continuation && (
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
                            {gameUi(continuationLoading ? ui("Analyzing...") : ui("Show"))}
                          </button>
                        ))}
                      </div>

                      {gameUi(continuation && (
                        <div className="mt-3">
                          <div className="flex items-center justify-between">
                            <span className="text-[10px] text-zinc-600">{ui("Engine eval")}</span>
                            <span className="text-xs font-bold text-zinc-300">
                              {gameUi(continuation.evaluation)}
                            </span>
                          </div>

                          <div className="mt-3 rounded-lg border border-white/5 bg-black/15 p-2.5">
                            <p className="text-[9px] leading-4 text-zinc-600">{ui("Read from left to right. Each move alternates between the two players, starting with the side whose turn it is in this position.")}</p>

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
                                    {gameUi(index > 0 && (
                                      <span className="text-[10px] font-black text-zinc-700">
                                        →
                                      </span>
                                    ))}

                                    <button
                                      type="button"
                                      onClick={() => showContinuationMove(index)}
                                      className={`inline-flex items-center gap-1.5 rounded-lg border px-2 py-1 text-left transition ${
                                        continuationPreviewIndex === index
                                          ? "border-yellow-300/45 bg-yellow-300/15 text-yellow-100"
                                          : moveColor === "w"
                                            ? "border-[#fff3d5]/15 bg-[#fff3d5]/8 text-[#fff3d5] hover:border-yellow-300/25 hover:bg-yellow-300/[0.07]"
                                            : "border-white/5 bg-white/5 text-zinc-400 hover:border-yellow-300/25 hover:bg-yellow-300/[0.07]"
                                      }`}
                                    >
                                      <span className="text-[10px]">
                                        {gameUi(moveColor === "w" ? "♔" : "♚")}
                                      </span>

                                      <span className="text-[8px] font-black uppercase tracking-wide">
                                        {gameUi(moveColor === "w" ? ui("White") : ui("Black"))}
                                      </span>

                                      <span className="font-mono text-[11px] font-bold text-zinc-200">
                                        {gameUi(move)}
                                      </span>
                                    </button>
                                  </div>
                                );
                              })}
                            </div>
                          </div>
                        </div>
                      ))}

                      {gameUi(continuationError && (
                        <p className="mt-2 text-xs text-red-300">
                          {gameUi(continuationError)}
                        </p>
                      ))}
                    </div>

                    {/* PIECE PERFORMANCE */}

                    <div className="mt-5">
                      <p className="text-[9px] font-black uppercase tracking-[0.18em] text-amber-200/45">
                        {gameUi(selected.color === "w" ? ui("White") : ui("Black"))}{ui("Piece Performance")}</p>

                      <div className="mt-2 space-y-1.5">
                        {selectedSidePiecePerformance.map((performance) => (
                          <div
                            key={performance.piece}
                            className="grid grid-cols-[32px_1fr_auto] items-center gap-2 rounded-lg bg-black/20 px-2.5 py-2"
                          >
                            <span className="text-center text-xl">
                              {gameUi(pieceSymbols[selected.color][performance.piece])}
                            </span>

                            <div>
                              <p className="text-xs font-bold text-zinc-300">
                                {gameUi(pieceNames[performance.piece])}
                              </p>
                              <p className="text-[9px] text-zinc-600">
                                {gameUi(performance.moves)}{ui(" moves · ")}{gameUi(performance.best)}{gameUi(" ")}{ui("best ·")}{gameUi(performance.mistakes)}{ui("errors")}</p>
                            </div>

                            <span className="text-[10px] font-bold text-zinc-500">
                              {gameUi(performance.acpl)}{ui("ACPL")}</span>
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* PHASE PERFORMANCE */}

                    <div className="mt-5">
                      <p className="text-[9px] font-black uppercase tracking-[0.18em] text-amber-200/45">{ui("Phase Performance")}</p>

                      <div className="mt-2 grid gap-2">
                        {selectedSidePhasePerformance.map((performance) => (
                          <div
                            key={performance.phase}
                            className="rounded-lg bg-black/20 px-3 py-2"
                          >
                            <div className="flex items-center justify-between gap-2">
                              <span className="text-xs font-bold text-zinc-300">
                                {gameUi(performance.phase)}
                              </span>

                              <span className="text-[10px] text-zinc-500">
                                {gameUi(performance.acpl)}{ui("ACPL")}</span>
                            </div>

                            <div className="mt-1 flex items-center justify-between text-[9px] text-zinc-600">
                              <span>{gameUi(performance.moves)}{ui(" moves")}</span>
                              <span>
                                {gameUi(performance.goodOrBetterPercent)}{ui("% good-or-better")}</span>
                            </div>
                          </div>
                        ))}
                      </div>

                      <p className="mt-2 text-[9px] leading-4 text-zinc-700">{ui("Opening / middlegame / endgame is classified heuristically from move number and remaining material.")}</p>
                    </div>
                  </>
                )}
              </aside>
            </div>

            {/* ===============================================
                CENTER — BOARD
               =============================================== */}

            <div className="order-first flex min-h-0 flex-col gap-3 xl:order-none">
              <main className="flex min-h-0 flex-1 items-center justify-center overflow-hidden px-1 py-1 xl:px-0">
                <div className="w-full max-w-[min(100%,calc(var(--app-height)-15.5rem))]">
                  <Board
                    board={board}
                    annotations={selectedAnnotations}
                    selectedSquare={null}
                    legalMoves={[]}
                    lastMove={boardLastMove}
                    checkedKingSquare={checkedKingSquare}
                    onSquareClick={() => {}}
                    orientation={orientation}
                    pieceScale={1.1}
                    moveAnimation={moveAnimation}
                  />

                  {gameUi(continuationMove && selected && (
                    <div className="mt-2 flex flex-col items-center gap-2 rounded-xl border border-yellow-300/20 bg-yellow-300/[0.07] px-3 py-2 text-center text-xs text-yellow-100/85 sm:flex-row sm:justify-between sm:text-left">
                      <span>{ui("Continuation preview · the yellow squares show the move you clicked")}</span>
                      <button
                        type="button"
                        onClick={playFromContinuation}
                        className="inline-flex shrink-0 items-center gap-1.5 rounded-lg border border-amber-200/25 bg-[linear-gradient(180deg,rgba(245,190,92,.98),rgba(207,145,53,.96))] px-3 py-1.5 text-[11px] font-black text-[#161007] transition hover:brightness-105"
                      >
                        <Play size={12} aria-hidden="true" />
                        {ui("Play from here")}
                      </button>
                    </div>
                  ))}

                  {gameUi(!continuationMove && alternativeMove && selected && (
                    <div className="mt-2 rounded-xl border border-amber-400/20 bg-amber-400/[0.07] px-3 py-2 text-center text-xs text-amber-200">{ui("Showing Stockfish alternative instead of the played move")}</div>
                  ))}
                </div>
              </main>
            </div>

            {/* ===============================================
                RIGHT — WHITE MOVE REVIEW
               =============================================== */}

            <div className="min-h-0">{gameUi(renderMoveReviewPanel(true))}</div>
          </div>
        ) : (
          <div className="grid min-h-0 flex-auto auto-rows-max gap-2 bg-[radial-gradient(circle_at_50%_12%,rgba(176,126,61,.035),transparent_28%)] p-3 sm:p-4 xl:flex-1 xl:auto-rows-auto xl:grid-cols-[290px_minmax(0,1fr)_450px] xl:overflow-hidden">
            {/* ===============================================
                SIMPLE — CURRENT MOVE
               =============================================== */}

            <aside className="min-h-0 overflow-y-auto rounded-2xl border border-white/10 bg-[#09121c]/78 p-4">
              {selected && (
                <>
                  <CurrentMoveButton
                    review={selected}
                    quality={selectedRow ? displayQuality(selectedRow) : selected.quality}
                    active={showingPlayedMove}
                    onClick={showPlayedMove}
                  />

                  {winningMove && (
                    <CorrectMoveButton
                      san={winningMove.san}
                      showing={showingCorrectMove}
                      onClick={showingCorrectMove ? showPlayedMove : showCorrectMove}
                    />
                  )}

                  <div className="mt-4 rounded-xl bg-black/20 p-3 text-xs text-zinc-500">{ui("Evaluation loss")}{gameUi(" ")}
                    <strong className="text-zinc-200">
                      {gameUi((selected.centipawnLoss / 100).toFixed(2))}</strong>
                  </div>

                  <div className="mt-5">
                    <p className="text-[10px] font-black uppercase tracking-widest text-amber-400">{ui("Best 3 Choices")}</p>

                    <div className="mt-3 space-y-2">
                      {selected.bestMoves.map((suggestion, index) => (
                          <AlternativeMoveButton
                            key={`${suggestion.uci}-${index}`}
                            index={index}
                            san={suggestion.san}
                            evaluation={suggestion.evaluation}
                            quality={alternativeQuality(selected.bestMoves, index)}
                            played={suggestion.uci === selected.uci}
                            active={suggestion.uci === selected.uci ? showingPlayedMove : highlightedBestMove === suggestion.uci}
                            onClick={() => showAlternative(suggestion.uci)}
                          />
                        ))}
                    </div>
                  </div>

                  {/* BEST CONTINUATION */}

                  <div className="mt-5 rounded-2xl border border-amber-100/[0.08] bg-[linear-gradient(145deg,rgba(9,18,28,.72),rgba(0,0,0,.22))] p-3.5">
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <p className="text-[9px] font-black uppercase tracking-[0.18em] text-amber-200/55">{ui("Best Continuation")}</p>
                        <p className="mt-1 text-[10px] text-zinc-600">{ui("Click a move to preview that position on the board")}</p>
                      </div>

                      {gameUi(!continuation && (
                        <button
                          type="button"
                          disabled={
                            continuationLoading ||
                            analyzing ||
                            reviewing ||
                            !ready
                          }
                          onClick={() => void loadContinuation()}
                          className="rounded-xl border border-amber-300/20 bg-amber-300/[0.08] px-3 py-1.5 text-[10px] font-black text-amber-200 transition hover:bg-amber-300/[0.13] disabled:opacity-40"
                        >
                          {gameUi(continuationLoading ? ui("Analyzing...") : ui("Show"))}
                        </button>
                      ))}
                    </div>

                    {gameUi(continuation && (
                      <div className="mt-3">
                        <div className="flex items-center justify-between">
                          <span className="text-[10px] text-zinc-600">{ui("Engine eval")}</span>
                          <span className="text-xs font-bold text-zinc-300">
                            {gameUi(continuation.evaluation)}
                          </span>
                        </div>

                        <div className="mt-3 rounded-xl border border-white/[0.06] bg-black/20 p-2.5">
                          <div className="flex flex-wrap items-center gap-1.5">
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
                                  {gameUi(index > 0 && (
                                    <span className="text-[10px] font-black text-zinc-700">
                                      →
                                    </span>
                                  ))}

                                  <button
                                    type="button"
                                    onClick={() => showContinuationMove(index)}
                                    className={`inline-flex items-center gap-1.5 rounded-lg border px-2 py-1 text-left transition ${
                                      continuationPreviewIndex === index
                                        ? "border-yellow-300/45 bg-yellow-300/15 text-yellow-100"
                                        : moveColor === "w"
                                          ? "border-[#fff3d5]/15 bg-[#fff3d5]/8 text-[#fff3d5] hover:border-yellow-300/25 hover:bg-yellow-300/[0.07]"
                                          : "border-white/5 bg-white/5 text-zinc-400 hover:border-yellow-300/25 hover:bg-yellow-300/[0.07]"
                                    }`}
                                  >
                                    <span className="text-[10px]">
                                      {gameUi(moveColor === "w" ? "♔" : "♚")}
                                    </span>
                                    <span className="font-mono text-[11px] font-bold text-zinc-200">
                                      {gameUi(move)}
                                    </span>
                                  </button>
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      </div>
                    ))}

                    {gameUi(continuationError && (
                      <p className="mt-2 text-xs text-red-300">
                        {gameUi(continuationError)}
                      </p>
                    ))}
                  </div>
                </>
              )}
            </aside>

            {/* ===============================================
                SIMPLE — BOARD
               =============================================== */}

            <main className="order-first flex min-h-0 items-center justify-center overflow-hidden px-1 xl:order-none xl:px-0">
              <div className="w-full max-w-[min(100%,calc(var(--app-height)-15.5rem))]">
                <Board
                  board={board}
                  annotations={selectedAnnotations}
                  selectedSquare={null}
                  legalMoves={[]}
                  lastMove={boardLastMove}
                  checkedKingSquare={checkedKingSquare}
                  onSquareClick={() => {}}
                  orientation={orientation}
                  pieceScale={1.2}
                  moveAnimation={moveAnimation}
                />

                {gameUi(continuationMove && selected && (
                  <div className="mt-2 flex flex-col items-center gap-2 rounded-xl border border-yellow-300/20 bg-yellow-300/[0.07] px-3 py-2 text-center text-xs text-yellow-100/85 sm:flex-row sm:justify-between sm:text-left">
                    <span>{ui("Continuation preview · the yellow squares show the move you clicked")}</span>
                    <button
                      type="button"
                      onClick={playFromContinuation}
                      className="inline-flex shrink-0 items-center gap-1.5 rounded-lg border border-amber-200/25 bg-[linear-gradient(180deg,rgba(245,190,92,.98),rgba(207,145,53,.96))] px-3 py-1.5 text-[11px] font-black text-[#161007] transition hover:brightness-105"
                    >
                      <Play size={12} aria-hidden="true" />
                      {ui("Play from here")}
                    </button>
                  </div>
                ))}

                {gameUi(!continuationMove && alternativeMove && selected && (
                  <div className="mt-2 rounded-xl border border-amber-400/20 bg-amber-400/[0.07] px-3 py-2 text-center text-xs text-amber-200">{ui("Showing Stockfish alternative instead of the played move")}</div>
                ))}
              </div>
            </main>

            {/* ===============================================
                SIMPLE — SAME MOVE REVIEW AS DETAILS
               =============================================== */}

            {gameUi(renderMoveReviewPanel(false))}
          </div>
        )}
      </div>
    </div>
  );

  // The app shell carries the header-height variables and has no transform.
  return inline
    ? reviewPage
    : createPortal(reviewPage, document.querySelector(".app-shell") ?? document.body);
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
  if (review.missedMate) {
    const best = review.bestMoveSan ? ` with ${review.bestMoveSan}` : "";

    return review.bestMoves[0]?.evaluation === "M1"
      ? `Checkmate in one was available${best}.`
      : `A forced checkmate was available${best}, but this move did not retain that mate line. The position may still be winning.`;
  }

  if (review.centipawnLoss < 80) {
    return null;
  }

  if (
    moverEvalBefore !== null &&
    moverEvalAfter !== null &&
    moverEvalBefore >= 5 &&
    moverEvalAfter <= 0.75
  ) {
    return "Stockfish estimated a winning advantage before this move (at least +5), but no clear advantage afterward (+0.75 or less). This is an engine estimate, not proof of a forced win.";
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
      `This move lost about ${(review.centipawnLoss / 100).toFixed(2)} evaluation points compared with best play.`,
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
          row.review.quality === "Book" ||
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

function PhaseBadge({ phase }: { phase: GamePhase }) {
  useUiLanguage();
  return (
    <span className="rounded-full border border-white/[0.06] bg-white/[0.04] px-2 py-1 text-[8px] font-black uppercase tracking-wider text-zinc-500">
      {gameUi(phase)}
    </span>
  );
}

function MoveTagBadge({ tag }: { tag: MoveTag }) {
  useUiLanguage();
  return (
    <span className="rounded-full border border-amber-300/10 bg-amber-300/[0.045] px-2 py-1 text-[8px] font-black uppercase tracking-wider text-amber-200/75">
      {gameUi(formatMoveTag(tag))}
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
  useUiLanguage();
  return (
    <div>
      <label className="mb-0.5 block text-[8px] font-black uppercase tracking-wider text-zinc-600">
        {ui(label)}
      </label>

      <select
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="w-full rounded-xl border border-white/[0.08] bg-black/25 px-2 py-1.5 text-[10px] font-semibold text-zinc-300 outline-none transition hover:border-amber-200/15 focus:border-amber-300/35 [color-scheme:dark]"
      >
        {options.map(([optionValue, optionLabel]) => (
          <option key={optionValue} value={optionValue}>
            {gameUi(optionLabel)}
          </option>
        ))}
      </select>
    </div>
  );
}

function MovePiece({ review }: { review: MoveReview }) {
  useUiLanguage();
  const position = new Chess(review.fenBefore);
  const piece = position.get(review.from);

  if (!piece) {
    return <span className="w-6 text-center text-zinc-600">·</span>;
  }

  return (
    <span className="w-6 text-center text-xl leading-none">
      {gameUi(pieceSymbols[piece.color][piece.type])}
    </span>
  );
}

function PairedReviewCell({
  row,
  quality,
  selected,
  showLoss,
  onSelect,
}: {
  row: EnrichedReviewRow;
  quality: ReviewVisualQuality;
  selected: boolean;
  showLoss: boolean;
  onSelect: () => void;
}) {
  useUiLanguage();
  const { review, pieceType } = row;
  const color = qualityColor(quality);

  return (
    <button
      type="button"
      onClick={onSelect}
      title={ui(quality)}
      aria-pressed={selected}
      className={`group/quality flex w-full min-w-0 items-center gap-1.5 rounded-lg border-l-2 px-1.5 py-1.5 text-left transition ${
        selected ? "bg-amber-300/[0.09]" : "hover:bg-amber-100/[0.035]"
      }`}
      style={{ borderLeftColor: color }}
    >
      <span className="w-4 shrink-0 text-center text-base leading-none">
        {gameUi(pieceType ? pieceSymbols[review.color][pieceType] : "·")}
      </span>

      <span className="min-w-0 flex-1 truncate font-mono text-xs font-bold text-zinc-200">
        {gameUi(review.san)}
      </span>

      {gameUi(showLoss && review.centipawnLoss > 0 && (
        <span className="shrink-0 text-[8px] font-bold text-zinc-600">
          {gameUi((review.centipawnLoss / 100).toFixed(2))}
        </span>
      ))}

      <span className="shrink-0" style={{ color }}>
        <ReviewQualityIcon quality={quality} size={12} />
      </span>
    </button>
  );
}

const phaseColors: Record<GamePhase, string> = {
  Opening: "#38bdf8",
  Middlegame: "#f5b94c",
  Endgame: "#b862ff",
};

const playbackMarkerQualities: ReviewVisualQuality[] = ["Mistake", "Blunder", "Missed Win"];

/** Play/pause plus a scrubber whose track is split into the game's phases. */
function ReviewPlaybackBar({
  rows,
  ply,
  playing,
  speed,
  onSpeedChange,
  onTogglePlay,
  onSeek,
}: {
  rows: EnrichedReviewRow[];
  ply: number;
  playing: boolean;
  speed: number;
  onSpeedChange: (speed: number) => void;
  onTogglePlay: () => void;
  onSeek: (ply: number) => void;
}) {
  useUiLanguage();
  const trackRef = useRef<HTMLDivElement>(null);
  const [hoverPly, setHoverPly] = useState<number | null>(null);
  const total = rows.length;

  // Consecutive moves of the same phase form one track segment.
  const segments = useMemo(() => {
    const result: Array<{ phase: GamePhase; start: number; end: number }> = [];

    for (const row of rows) {
      const last = result[result.length - 1];

      if (last && last.phase === row.phase) {
        last.end = row.review.ply;
      } else {
        result.push({ phase: row.phase, start: row.review.ply - 1, end: row.review.ply });
      }
    }

    return result;
  }, [rows]);

  const markers = rows.filter((row) => playbackMarkerQualities.includes(displayQuality(row)));
  const progress = total > 0 ? (ply / total) * 100 : 0;
  const shownPly = hoverPly ?? ply;
  const current = shownPly > 0 ? rows[shownPly - 1] : null;

  // Every move has a tick where a click lands on it; long games keep only White's moves.
  const ticks = useMemo(
    () => Array.from({ length: Math.max(0, total - 1) }, (_, index) => index + 1).filter((tick) => total <= 100 || tick % 2 === 1),
    [total],
  );

  // Move numbers under the track, at most about eight of them.
  const moveLabels = useMemo(() => {
    const moves = Math.ceil(total / 2);
    const step = [1, 2, 5, 10, 20, 25, 50, 100].find((candidate) => moves / candidate <= 8) ?? 200;
    const labels: number[] = [];

    for (let move = 1; move <= moves; move += move === 1 && step > 1 ? step - 1 : step) {
      labels.push(move);
    }

    return labels;
  }, [total]);

  function plyAt(clientX: number) {
    const rect = trackRef.current?.getBoundingClientRect();

    if (!rect || rect.width === 0 || total === 0) {
      return null;
    }

    const fraction = Math.min(1, Math.max(0, (clientX - rect.left) / rect.width));

    return Math.round(fraction * total);
  }

  function seekTo(clientX: number) {
    const target = plyAt(clientX);

    if (target !== null && target !== ply) {
      onSeek(target);
    }
  }

  return (
    <div className="flex min-w-0 flex-1 flex-wrap items-center gap-2 rounded-2xl border border-white/[0.08] bg-[#09121c]/78 sm:flex-nowrap px-2 py-2 shadow-inner shadow-black/20 sm:gap-3 sm:px-3">
      <div className="flex shrink-0 items-center gap-0.5 sm:gap-1">
        <button
          type="button"
          aria-label={ui("Go to start")}
          title={ui("Go to start")}
          disabled={ply === 0}
          onClick={() => onSeek(0)}
          className="grid h-8 w-8 place-items-center rounded-lg text-zinc-500 transition hover:bg-white/5 hover:text-zinc-200 disabled:opacity-30"
        >
          <ChevronsLeft size={16} />
        </button>

        <button
          type="button"
          aria-label={ui("Previous move")}
          disabled={ply === 0}
          onClick={() => onSeek(ply - 1)}
          className="grid h-8 w-8 place-items-center rounded-lg text-zinc-500 transition hover:bg-white/5 hover:text-zinc-200 disabled:opacity-30"
        >
          <ChevronLeft size={16} />
        </button>

        <button
          type="button"
          aria-label={gameUi(playing ? ui("Pause") : ui("Play"))}
          onClick={onTogglePlay}
          className="grid h-9 w-9 place-items-center rounded-full border border-amber-200/25 bg-[linear-gradient(180deg,rgba(245,190,92,.98),rgba(207,145,53,.96))] text-[#161007] shadow-[0_6px_18px_rgba(190,126,40,.22)] transition hover:brightness-105"
        >
          {playing ? <Pause size={15} fill="currentColor" /> : <Play size={15} fill="currentColor" className="translate-x-px" />}
        </button>

        <button
          type="button"
          aria-label={ui("Next move")}
          disabled={ply >= total}
          onClick={() => onSeek(ply + 1)}
          className="grid h-8 w-8 place-items-center rounded-lg text-zinc-500 transition hover:bg-white/5 hover:text-zinc-200 disabled:opacity-30"
        >
          <ChevronRight size={16} />
        </button>

        <button
          type="button"
          aria-label={ui("Go to end")}
          title={ui("Go to end")}
          disabled={ply >= total}
          onClick={() => onSeek(total)}
          className="grid h-8 w-8 place-items-center rounded-lg text-zinc-500 transition hover:bg-white/5 hover:text-zinc-200 disabled:opacity-30"
        >
          <ChevronsRight size={16} />
        </button>
      </div>

      <select
        aria-label={ui("Playback speed")}
        title={ui("Playback speed")}
        value={speed}
        onChange={(event) => onSpeedChange(Number(event.target.value))}
        className="h-8 shrink-0 rounded-lg border border-white/10 bg-[#101c29] px-1 text-xs font-semibold text-amber-100 focus-visible:outline-2 focus-visible:outline-amber-300"
      >
        {REVIEW_SPEEDS.map((value) => <option key={value} value={value}>{gameUi(value)}×</option>)}
      </select>

      <div className="relative order-last min-w-0 basis-full pb-3 sm:order-none sm:flex-1 sm:basis-auto">
      <div
        ref={trackRef}
        role="slider"
        tabIndex={0}
        aria-label={ui("Game timeline")}
        aria-valuemin={0}
        aria-valuemax={total}
        aria-valuenow={ply}
        onPointerDown={(event) => {
          event.currentTarget.setPointerCapture(event.pointerId);
          seekTo(event.clientX);
        }}
        onPointerMove={(event) => {
          if (event.currentTarget.hasPointerCapture(event.pointerId)) {
            seekTo(event.clientX);
            setHoverPly(null);
          } else if (event.pointerType === "mouse") {
            setHoverPly(plyAt(event.clientX));
          }
        }}
        onPointerLeave={() => setHoverPly(null)}
        onKeyDown={(event) => {
          const target =
            event.key === "ArrowLeft" ? ply - 1
              : event.key === "ArrowRight" ? ply + 1
                : event.key === "Home" ? 0
                  : event.key === "End" ? total
                    : null;

          if (target !== null) {
            event.preventDefault();
            onSeek(target);
          }
        }}
        className="relative h-7 min-w-0 cursor-pointer touch-none select-none overflow-hidden rounded-lg border border-white/[0.06] bg-black/30 outline-none focus-visible:ring-2 focus-visible:ring-amber-300/40"
      >
        {segments.map((segment) => {
          const width = ((segment.end - segment.start) / total) * 100;

          return (
            <div
              key={segment.start}
              title={ui(segment.phase)}
              className="absolute inset-y-0 flex items-center justify-center overflow-hidden border-r border-black/40 last:border-r-0"
              style={{
                left: `${(segment.start / total) * 100}%`,
                width: `${width}%`,
                background: `${phaseColors[segment.phase]}24`,
              }}
            >
              {gameUi(width >= 9 && (
                <span className="truncate px-1 text-[8px] font-black uppercase tracking-[0.14em]" style={{ color: `${phaseColors[segment.phase]}cc` }}>
                  {ui(segment.phase)}
                </span>
              ))}
            </div>
          );
        })}

        <div className="pointer-events-none absolute inset-y-0 left-0 bg-white/[0.09]" style={{ width: `${progress}%` }} />

        {ticks.map((tick) => (
          <span
            key={tick}
            className={`pointer-events-none absolute bottom-0 w-px -translate-x-1/2 ${tick % 2 === 1 ? "h-2" : "h-1"} ${
              tick <= ply ? "bg-[#fff3d5]/45" : "bg-white/20"
            }`}
            style={{ left: `${(tick / total) * 100}%` }}
          />
        ))}

        {gameUi(hoverPly !== null && hoverPly !== ply && (
          <span
            className="pointer-events-none absolute inset-y-0 w-px -translate-x-1/2 bg-amber-200/70"
            style={{ left: `${Math.min(99.6, Math.max(0.4, (hoverPly / total) * 100))}%` }}
          />
        ))}

        {markers.map((row) => {
          const color = qualityColor(displayQuality(row));

          return (
            <span
              key={row.review.ply}
              className="pointer-events-none absolute top-1 h-1.5 w-1.5 -translate-x-1/2 rounded-full"
              style={{ left: `${((row.review.ply - 0.5) / total) * 100}%`, background: color, boxShadow: `0 0 6px ${color}` }}
            />
          );
        })}

        <span
          className="pointer-events-none absolute inset-y-0 w-[3px] -translate-x-1/2 rounded-full bg-[#fff3d5] shadow-[0_0_8px_rgba(255,243,213,.8)]"
          style={{ left: `${Math.min(99.6, Math.max(0.4, progress))}%` }}
        />
      </div>

      {gameUi(total > 0 && (
        <div aria-hidden="true" className="pointer-events-none absolute inset-x-0 bottom-0 h-3">
          {moveLabels.map((move) => (
            <span
              key={move}
              className="absolute top-0.5 -translate-x-1/2 font-mono text-[8px] font-bold leading-none text-zinc-500"
              style={{ left: `${Math.min(97, Math.max(2, ((move * 2 - 1) / total) * 100))}%` }}
            >
              {gameUi(move)}
            </span>
          ))}
        </div>
      ))}
      </div>

      <div className="ml-auto w-14 shrink-0 text-right sm:ml-0 sm:w-20">
        <p className="text-[8px] font-black uppercase tracking-wider text-zinc-600">
          {gameUi(shownPly)}/{gameUi(total)}
        </p>
        <p className={`truncate font-mono text-xs font-bold ${hoverPly !== null && hoverPly !== ply ? "text-amber-200" : "text-zinc-300"}`}>
          {gameUi(current ? `${current.review.moveNumber}${current.review.color === "w" ? "." : "..."} ${current.review.san}` : ui("Start"))}
        </p>
      </div>
    </div>
  );
}

function CorrectMoveButton({
  san,
  showing,
  onClick,
}: {
  san: string | null;
  showing: boolean;
  onClick: () => void;
}) {
  useUiLanguage();
  const violet = qualityColor("Missed Win");

  return (
    <button
      type="button"
      aria-pressed={showing}
      onClick={onClick}
      className="group/quality mt-3 flex w-full items-center gap-3 rounded-2xl border border-violet-400/30 bg-violet-400/[0.08] px-4 py-3 text-left transition hover:border-violet-300/50 hover:bg-violet-400/[0.14]"
    >
      <span
        className="grid h-9 w-9 shrink-0 place-items-center rounded-full border border-violet-300/30 bg-[#06131e]"
        style={{ color: violet, boxShadow: `0 0 12px ${violet}66` }}
      >
        <ReviewQualityIcon quality="Missed Win" size={16} />
      </span>

      <span className="min-w-0 flex-1">
        <span className="block text-xs font-black text-violet-100">
          {gameUi(showing ? ui("Show played move") : ui("Show correct move"))}
        </span>
        <span className="mt-0.5 block text-[10px] text-violet-200/60">
          {showing ? (
            ui("Back to the move from the game")
          ) : (
            <>
              {ui("The winning move was")}{gameUi(" ")}
              <strong className="font-mono text-violet-100">{san}</strong>
            </>
          )}
        </span>
      </span>

      <span aria-hidden="true" className="text-violet-200/70">
        {gameUi(showing ? "↺" : "▶")}
      </span>
    </button>
  );
}

function CurrentMoveButton({
  review,
  quality,
  active,
  onClick,
}: {
  review: MoveReview;
  quality: ReviewVisualQuality;
  active: boolean;
  onClick: () => void;
}) {
  useUiLanguage();
  const color = qualityColor(quality);

  return (
    <button
      type="button"
      aria-pressed={active}
      onClick={onClick}
      className={`flex w-full flex-col gap-3 rounded-2xl border p-4 text-left transition ${
        active ? "" : "border-white/5 bg-black/20 hover:bg-white/5"
      }`}
      style={active ? { borderColor: `${color}66`, background: `${color}1a` } : undefined}
    >
      <span className="flex items-center justify-between gap-3">
        <span className="text-[9px] font-black uppercase tracking-[0.18em] text-amber-200/60">{ui("Current Move")}</span>
        <SideBadge color={review.color} />
      </span>

      <span className="flex items-center justify-between gap-3">
        <span className="flex items-center gap-3">
          <MovePiece review={review} />
          <span className="font-mono text-3xl font-black text-[#f1e4ca]">{gameUi(review.san)}</span>
        </span>
        <QualityBadge quality={quality} />
      </span>
    </button>
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
  useUiLanguage();
  return (
    <th className={`px-1.5 py-2 ${className}`}>
      <button
        type="button"
        onClick={onClick}
        className={`flex items-center gap-1 transition ${
          active ? "text-amber-300" : "text-zinc-600 hover:text-zinc-400"
        }`}
      >
        {ui(label)}

        <span className={`text-[8px] ${active ? "opacity-100" : "opacity-25"}`}>
          {gameUi(active ? (direction === "asc" ? "▲" : "▼") : "◆")}
        </span>
      </button>
    </th>
  );
}

function SideBadge({ color }: { color: "w" | "b" }) {
  useUiLanguage();
  return color === "w" ? (
    <span className="inline-flex items-center gap-1 rounded-full bg-[#fff3d5]/10 px-2 py-1 text-[9px] font-black text-[#fff3d5]">{ui("♔ White")}</span>
  ) : (
    <span className="inline-flex items-center gap-1 rounded-full bg-white/5 px-2 py-1 text-[9px] font-black text-zinc-300">{ui("♚ Black")}</span>
  );
}
