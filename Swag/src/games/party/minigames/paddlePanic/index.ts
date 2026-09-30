import type { MinigameDefinition } from "../types.ts";
import { paddlePanicBotInputs } from "./bot.ts";
import { PADDLE_PANIC_CONFIG } from "./config.ts";
import {
  applyPaddleInput,
  createPaddlePanic,
  paddlePanicView,
  parsePaddleInput,
  rankPaddlePanic,
  tickPaddlePanic,
  type PaddlePanicInput,
  type PaddlePanicState,
} from "./logic.ts";

export const paddlePanic: MinigameDefinition<PaddlePanicState, PaddlePanicInput> = {
  id: "paddle-panic",
  name: "Paddle Panic",
  description: `First to ${PADDLE_PANIC_CONFIG.pointsToWin} points wins.`,
  instructions: [
    "Keep the ball out of your goal",
    "Hitting the ball with your paddle's edge sends it at a steep angle",
    "The ball speeds up with every return",
  ],
  controls: "Drag up and down anywhere on the court (mouse, touch or ↑ ↓ / W S)",
  durationSeconds: PADDLE_PANIC_CONFIG.durationSeconds,
  gameType: "duel",
  supportsBots: true,
  create: createPaddlePanic,
  parseInput: parsePaddleInput,
  applyInput: applyPaddleInput,
  botInputs: paddlePanicBotInputs,
  scores: (state) => ({ ...state.scores }),
  rank: rankPaddlePanic,
  publicView: paddlePanicView,
  tick: tickPaddlePanic,
  isFinished: (state) => state.winnerId !== null,
  snapshotIntervalMs: PADDLE_PANIC_CONFIG.snapshotIntervalMs,
};
