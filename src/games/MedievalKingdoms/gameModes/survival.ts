import type {
  GameModeEvaluator,
} from "./types";

export const evaluateSurvival: GameModeEvaluator = (
  state,
  config,
) => {
  const playerFaction =
    config?.playerFaction ??
    "falconstone";

  const targetRound =
    config?.targetRound ??
    8;

  const playerAlive =
    state.units.some(
      (unit) =>
        unit.faction ===
        playerFaction,
    );

  if (!playerAlive) {
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
        "The defending army was destroyed.",
    };
  }

  if (
    state.round >=
    targetRound
  ) {
    return {
      state: {
        ...state,
        winner:
          playerFaction,
      },

      message:
        `${playerFaction} survived until round ${targetRound}.`,
    };
  }

  return {
    state: {
      ...state,
      winner:
        null,
    },

    message:
      `Survive until round ${targetRound}.`,
  };
};
