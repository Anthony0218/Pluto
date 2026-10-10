import { Chess, type Square } from "chess.js";
import { openingBookMove } from "@/games/chess/openingBook";

import type { StockfishAnalysisLine } from "@/hooks/useStockfishAnalysis";

/* =========================================================
   TYPES
   ========================================================= */

export type MoveQuality =
  | "Book"
  | "Best"
  | "Excellent"
  | "Good"
  | "Inaccuracy"
  | "Mistake"
  | "Blunder";

export type MoveSuggestion = {
  uci: string;

  san: string;

  evaluation: string;

  /** Engine principal variation in UCI, starting with this move. */
  pv?: string[];
};

export type MoveReview = {
  ply: number;

  moveNumber: number;

  color: "w" | "b";

  san: string;

  uci: string;

  from: Square;

  to: Square;

  fenBefore: string;

  fenAfter: string;

  quality: MoveQuality;
  openingName?: string | null;

  centipawnLoss: number;

  /** A forced mate was available and this move let it go (or skipped a mate in 1). */
  missedMate: boolean;

  bestMoveUci: string | null;

  bestMoveSan: string | null;

  /*
   * NEW:
   * Three best engine moves for
   * this exact position.
   */
  bestMoves: MoveSuggestion[];
};

export type AnalyzePosition = (
  fen: string,

  options?: {
    multiPV?: number;

    moveTime?: number;

    depth?: number;

    newGame?: boolean;
  },
) => Promise<StockfishAnalysisLine[]>;

/*
 * Full reviews search every position to a fixed depth
 * from a cleared hash, so the same moves always get the
 * same scores on every device. A time budget made the
 * search depth (and the scores) vary run to run.
 * The sample review on the landing page was generated
 * with these exact settings, so keep them in sync.
 */
export const REVIEW_DEPTH = 14;

export const REVIEW_MULTI_PV = 3;

/* =========================================================
   ENGINE SCORE
   =========================================================
   Scores are centipawns from the side to move. Normal evaluations are
   capped at ten pawns: +14 instead of +18 is still a won game, and the
   cap keeps every forced mate above any normal evaluation, so a missed
   mate costs a few pawns of evaluation instead of a thousand.

   Stockfish counts mate in full moves from the side to move ("mate 1":
   it mates next move, "mate -1": it is mated after its reply). Counted in
   plies instead, the position after a move is exactly one ply further
   from the root, so a move that only delays the mate scores below the
   shortest mate rather than the same.
   ========================================================= */

export const EVAL_CAP = 1000;

const MATE_SCORE = 1100;

/** Each ply further from mate costs this much; a long mate still beats any normal evaluation. */
const MATE_PLY_COST = 5;

function mateScore(plies: number) {
  return Math.max(EVAL_CAP + 1, MATE_SCORE - plies * MATE_PLY_COST);
}

/**
 * `extraPlies` counts the moves already played since the position being
 * graded: 1 for the position after the played move.
 */
export function engineScore(
  line: Pick<StockfishAnalysisLine, "scoreCp" | "mate"> | undefined,

  extraPlies = 0,
) {
  if (!line) {
    return 0;
  }

  if (line.mate !== null) {
    if (line.mate > 0) {
      return mateScore(line.mate * 2 - 1 + extraPlies);
    }

    return -mateScore(Math.abs(line.mate) * 2 + extraPlies);
  }

  return Math.max(-EVAL_CAP, Math.min(EVAL_CAP, line.scoreCp ?? 0));
}

/** Engine evaluation text ("+0.35", "M3", "-M2") back to a score on the same scale. */
export function evaluationScore(evaluation: string) {
  const mate = /^(-)?M(\d+)$/.exec(evaluation);

  if (mate) {
    return engineScore({ scoreCp: null, mate: Number(mate[2]) * (mate[1] ? -1 : 1) });
  }

  const pawns = Number.parseFloat(evaluation);

  return engineScore({ scoreCp: Number.isFinite(pawns) ? Math.round(pawns * 100) : 0, mate: null });
}

