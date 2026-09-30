import type {
  GameMode,
  GameModeConfig,
  BattleState,
  FactionId,
} from "../types";

import {
  evaluateArtifact,
} from "./artifact";

import {
  evaluateBoss,
} from "./boss";

import {
  evaluateBreakthrough,
} from "./breakthrough";

import {
  evaluateCapture,
} from "./capture";

import {
  evaluateDefense,
} from "./defense";

import {
  evaluateElimination,
} from "./elimination";

import {
  evaluateEscort,
} from "./escort";

import {
  evaluateKingOfTheHill,
} from "./kingOfTheHill";

import {
  evaluateSurvival,
} from "./survival";

import type {
  GameModeEvaluator,
  GameModeEvaluation,
} from "./types";

export const GAME_MODE_LABELS: Record<GameMode, string> = {
  elimination:
    "Elimination",

  capture:
    "Capture",

  kingOfTheHill:
    "King of the Hill",

  defense:
    "Defense",

  survival:
    "Survival",

  boss:
    "Boss Battle",

  escort:
    "Escort",

  breakthrough:
    "Breakthrough",

  artifact:
    "Artifact",
};

export const GAME_MODE_DESCRIPTIONS: Record<GameMode, string> = {
  elimination:
    "Defeat every opposing unit.",

  capture:
    "End your turn as the sole faction controlling the objective.",

  kingOfTheHill:
    "Control the objective across multiple turns to build victory points.",

  defense:
    "Keep your army alive until the required round.",

  survival:
    "Survive until the required round.",

  boss:
    "Defeat the boss encounter.",

  escort:
    "Bring the escorted unit to the objective.",

  breakthrough:
    "Reach the objective with one of your units.",

  artifact:
    "Secure the artifact objective.",
};

const EVALUATORS: Record<GameMode, GameModeEvaluator> = {
  elimination:
    evaluateElimination,

  capture:
    evaluateCapture,

  kingOfTheHill:
    evaluateKingOfTheHill,

  defense:
    evaluateDefense,

  survival:
    evaluateSurvival,

  boss:
    evaluateBoss,

  escort:
    evaluateEscort,

  breakthrough:
    evaluateBreakthrough,

  artifact:
    evaluateArtifact,
};

export function evaluateGameMode(
  state: BattleState,
  gameMode: GameMode,
  config: GameModeConfig | undefined,
  actingFaction: FactionId,
): GameModeEvaluation {
  return EVALUATORS[
    gameMode
  ](
    state,
    config,
    actingFaction,
  );
}
