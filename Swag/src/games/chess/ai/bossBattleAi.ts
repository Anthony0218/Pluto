import { type Chess, type Square } from "chess.js";

import {
  canUseBossPower,
  getDarkStepSquares,
  getSummonSquares,
  type BossBattleState,
  type BossPowerId,
} from "../variants/bossBattle";

import {
  difficultyLevels,
  type Difficulty,
} from "./variantAi";

export type BossAiPowerAction = {
  power: BossPowerId;
  target?: Square;
};

export function chooseBossAiPower(
  game: Chess,
  state: BossBattleState,
  difficulty: Difficulty,
): BossAiPowerAction | null {
  if (game.turn() !== "b" || game.isCheck()) {
    return null;
  }

  const available = (
    ["shockwave", "summon", "dark_step"] as BossPowerId[]
  ).filter((power) => canUseBossPower(game, state, power));

  if (available.length === 0) {
    return null;
  }

  /*
   * Beginner/Easy use powers less consistently. Hard/Expert make much
   * fuller use of the variant mechanics.
   */
  const rankChance: Record<Difficulty, number> = {
    beginner: 0.18,
    easy: 0.28,
    medium: 0.42,
    hard: 0.60,
    expert: 0.75,
  };

  if (Math.random() > rankChance[difficulty]) {
    return null;
  }

  if (available.includes("shockwave")) {
    return { power: "shockwave" };
  }

  if (available.includes("summon")) {
    const squares = getSummonSquares(game);

    if (squares.length > 0) {
      /*
       * Prefer central summon squares at stronger levels.
       */
      const ordered = [...squares].sort((a, b) => {
        const af = Math.abs(a.charCodeAt(0) - "e".charCodeAt(0));
        const bf = Math.abs(b.charCodeAt(0) - "e".charCodeAt(0));

        return af - bf;
      });

      const settings = difficultyLevels[difficulty];
      const target =
        settings.randomMoveChance > 0 &&
        Math.random() < settings.randomMoveChance
          ? squares[Math.floor(Math.random() * squares.length)]
          : ordered[0];

      return { power: "summon", target };
    }
  }

  if (available.includes("dark_step")) {
    const squares = getDarkStepSquares(game);

    if (squares.length > 0) {
      return {
        power: "dark_step",
        target: squares[Math.floor(Math.random() * squares.length)],
      };
    }
  }

  return null;
}