/* =========================================================
   POSITION SCORE
   ========================================================= */

export function positionScore(
  fen: string,

  line?: StockfishAnalysisLine,

  extraPlies = 0,
) {
  const game = new Chess(fen);

  if (game.isCheckmate()) {
    return -mateScore(extraPlies);
  }

  if (game.isDraw() || game.isStalemate() || game.isInsufficientMaterial()) {
    return 0;
  }

  return engineScore(line, extraPlies);
}

/* =========================================================
   GRADE FROM ENGINE LINES
   ========================================================= */

const qualityOrder: MoveQuality[] = ["Best", "Excellent", "Good", "Inaccuracy", "Mistake", "Blunder"];

/**
 * Grades a played move from the top engine line before it and the top
 * line after it (none when the move ended the game).
 */
export function gradePlayedMove(
  fenBefore: string,

  fenAfter: string,

  playedUci: string,

  beforeLine: StockfishAnalysisLine | undefined,

  afterLine: StockfishAnalysisLine | undefined,
) {
  const bestScore = positionScore(fenBefore, beforeLine);

  // fenAfter has the opponent to move, one ply further from fenBefore.
  const playedScore = -positionScore(fenAfter, afterLine, 1);

  const centipawnLoss = Math.max(0, bestScore - playedScore);

  const bestMoveUci = beforeLine?.pv[0] ?? null;

  const deliveredMate = new Chess(fenAfter).isCheckmate();

  const mateBefore = beforeLine?.mate ?? null;

  const stillMating = afterLine?.mate != null && afterLine.mate < 0;

  const missedMate =
    !deliveredMate &&
    mateBefore !== null &&
    mateBefore > 0 &&
    (mateBefore === 1 || !stillMating);

  let quality = classifyMove(centipawnLoss, deliveredMate || bestMoveUci === playedUci);

  // Letting a forced mate go is never better than an inaccuracy, even while still winning.
  if (missedMate && qualityOrder.indexOf(quality) < qualityOrder.indexOf("Inaccuracy")) {
    quality = "Inaccuracy";
  }

  return { quality, centipawnLoss, missedMate, bestMoveUci };
}

/* =========================================================
   GRADE AMONG THE ENGINE'S OWN TOP MOVES
   =========================================================
   Two separate searches of the same position (the coach's hint and the
   grading) rarely agree to the centipawn, and the grade of a move was
   taken from a third search of the position after it. So the move the
   coach had just recommended could come out as Good or Inaccuracy.
   When the played move is one of the moves a single search ranked, its
   grade comes from that search alone: the top move is Best, the others
   lose exactly the evaluation the search gave them.
   ========================================================= */

type RankedMove = { uci: string; score: number; mate: number | null };

function mateFromEvaluation(evaluation: string) {
  const mate = /^(-)?M(\d+)$/.exec(evaluation);

  return mate ? Number(mate[2]) * (mate[1] ? -1 : 1) : null;
}

const rankSuggestions = (suggestions: MoveSuggestion[]): RankedMove[] =>
  suggestions.map((suggestion) => ({ uci: suggestion.uci, score: evaluationScore(suggestion.evaluation), mate: mateFromEvaluation(suggestion.evaluation) }));

const rankLines = (lines: StockfishAnalysisLine[]): RankedMove[] =>
  lines.filter((line) => line.pv.length > 0).map((line) => ({ uci: line.pv[0], score: engineScore(line), mate: line.mate }));

