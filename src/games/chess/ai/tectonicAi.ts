import { type Chess } from "chess.js";

import {
  applyTectonicShift,
  canSkipTectonicShift,
  getLegalTectonicQuadrants,
  type TectonicQuadrant,
  type TectonicState,
} from "../variants/tectonicChess";

import {
  difficultyLevels,
  type Difficulty,
} from "./variantAi";

const pieceValue: Record<string, number> = {
  p: 100,
  n: 320,
  b: 330,
  r: 500,
  q: 900,
  k: 0,
};

function materialScore(game: Chess, side: "w" | "b") {
  let score = 0;

  for (const row of game.board()) {
    for (const piece of row) {
      if (!piece) continue;

      const value = pieceValue[piece.type] ?? 0;

      score += piece.color === side ? value : -value;
    }
  }

  return score;
}

export function chooseTectonicAiShift(
  game: Chess,
  state: TectonicState,
  difficulty: Difficulty,
): TectonicQuadrant | null {
  const side = game.turn();
  const quadrants = getLegalTectonicQuadrants(game, state);
  const canSkip = canSkipTectonicShift(game, state);

  const actions: Array<TectonicQuadrant | null> = [
    ...quadrants,
    ...(canSkip ? [null] : []),
  ];

  if (actions.length === 0) {
    return null;
  }

  const settings = difficultyLevels[difficulty];

  if (
    settings.randomMoveChance > 0 &&
    Math.random() < settings.randomMoveChance
  ) {
    return actions[Math.floor(Math.random() * actions.length)];
  }

  let bestAction = actions[0];
  let bestScore = -Infinity;

  for (const action of actions) {
    const result = applyTectonicShift(game, state, action);

    if (!result) continue;

    let score = materialScore(result.game, side);

    /*
     * A shift that immediately checks the opponent is useful.
     * After the shift, result.game.turn() is the opponent.
     */
    if (result.game.isCheck()) {
      score += 90;
    }

    if (result.game.isCheckmate()) {
      score += 100000;
    }

    /*
     * Slight bias against skipping when a legal geometric action exists.
     */
    if (action === null && quadrants.length > 0) {
      score -= 10;
    }

    if (score > bestScore) {
      bestScore = score;
      bestAction = action;
    }
  }

  return bestAction;
}
