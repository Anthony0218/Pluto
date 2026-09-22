import {
  distance,
} from "../battleEngine";

import type {
  GameModeEvaluator,
} from "./types";

export const evaluateBreakthrough: GameModeEvaluator = (
  state,
  config,
) => {
  const playerFaction =
    config?.playerFaction ??
    "falconstone";

  const reached =
    state.units.some(
      (unit) =>
        unit.faction ===
          playerFaction &&
        distance(
          unit.position,
          state.objective.position,
          1,
        ) <=
          state.objective.radius,
    );

  if (reached) {
    return {
      state: {
        ...state,
        winner:
          playerFaction,
      },

      message:
        `${playerFaction} broke through to the objective.`,
    };
  }

  return {
    state: {
      ...state,
      winner:
        null,
    },
  };
};
