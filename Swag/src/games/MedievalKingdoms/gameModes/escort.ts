import {
  distance,
} from "../battleEngine";

import type {
  GameModeEvaluator,
} from "./types";

export const evaluateEscort: GameModeEvaluator = (
  state,
  config,
) => {
  const playerFaction =
    config?.playerFaction ??
    "falconstone";

  if (!config?.escortUnitId) {
    return {
      state: {
        ...state,
        winner:
          null,
      },

      message:
        "Escort mode needs gameModeConfig.escortUnitId.",
    };
  }

  const escort =
    state.units.find(
      (unit) =>
        unit.id ===
        config.escortUnitId,
    );

  if (!escort) {
    const enemy =
      state.units.find(
        (unit) =>
          unit.faction !==
          playerFaction,
      )?.faction;

    return {
      state: {
        ...state,
        winner:
          enemy ??
          null,
      },

      message:
        "The escorted unit was lost.",
    };
  }

  const reached =
    distance(
      escort.position,
      state.objective.position,
      1,
    ) <=
      state.objective.radius;

  return {
    state: {
      ...state,
      winner:
        reached
          ? playerFaction
          : null,
    },

    message:
      reached
        ? "The escorted unit reached the objective."
        : undefined,
  };
};