/** The grade of `playedUci` from one search's ranking, or null when the search did not rank that move. */
export function gradeAmongRanked(fenAfter: string, playedUci: string, ranked: RankedMove[]) {
  const index = ranked.findIndex((move) => move.uci === playedUci);

  if (index < 0) {
    return null;
  }

  const deliveredMate = new Chess(fenAfter).isCheckmate();

  const centipawnLoss = Math.max(0, ranked[0].score - ranked[index].score);

  const missedMate = !deliveredMate && ranked[0].mate !== null && ranked[0].mate > 0 && !(ranked[index].mate !== null && ranked[index].mate > 0);

  let quality = classifyMove(centipawnLoss, deliveredMate || index === 0);

  // Letting a forced mate go is never better than an inaccuracy, even while still winning.
  if (missedMate && qualityOrder.indexOf(quality) < qualityOrder.indexOf("Inaccuracy")) {
    quality = "Inaccuracy";
  }

  return { quality, centipawnLoss, missedMate, bestMoveUci: ranked[0].uci };
}

/* =========================================================
   MOVE QUALITY
   ========================================================= */

export function classifyMove(
  centipawnLoss: number,

  isBestMove: boolean,
): MoveQuality {
  if (isBestMove) {
    return "Best";
  }

  if (centipawnLoss <= 25) {
    return "Excellent";
  }

  if (centipawnLoss <= 60) {
    return "Good";
  }

  if (centipawnLoss <= 120) {
    return "Inaccuracy";
  }

  if (centipawnLoss <= 250) {
    return "Mistake";
  }

  return "Blunder";
}

/* =========================================================
   EVALUATION DISPLAY
   ========================================================= */

export function formatEvaluation(line: StockfishAnalysisLine) {
  if (line.mate !== null) {
    return line.mate > 0 ? `M${line.mate}` : `-M${Math.abs(line.mate)}`;
  }

  const pawns = (line.scoreCp ?? 0) / 100;

  return pawns >= 0 ? `+${pawns.toFixed(2)}` : pawns.toFixed(2);
}

/* =========================================================
   UCI -> SAN
   ========================================================= */

export function uciToSan(
  fen: string,

  uci: string,
) {
  const game = new Chess(fen);

  const from = uci.slice(0, 2) as Square;

  const to = uci.slice(2, 4) as Square;

  const promotion =
    uci.length > 4 ? (uci[4] as "q" | "r" | "b" | "n") : undefined;

  try {
    const move = game.move({
      from,
      to,
      promotion,
    });

    return move.san;
  } catch {
    return uci;
  }
}

/* =========================================================
   ENGINE LINES -> SUGGESTIONS
   ========================================================= */

function linesToSuggestions(
  fen: string,

  lines: StockfishAnalysisLine[],

  count = 3,
): MoveSuggestion[] {
  return lines
    .slice(0, count)
    .filter((line) => line.pv.length > 0)
    .map((line) => {
      const uci = line.pv[0];

      return {
        uci,

        san: uciToSan(fen, uci),

        evaluation: formatEvaluation(line),

        pv: line.pv,
      };
    });
}

/* =========================================================
   GRADE SINGLE MOVE
   ========================================================= */

