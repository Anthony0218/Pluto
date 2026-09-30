import type { MinigameDefinition } from "../types.ts";
import { TARGET_PANIC_CONFIG } from "./config.ts";
import {
  applyTargetHit,
  createTargetPanic,
  parseTargetPanicInput,
  rankTargetPanic,
  targetPanicView,
  type TargetPanicInput,
  type TargetPanicState,
} from "./logic.ts";
import { targetPanicBotInputs } from "./bot.ts";

export const targetPanic: MinigameDefinition<
  TargetPanicState,
  TargetPanicInput
> = {
  id: "target-panic",
  name: "Target Panic",
  description: "Tap targets as fast as you can. Highest score wins.",
  instructions: [
    "Tap blue targets: +1",
    "Golden targets: +3",
    "Avoid red spiky targets: −2",
  ],
  controls: "Tap or click targets",
  durationSeconds: TARGET_PANIC_CONFIG.durationSeconds,
  gameType: "main",
  supportsBots: true,
  create: createTargetPanic,
  parseInput: parseTargetPanicInput,
  applyInput: applyTargetHit,
  botInputs: targetPanicBotInputs,
  scores: (state) =>
    Object.fromEntries(
      Object.entries(state.players).map(([id, p]) => [id, p.score]),
    ),
  rank: rankTargetPanic,
  publicView: targetPanicView,
};
