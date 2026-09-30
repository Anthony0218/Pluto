import { type Square } from "chess.js";

export function getSquareName(row: number, column: number): Square {
  const files = "abcdefgh";
  const rank = 8 - row;

  return `${files[column]}${rank}` as Square;
}
export type PieceType = "p" | "n" | "b" | "r" | "q" | "k";

export function getReadableMove(move: string) {
  if (move.length < 4) {
    return move;
  }

  return `${move.slice(0, 2)}-${move.slice(2, 4)}`;
}

export function getMoveRating(
  beforeEvaluation: number,
  afterEvaluation: number,
  playerColor: "w" | "b",
) {
  const beforeForPlayer =
    playerColor === "w" ? beforeEvaluation : -beforeEvaluation;

  const afterForPlayer =
    playerColor === "w" ? -afterEvaluation : afterEvaluation;

  const evaluationLoss = beforeForPlayer - afterForPlayer;

  console.log({
    beforeEvaluation,
    afterEvaluation,
    playerColor,
    beforeForPlayer,
    afterForPlayer,
    evaluationLoss,
  });

  if (evaluationLoss <= 0.1) {
    return "Excellent";
  }

  if (evaluationLoss <= 0.3) {
    return "Good";
  }

  if (evaluationLoss <= 0.7) {
    return "Inaccuracy";
  }

  if (evaluationLoss <= 1.5) {
    return "Mistake";
  }

  return "Blunder";
}
