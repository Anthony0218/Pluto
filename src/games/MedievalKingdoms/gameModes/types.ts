import type {
  BattleState,
  FactionId,
  GameModeConfig,
} from "../types";

export type GameModeEvaluation = {
  state: BattleState;
  message?: string;
};

export type GameModeEvaluator = (
  state: BattleState,
  config: GameModeConfig | undefined,
  actingFaction: FactionId,
) => GameModeEvaluation;
