import { Chess, type Square } from "chess.js";

import type { StockfishAnalysisLine } from "@/hooks/useStockfishAnalysis";

/* =========================================================
   TYPES
   ========================================================= */

export type MoveQuality =
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

  centipawnLoss: number;

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
   ========================================================= */

export function engineScore(line: StockfishAnalysisLine | undefined) {
  if (!line) {
    return 0;
  }

  if (line.mate !== null) {
    if (line.mate > 0) {
      return 100000 - Math.abs(line.mate) * 100;
    }

    return -100000 + Math.abs(line.mate) * 100;
  }

  return line.scoreCp ?? 0;
}

/* =========================================================
   POSITION SCORE
   ========================================================= */

function positionScore(
  fen: string,

  line?: StockfishAnalysisLine,
) {
  const game = new Chess(fen);

  if (game.isCheckmate()) {
    return -100000;
  }

  if (game.isDraw() || game.isStalemate() || game.isInsufficientMaterial()) {
    return 0;
  }

  return engineScore(line);
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
): Promise<MoveReview | null> {
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

  const bestLine = beforeLines[0];

  const afterGame = new Chess(afterFen);

  let afterLine: StockfishAnalysisLine | undefined;

  if (!afterGame.isGameOver()) {
    const afterLines = await analyzePosition(afterFen, {
      multiPV: 1,

      moveTime,
    });

    afterLine = afterLines[0];
  }

  const bestScore = positionScore(beforeFen, bestLine);

  /*
   * afterFen has the opponent
   * to move.
   */
  const playedScore = -positionScore(afterFen, afterLine);

  const loss = Math.max(0, bestScore - playedScore);

  const bestMoveUci = bestLine.pv[0] ?? null;

  const bestMoveSan = bestMoveUci ? uciToSan(beforeFen, bestMoveUci) : null;

  const moveGame = new Chess(beforeFen);

  const playedMove = moveGame.move(playedSan);

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

    quality: classifyMove(loss, bestMoveUci === playedUci),

    centipawnLoss: loss,

    bestMoveUci,

    bestMoveSan,

    bestMoves: linesToSuggestions(beforeFen, beforeLines, 3),
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

  return frames.map((frame, index) => {
    const beforeLines = analyses[index];

    const afterLines = analyses[index + 1];

    const beforeLine = beforeLines[0];

    const afterLine = afterLines[0];

    const bestScore = positionScore(frame.fenBefore, beforeLine);

    const playedScore = -positionScore(frame.fenAfter, afterLine);

    const loss = Math.max(
      0,

      bestScore - playedScore,
    );

    const bestMoveUci = beforeLine?.pv[0] ?? null;

    const bestMoves = linesToSuggestions(
      frame.fenBefore,

      beforeLines,

      3,
    );

    return {
      ...frame,

      quality: classifyMove(
        loss,

        bestMoveUci === frame.uci,
      ),

      centipawnLoss: loss,

      bestMoveUci,

      bestMoveSan: bestMoveUci
        ? uciToSan(
            frame.fenBefore,

            bestMoveUci,
          )
        : null,

      bestMoves,
    };
  });
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
    const loss = Math.max(0, positionScore(fenBefore, beforeLines[0]) + positionScore(fenAfter, afterLines[0]));
    const bestMoveUci = beforeLines[0].pv[0] ?? null;

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

      quality: classifyMove(loss, bestMoveUci === playedUci),

      centipawnLoss: loss,

      bestMoveUci,

      bestMoveSan: bestMoveUci ? uciToSan(fenBefore, bestMoveUci) : null,

      bestMoves: linesToSuggestions(fenBefore, beforeLines, 3),
    });
  }
}
