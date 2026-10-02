import type {
  GameModeEvaluator,
} from "./types";

/**
 * Prototype artifact rule:
 * control the objective at end of turn.
 * Later this can be replaced by a real carry/drop artifact state.
 */
export const evaluateArtifact: GameModeEvaluator = (
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
        `${actingFaction} secured the artifact.`,
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
