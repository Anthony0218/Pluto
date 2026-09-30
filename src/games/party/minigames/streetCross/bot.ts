import type { MinigameParticipant, Random, TimedInput } from "../types.ts";
import { FINISH_ROW, STREET_CROSS_CONFIG as CONFIG } from "./config.ts";
import {
  laneHitsBox,
  type StreetCrossInput,
  type StreetCrossState,
} from "./logic.ts";

const gauss = (random: Random) =>
  Math.sqrt(-2 * Math.log(Math.max(1e-9, random()))) * Math.cos(2 * Math.PI * random());

// Street Cross bot. It only looks at the traffic currently on screen (positions and speeds, the same
// things a player sees) and extrapolates it; its timing estimate is blurred by difficulty.
// - On a safe strip it waits (in the middle of the strip) until the whole road ahead looks clear for the
//   time it needs to cross each lane at full speed, then commits to that road section without second
//   guesses (sometimes it goes anyway by mistake, and a blurred estimate can be wrong).
// Movement is a normal MOVE input, validated exactly like a human's.
export function streetCrossBotInputs(
  state: StreetCrossState,
  bot: MinigameParticipant,
  now: number,
  random: Random,
): TimedInput<StreetCrossInput>[] {
  const runner = state.runners[bot.id];
  if (!runner || runner.finishedAt !== null) return [];
  const profile = CONFIG.bots[bot.difficulty];
  const plan = (state.bots[bot.id] ??= { nextAt: now, dy: 0, commitRow: null, commitHits: 0 });
  if (now < plan.nextAt) return [];
  plan.nextAt = now + profile.decisionMs * (0.7 + random() * 0.6);
  const elapsed = now - state.startedAt,
    speed = CONFIG.player.speed,
    r = CONFIG.player.radius,
    halfWidth = r + profile.marginUnits,
    error = gauss(random) * profile.misjudgeSec;
  const laneAt = (row: number) => state.lanes.find((l) => l.row === row);
  // Is lane `row` free around the bot during [from, to] seconds from now (as the bot judges it)?
  const clear = (row: number, from: number, to: number) => {
    const lane = laneAt(row);
    if (!lane) return true;
    for (let t = Math.max(0, from + error); t <= Math.max(0, to + error); t += 0.08)
      if (laneHitsBox(lane, elapsed + t * 1000, runner.x, halfWidth)) return false;
    return true;
  };
  // Time window in which the bot's body overlaps `row` when moving up at full speed from here.
  const crossing = (row: number) => [
    Math.max(0, (row - (runner.y + r)) / speed),
    (row + 1 - (runner.y - r)) / speed,
  ] as const;
  const row = Math.floor(runner.y);
  // A hit (back to the checkpoint) or reaching the target strip ends the commitment.
  if (plan.commitRow !== null && (runner.hits !== plan.commitHits || row >= plan.commitRow))
    plan.commitRow = null;
  let dy: number;
  if (now < runner.stunnedUntil) dy = 0;
  else if (plan.commitRow !== null) dy = 1;
  else if (!laneAt(row)) {
    // Safe strip: judge every lane up to the next safe strip, then commit to crossing all of them.
    let nextSafe = row + 1,
      clearAhead = true;
    for (; nextSafe < FINISH_ROW && laneAt(nextSafe); nextSafe++)
      clearAhead &&= clear(nextSafe, ...crossing(nextSafe));
    if (clearAhead || random() < profile.mistakeChance) {
      dy = 1;
      plan.commitRow = nextSafe;
      plan.commitHits = runner.hits;
    } else if (runner.y > row + 0.6) {
      // Waiting at the kerb would clip the next lane: step back to the middle of the strip, and look
      // again as soon as it gets there.
      dy = -1;
      plan.nextAt = Math.min(plan.nextAt, now + ((runner.y - row - 0.5) / speed) * 1000);
    } else dy = 0;
  } else {
    // On the road without a plan (e.g. just respawned mid-course): keep moving unless it is safer to pause.
    const next = row + 1,
      nextClear = !laneAt(next) || clear(next, ...crossing(next)),
      hereClear = clear(row, 0, 0.5);
    dy = nextClear || !hereClear ? 1 : 0;
  }
  if (dy === plan.dy) return [];
  plan.dy = dy;
  return [{ input: { type: "MOVE", dx: 0, dy }, at: now }];
}
