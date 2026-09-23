import { type Chess, type Square } from "chess.js";

import {
  getFogVisibleSquares,
  type FogSide,
} from "../variants/fogOfWarChess";

import {
  difficultyLevels,
  difficultyRank,
  type Difficulty,
  type VariantAiMove,
} from "./variantAi";

const pieceValue: Record<string, number> = {
  p: 100,
  n: 320,
  b: 330,
  r: 500,
  q: 900,
  k: 20000,
};

type Candidate = VariantAiMove & {
  score: number;
};

/**
 * Fair-information Fog AI.
 *
 * It deliberately does NOT send the full FEN to Stockfish. It only scores
 * legal moves using information visible to the moving side. That avoids the
 * AI gaining an unfair advantage from hidden enemy pieces.
 */
export function chooseFogAiMove(
  game: Chess,
  side: FogSide,
  difficulty: Difficulty,
): VariantAiMove | null {
  const moves = game.moves({ verbose: true });

  if (moves.length === 0) {
    return null;
  }

  const settings = difficultyLevels[difficulty];

  if (
    settings.randomMoveChance > 0 &&
    Math.random() < settings.randomMoveChance
  ) {
    const move = moves[Math.floor(Math.random() * moves.length)];

    return {
      from: move.from as Square,
      to: move.to as Square,
      promotion: move.promotion as VariantAiMove["promotion"],
    };
  }

  const visible = new Set(getFogVisibleSquares(game, side));

  const candidates: Candidate[] = moves
    .map((move) => {
      let score = 0;

      const target =
        visible.has(move.to as Square)
          ? game.get(move.to as Square)
          : null;

      if (target && target.color !== side) {
        score += pieceValue[target.type] ?? 0;
      }

      if (move.san.includes("+")) score += 80;
      if (move.san.includes("#")) score += 100000;

      const file = move.to.charCodeAt(0) - "a".charCodeAt(0);
      const rank = Number(move.to[1]) - 1;
      score += 18 - (Math.abs(file - 3.5) + Math.abs(rank - 3.5)) * 2;

      if (move.promotion) {
        score += pieceValue[move.promotion] ?? 0;
      }

      return {
        from: move.from as Square,
        to: move.to as Square,
        promotion: move.promotion as VariantAiMove["promotion"],
        score,
      };
    })
    .sort((a, b) => b.score - a.score);

  const rank = difficultyRank(difficulty);
  const topCount = [12, 8, 5, 2, 1][rank] ?? 1;
  const pool = candidates.slice(0, Math.min(topCount, candidates.length));

  return pool[Math.floor(Math.random() * pool.length)] ?? null;
}
