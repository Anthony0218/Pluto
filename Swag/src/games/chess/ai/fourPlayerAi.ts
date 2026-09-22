import {
  applyFourPlayerMove,
  getFourPlayerLegalMoves,
  type FourPlayerColor,
  type FourPlayerPieceType,
  type FourPlayerSquare,
  type FourPlayerState,
} from "../variants/fourPlayerChess";

import { difficultyRank, difficultyLevels, type Difficulty } from "./variantAi";

const pieceValue: Record<FourPlayerPieceType, number> = {
  p: 100,
  n: 320,
  b: 330,
  r: 500,
  q: 900,
  k: 20000,
};

export type FourPlayerAiMove = {
  from: FourPlayerSquare;
  to: FourPlayerSquare;
};

type Candidate = FourPlayerAiMove & {
  score: number;
};

function enumerateMoves(
  state: FourPlayerState,
  color: FourPlayerColor,
): FourPlayerAiMove[] {
  const result: FourPlayerAiMove[] = [];

  for (let row = 0; row < state.board.length; row += 1) {
    for (let column = 0; column < state.board[row].length; column += 1) {
      const piece = state.board[row][column];

      if (!piece || piece.color !== color) {
        continue;
      }

      const from = { row, column };

      for (const to of getFourPlayerLegalMoves(state, from)) {
        result.push({ from, to });
      }
    }
  }

  return result;
}

function centerBonus(square: FourPlayerSquare) {
  const dr = Math.abs(square.row - 6.5);
  const dc = Math.abs(square.column - 6.5);

  return Math.max(0, 24 - (dr + dc) * 3);
}

function scoreMove(state: FourPlayerState, move: FourPlayerAiMove): number {
  const movingPiece = state.board[move.from.row]?.[move.from.column];
  const captured = state.board[move.to.row]?.[move.to.column];

  if (!movingPiece) {
    return -999999;
  }

  let score = 0;

  if (captured) {
    score += pieceValue[captured.type] * 1.15;
  }

  score += centerBonus(move.to) - centerBonus(move.from) * 0.2;

  if (movingPiece.type === "p") {
    score += 12;
  }

  const next = applyFourPlayerMove(state, move.from, move.to);

  if (next.winner === movingPiece.color) {
    score += 100000;
  }

  /*
   * Reward moves that eliminate somebody immediately.
   */
  score += (state.activePlayers.length - next.activePlayers.length) * 5000;

  return score;
}

export function chooseFourPlayerAiMove(
  state: FourPlayerState,
  difficulty: Difficulty,
): FourPlayerAiMove | null {
  const moves = enumerateMoves(state, state.turn);

  if (moves.length === 0) {
    return null;
  }

  const settings = difficultyLevels[difficulty];

  if (
    settings.randomMoveChance > 0 &&
    Math.random() < settings.randomMoveChance
  ) {
    return moves[Math.floor(Math.random() * moves.length)];
  }

  const candidates: Candidate[] = moves
    .map((move) => ({
      ...move,
      score: scoreMove(state, move),
    }))
    .sort((a, b) => b.score - a.score);

  /*
   * Stronger levels choose from a narrower top slice.
   * This reuses the same five difficulty concepts even though Stockfish
   * itself cannot represent a 14×14 four-player game.
   */
  const rank = difficultyRank(difficulty);
  const topCount = [10, 7, 4, 2, 1][rank] ?? 1;
  const pool = candidates.slice(0, Math.min(topCount, candidates.length));

  return pool[Math.floor(Math.random() * pool.length)] ?? null;
}
