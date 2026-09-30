import type {
  GameModeEvaluator,
} from "./types";

export const evaluateDefense: GameModeEvaluator = (
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
        "The defenders were defeated.",
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
        `${playerFaction} held the position through round ${targetRound}.`,
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