export async function gradeMove(
  beforeFen: string,

  afterFen: string,

  playedUci: string,

  playedSan: string,

  analyzePosition: AnalyzePosition,

  moveTime = 400,

  /**
   * The moves the coach showed for `beforeFen`, if it did. Read when the grading
   * starts (the hint's own search may still be running when the move is made), so
   * playing a recommended move is graded by the very search that recommended it.
   */
  shown?: () => MoveSuggestion[] | undefined,
): Promise<MoveReview | null> {
  let bestMoves = shown?.() ?? [];

  let graded: { quality: MoveQuality; centipawnLoss: number; missedMate: boolean; bestMoveUci: string | null } | null = bestMoves.length > 0 ? gradeAmongRanked(afterFen, playedUci, rankSuggestions(bestMoves)) : null;

  if (!graded) {
    /*
     * MultiPV 3 here as well so live
     * feedback already has the three
     * alternatives available.
     */
    const beforeLines = await analyzePosition(beforeFen, {
      multiPV: 3,

      moveTime,
    });

    if (beforeLines.length === 0) {
      return null;
    }

    bestMoves = linesToSuggestions(beforeFen, beforeLines, 3);

    graded = gradeAmongRanked(afterFen, playedUci, rankLines(beforeLines));

    if (!graded) {
      // Not one of the top moves: compare with the best line and the position after the move.
      const afterGame = new Chess(afterFen);

      let afterLine: StockfishAnalysisLine | undefined;

      if (!afterGame.isGameOver()) {
        const afterLines = await analyzePosition(afterFen, {
          multiPV: 1,

          moveTime,
        });

        afterLine = afterLines[0];
      }

      graded = gradePlayedMove(beforeFen, afterFen, playedUci, beforeLines[0], afterLine);
    }
  }

  const { quality, centipawnLoss, missedMate, bestMoveUci } = graded;

  const bestMoveSan = bestMoveUci ? uciToSan(beforeFen, bestMoveUci) : null;

  const moveGame = new Chess(beforeFen);

  const playedMove = moveGame.move(playedSan);

  const movePly = (Number(beforeFen.split(" ")[5]) - 1) * 2 + (playedMove.color === "w" ? 1 : 2);
  const opening = await openingBookMove(afterFen, movePly);
  return {
    ply: 0,

    moveNumber: 0,

    color: playedMove.color,

    san: playedMove.san,

    uci: playedUci,

    from: playedMove.from,

    to: playedMove.to,

    fenBefore: beforeFen,

    fenAfter: afterFen,

    quality: opening ? "Book" : quality,
    openingName: opening?.name ?? null,

    centipawnLoss,

    missedMate,

    bestMoveUci,

    bestMoveSan,

    bestMoves,
  };
}

/* =========================================================
   BEST MOVES HELP
   ========================================================= */

export async function getBestSuggestions(
  fen: string,

  analyzePosition: AnalyzePosition,

  count = 3,
): Promise<MoveSuggestion[]> {
  const lines = await analyzePosition(fen, {
    multiPV: count,

    moveTime: 650,
  });

  return linesToSuggestions(fen, lines, count);
}

/* =========================================================
   FULL GAME REVIEW
   ========================================================= */

export async function reviewGameMoves(
  moves: string[],

  analyzePosition: AnalyzePosition,

  onProgress?: (
    completed: number,

    total: number,
  ) => void,
): Promise<MoveReview[]> {
  const replay = new Chess();

  type ReviewFrame = {
    ply: number;

    moveNumber: number;

    color: "w" | "b";

    san: string;

    uci: string;

    from: Square;

    to: Square;

    fenBefore: string;

    fenAfter: string;
  };

  const frames: ReviewFrame[] = [];

  /* -------------------------------------------------------
     REBUILD EVERY POSITION
     ------------------------------------------------------- */

  for (let index = 0; index < moves.length; index++) {
    const fenBefore = replay.fen();

    const move = replay.move(moves[index]);

    const fenAfter = replay.fen();

    frames.push({
      ply: index + 1,

      moveNumber: Math.floor(index / 2) + 1,

      color: move.color,

      san: move.san,

      uci: `${move.from}${move.to}${move.promotion ?? ""}`,

      from: move.from,

      to: move.to,

      fenBefore,

      fenAfter,
    });
  }

  const positions = [
    new Chess().fen(),

    ...frames.map((frame) => frame.fenAfter),
  ];

  /*
   * Each position stores several engine lines;
   * the top three become the suggestions.
   */
  const analyses: StockfishAnalysisLine[][] = [];

  /* -------------------------------------------------------
     ANALYZE POSITIONS
     ------------------------------------------------------- */

  for (let index = 0; index < positions.length; index++) {
    const fen = positions[index];

    const position = new Chess(fen);

    if (position.isGameOver()) {
      analyses.push([]);
    } else {
      const lines = await analyzePosition(fen, {
        multiPV: REVIEW_MULTI_PV,

        depth: REVIEW_DEPTH,

        newGame: index === 0,
      });

      analyses.push(lines);
    }

    onProgress?.(
      Math.min(index, moves.length),

      moves.length,
    );
  }

  /* -------------------------------------------------------
     BUILD REVIEW
     ------------------------------------------------------- */

  return Promise.all(frames.map(async (frame, index) => {
    const beforeLines = analyses[index];

    const afterLines = analyses[index + 1];

    const { quality, centipawnLoss, missedMate, bestMoveUci } = gradePlayedMove(
      frame.fenBefore,

      frame.fenAfter,

      frame.uci,

      beforeLines[0],

      afterLines[0],
    );

    const bestMoves = linesToSuggestions(
      frame.fenBefore,

      beforeLines,

      3,
    );

    const opening = await openingBookMove(frame.fenAfter, frame.ply);
    return {
      ...frame,

      quality: opening ? "Book" : quality,
      openingName: opening?.name ?? null,

      centipawnLoss,

      missedMate,

      bestMoveUci,

      bestMoveSan: bestMoveUci
        ? uciToSan(
            frame.fenBefore,

            bestMoveUci,
          )
        : null,

      bestMoves,
    };
  }));
}

