import type { MinigameDefinition } from "../types.ts";
import { streetCrossBotInputs } from "./bot.ts";
import { STREET_CROSS_CONFIG } from "./config.ts";
import {
  applyStreetInput,
  createStreetCross,
  isFinishedStreet,
  parseStreetInput,
  rankStreetCross,
  streetCrossView,
  tickStreetCross,
  type StreetCrossInput,
  type StreetCrossState,
} from "./logic.ts";

export const streetCross: MinigameDefinition<StreetCrossState, StreetCrossInput> = {
  id: "street-cross",
  name: "Street Cross",
  description: "First across the traffic wins.",
  instructions: [
    "Cross three roads to the finish line",
    "Getting hit sends you back to your last safe strip",
    "Safe strips are checkpoints",
  ],
  controls: "Joystick (touch) or WASD / arrow keys",
  durationSeconds: STREET_CROSS_CONFIG.durationSeconds,
  gameType: "duel",
  supportsBots: true,
  create: createStreetCross,
  parseInput: parseStreetInput,
  applyInput: applyStreetInput,
  botInputs: streetCrossBotInputs,
  scores: (state) =>
    Object.fromEntries(
      Object.entries(state.runners).map(([id, r]) => [id, Math.round(r.bestY * 10) / 10]),
    ),
  rank: rankStreetCross,
  publicView: streetCrossView,
  tick: tickStreetCross,
  isFinished: isFinishedStreet,
  snapshotIntervalMs: STREET_CROSS_CONFIG.snapshotIntervalMs,
};
