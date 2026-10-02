import type { MinigameParticipant, Random, TimedInput } from "../types.ts";
import { TARGET_PANIC_CONFIG as CONFIG } from "./config.ts";
import type { TargetPanicInput, TargetPanicState } from "./logic.ts";

// Target Panic bot controller. A bot notices each target when it appears, decides whether to go for it
// (accuracy for good targets, mistake chance for danger targets) and taps after a randomized reaction
// delay. Taps are sequential, so a busy screen makes it slower. Every tap is still validated by
// `applyTargetHit`; a reaction that comes too late is simply rejected like a human's would be.
export function targetPanicBotInputs(
  state: TargetPanicState,
  bot: MinigameParticipant,
  now: number,
  random: Random,
): TimedInput<TargetPanicInput>[] {
  const profile = CONFIG.bots[bot.difficulty];
  let plan = state.bots[bot.id];
  if (!plan) {
    // A bot that takes over mid-game (for example after a disconnect) starts with what is on screen now.
    const first = state.targets.findIndex((t) => t.expiresAt > now);
    plan = state.bots[bot.id] = {
      nextTargetIndex: first === -1 ? state.targets.length : first,
      lastTapAt: 0,
      queue: [],
    };
  }
  while (
    plan.nextTargetIndex < state.targets.length &&
    state.targets[plan.nextTargetIndex].spawnAt <= now
  ) {
    const target = state.targets[plan.nextTargetIndex++];
    const wants =
      target.kind === "danger"
        ? random() < profile.mistakeChance
        : random() < profile.accuracy;
    if (!wants) continue;
    const [min, max] = profile.reactionMs;
    const reaction = min + random() * (max - min);
    const at = Math.round(
      Math.max(target.spawnAt + reaction, plan.lastTapAt + CONFIG.botTapGapMs),
    );
    plan.lastTapAt = at;
    plan.queue.push({ targetId: target.id, at });
  }
  const due = plan.queue.filter((q) => q.at <= now);
  plan.queue = plan.queue.filter((q) => q.at > now);
  return due.map((q) => ({
    input: { type: "TARGET_HIT", targetId: q.targetId },
    at: q.at,
  }));
}