/* =========================================================
   GRADE EARLIER MOVES
   ========================================================= */

/**
 * Grades moves that were played before the Chess Coach was switched on.
 * Each position is searched once and shared by the moves on both sides of it.
 * `plies` (1-based, ascending) picks the moves of `moves` to grade; each grade
 * reaches `onGrade` as soon as it is known. The run stops when `stillWanted`
 * turns false or the engine is busy with another search.
 */
export async function gradeEarlierMoves(
  moves: string[],

  plies: number[],

  analyzePosition: AnalyzePosition,

  {
    moveTime = 250,
    stillWanted,
    onGrade,
  }: {
    moveTime?: number;
    stillWanted: () => boolean;
    onGrade: (review: MoveReview) => void;
  },
) {
  const replay = new Chess();
  const positions = [replay.fen()];
  const played = moves.map((san) => {
    const move = replay.move(san);
    positions.push(replay.fen());
    return move;
  });

  const analyses = new Map<number, StockfishAnalysisLine[]>();

  async function analysis(index: number) {
    const cached = analyses.get(index);

    if (cached) {
      return cached;
    }

    const fen = positions[index];
    const lines = new Chess(fen).isGameOver() ? [] : await analyzePosition(fen, { multiPV: 1, moveTime });

    analyses.set(index, lines);

    return lines;
  }

  for (const ply of plies) {
    if (!stillWanted()) {
      return;
    }

    const move = played[ply - 1];
    const fenBefore = positions[ply - 1];
    const fenAfter = positions[ply];

    if (!move) {
      continue;
    }

    const beforeLines = await analysis(ply - 1);

    if (beforeLines.length === 0 || !stillWanted()) {
      return;
    }

    const afterLines = await analysis(ply);

    if ((afterLines.length === 0 && !new Chess(fenAfter).isGameOver()) || !stillWanted()) {
      return;
    }

    const playedUci = `${move.from}${move.to}${move.promotion ?? ""}`;
    const { quality, centipawnLoss, missedMate, bestMoveUci } = gradePlayedMove(fenBefore, fenAfter, playedUci, beforeLines[0], afterLines[0]);

    const opening = await openingBookMove(fenAfter, ply);
    if (!stillWanted()) return;

    onGrade({
      ply,

      moveNumber: Math.floor((ply - 1) / 2) + 1,

      color: move.color,

      san: move.san,

      uci: playedUci,

      from: move.from,

      to: move.to,

      fenBefore,

      fenAfter,

      quality: opening ? "Book" : quality,
      openingName: opening?.name ?? null,

      centipawnLoss,

      missedMate,

      bestMoveUci,

      bestMoveSan: bestMoveUci ? uciToSan(fenBefore, bestMoveUci) : null,

      bestMoves: linesToSuggestions(fenBefore, beforeLines, 3),
    });
  }
}
