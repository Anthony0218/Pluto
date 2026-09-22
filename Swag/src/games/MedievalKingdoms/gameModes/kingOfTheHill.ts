import type {
  GameModeEvaluator,
} from "./types";

export const evaluateKingOfTheHill: GameModeEvaluator = (
  state,
  config,
) => {
  const scoreToWin =
    config?.scoreToWin ??
    3;

  const controller =
    state.objective.controlledBy;

  if (!controller) {
    return {
      state: {
        ...state,
        winner:
          null,
      },
    };
  }

  const currentScore =
    state.modeState.scores[
      controller
    ] ?? 0;

  const nextScore =
    currentScore + 1;

  const scores = {
    ...state.modeState.scores,
    [controller]:
      nextScore,
  };

  return {
    state: {
      ...state,

      modeState: {
        ...state.modeState,
        scores,
      },

      winner:
        nextScore >=
        scoreToWin
          ? controller
          : null,
    },

    message:
      nextScore >=
      scoreToWin
        ? `${controller} wins the hill ${nextScore}-${scoreToWin}.`
        : `${controller} controls the hill: ${nextScore}/${scoreToWin}.`,
  };
};
