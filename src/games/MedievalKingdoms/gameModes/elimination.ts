import type {
  GameModeEvaluator,
} from "./types";

export const evaluateElimination: GameModeEvaluator = (
  state,
) => {
  const living =
    Array.from(
      new Set(
        state.units.map(
          (unit) =>
            unit.faction,
        ),
      ),
    );

  if (
    living.length ===
    1
  ) {
    return {
      state: {
        ...state,
        winner:
          living[0],
      },

      message:
        `${living[0]} wins by elimination.`,
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
