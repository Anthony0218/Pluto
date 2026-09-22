import type {
  GameModeEvaluator,
} from "./types";

export const evaluateBoss: GameModeEvaluator = (
  state,
  config,
) => {
  const playerFaction =
    config?.playerFaction ??
    "falconstone";

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
        "The player's army was destroyed.",
    };
  }

  const configuredBoss =
    config?.bossUnitId
      ? state.units.some(
          (unit) =>
            unit.id ===
            config.bossUnitId,
        )
      : null;

  const enemiesAlive =
    state.units.some(
      (unit) =>
        unit.faction !==
        playerFaction,
    );

  const bossAlive =
    configuredBoss ===
    null
      ? enemiesAlive
      : configuredBoss;

  if (!bossAlive) {
    return {
      state: {
        ...state,
        winner:
          playerFaction,
      },

      message:
        `${playerFaction} defeated the boss encounter.`,
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
