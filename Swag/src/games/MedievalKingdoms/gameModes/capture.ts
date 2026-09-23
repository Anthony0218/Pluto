import type {
  GameModeEvaluator,
} from "./types";

export const evaluateCapture: GameModeEvaluator = (
  state,
  _config,
  actingFaction,
) => {
  if (
    state.objective.controlledBy ===
    actingFaction
  ) {
    return {
      state: {
        ...state,
        winner:
          actingFaction,
      },

      message:
        `${actingFaction} captured the objective.`,
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
