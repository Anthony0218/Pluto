import type { MinigameDefinition, MinigameCreateContext } from "../types.ts";
import { circleOverlap, RHYTHM_WINDOW } from "../rhythm/index.ts";
import { TIMING_INPUT_GRACE_MS, timingInputAt, validTimingElapsed } from "../timing.ts";

export const CIRCLE_SHOT_WINDOW = 300;
export const CIRCLE_SHOT_FLIGHT = 900;
export const CIRCLE_SHOT_TARGET_Y = 215;
export const CIRCLE_SHOT_RADIUS = 28;
export const shotCircleY = (circleAt: number, displayedAt: number, windowMs = CIRCLE_SHOT_WINDOW, radius = CIRCLE_SHOT_RADIUS) =>
  CIRCLE_SHOT_TARGET_Y + (displayedAt - circleAt) / windowMs * radius * 2;
export type ShotShape = "circle" | "square" | "diamond" | "triangle";
export interface ShotCircle { id: number; at: number; value: number; shape?: ShotShape; radius?: number; windowMs?: number; flightMs?: number }
export interface CircleShotPlayer {
  score: number; hits: number; misses: number; next: number;
  last: { at: number; overlap: number; value: number; points: number } | null;
}
export interface CircleShotState {
  startedAt: number; endsAt: number; simTime: number; circles: ShotCircle[];
  players: Record<string, CircleShotPlayer>;
  bots: Record<string, { at: number; done: boolean }>;
}
export interface CircleShotView {
  startedAt: number; endsAt: number;
  players: Record<string, CircleShotPlayer & { circle: ShotCircle | null }>;
}
interface ShotInput { type: "CIRCLE_SHOOT"; circleId: number; elapsedMs?: number }
export const shotOverlap = (error: number) => circleOverlap(error * RHYTHM_WINDOW / CIRCLE_SHOT_WINDOW);
export function shapeOverlap(shape: ShotShape, error: number, windowMs: number) {
  if (shape === "circle") return shotOverlap(error * CIRCLE_SHOT_WINDOW / windowMs);
  const fraction = Math.max(0, 1 - Math.abs(error) / windowMs);
  return shape === "square" ? fraction : fraction * fraction;
}
function create(c: MinigameCreateContext): CircleShotState {
  const circles: ShotCircle[] = [];
  for (let at = c.startedAt + 2000; at < c.endsAt - CIRCLE_SHOT_WINDOW - TIMING_INPUT_GRACE_MS;) {
    const rarity = c.random();
    const value = rarity < .03 ? 5 : rarity < .2 ? 3 : 1;
    const shape = (["circle", "square", "diamond", "triangle"] as const)[Math.min(3, Math.floor(c.random() * 4))];
    const radius = value === 5 ? 16 : value === 3 ? 21 : 28;
    const windowMs = Math.round((value === 1 ? 270 : value === 3 ? 220 : 170) + c.random() * 130);
    circles.push({ id: circles.length, at, value, shape, radius, windowMs, flightMs: 900 });
    // Leave room for a delayed shot to be judged before the next circle starts falling.
    at += Math.max(CIRCLE_SHOT_FLIGHT + CIRCLE_SHOT_WINDOW + TIMING_INPUT_GRACE_MS + 50, 1550 - circles.length * 8) + Math.round(c.random() * 150);
  }
  return { startedAt: c.startedAt, endsAt: c.endsAt, simTime: c.startedAt, circles, bots: {},
    players: Object.fromEntries(c.participants.map((p) => [p.id, { score: 0, hits: 0, misses: 0, next: 0, last: null }])) };
}
export const circleShot: MinigameDefinition<CircleShotState, ShotInput> = {
  id: "circle-shot", name: "Circle Quickshot", description: "Time one shot as matching shapes overlap. Watch for changing speeds and rare small targets.",
  instructions: ["Circle, square, diamond and triangle targets arrive at different speeds. Everyone receives the same chart.",
    "Click, press Space or tap Fire when the circle enters your target ring. Each circle gets one shot.",
    "Points = overlapping circle area × circle value. 80% overlap on a value-3 circle earns 2.4 points.",
    "Normal targets are worth 1. Smaller gold targets are worth 3; rare violet targets are worth 5. Highest total wins."],
  controls: "Click · Space · touch Fire", durationSeconds: 60, gameType: "main", supportsBots: true, snapshotIntervalMs: 50,
  create,
  parseInput(i) { return i.type === "CIRCLE_SHOOT" && Number.isSafeInteger(i.circleId) && Number(i.circleId) >= 0 && validTimingElapsed(i.elapsedMs)
    ? { type: "CIRCLE_SHOOT", circleId: Number(i.circleId), ...(i.elapsedMs !== undefined && { elapsedMs: i.elapsedMs }) } : null; },
  applyInput(s, id, input, at) {
    const p = s.players[id], circle = p && s.circles[p.next];
    const displayedAt = timingInputAt(s.startedAt, at, input.elapsedMs);
    if (!p || !circle || at < s.startedAt || at >= s.endsAt || input.circleId !== circle.id ||
      displayedAt < circle.at - CIRCLE_SHOT_FLIGHT || displayedAt >= circle.at + (circle.windowMs ?? CIRCLE_SHOT_WINDOW)) throw new Error("Wait for your next circle.");
    const overlap = shapeOverlap(circle.shape ?? "circle", displayedAt - circle.at, circle.windowMs ?? CIRCLE_SHOT_WINDOW), points = overlap * circle.value;
    p.score += points; p.next++;
    if (overlap > 0) p.hits++; else p.misses++;
    p.last = { at, overlap, points, value: circle.value };
  },
  tick(s, now) {
    const until = Math.min(now, s.endsAt); if (until <= s.simTime) return false;
    for (const p of Object.values(s.players)) while (s.circles[p.next] && s.circles[p.next].at + (s.circles[p.next].windowMs ?? CIRCLE_SHOT_WINDOW) + TIMING_INPUT_GRACE_MS <= until) {
      const circle = s.circles[p.next++]; p.misses++;
      p.last = { at: circle.at + (circle.windowMs ?? CIRCLE_SHOT_WINDOW), overlap: 0, points: 0, value: circle.value };
    }
    s.simTime = until; return true;
  },
  botInputs(s, bot, now, random) {
    const p = s.players[bot.id], circle = p && s.circles[p.next];
    if (!circle || now < circle.at - CIRCLE_SHOT_FLIGHT || now >= s.endsAt) return [];
    const plan = (s.bots[`${bot.id}:${circle.id}`] ??= {
      at: circle.at + (random() - .5) * { beginner: 700, easy: 440, medium: 345, hard: 250, extreme: 22 }[bot.difficulty],
      done: random() < { beginner: .3, easy: .15, medium: .11, hard: .07, extreme: .002 }[bot.difficulty],
    });
    if (plan.done || now < plan.at || now >= circle.at + (circle.windowMs ?? CIRCLE_SHOT_WINDOW)) return [];
    plan.done = true;
    return [{ at: Math.max(plan.at, s.simTime), input: { type: "CIRCLE_SHOOT", circleId: circle.id } }];
  },
  scores: (s) => Object.fromEntries(Object.entries(s.players).map(([id, p]) => [id, p.score])),
  rank(s, ids, random) {
    const ties = Object.fromEntries(ids.map((id) => [id, random()]));
    return [...ids].sort((a, b) => s.players[b].score - s.players[a].score || s.players[b].hits - s.players[a].hits || ties[b] - ties[a]);
  },
  publicView(s, now): CircleShotView {
    return { startedAt: s.startedAt, endsAt: s.endsAt,
      players: Object.fromEntries(Object.entries(s.players).map(([id, p]) => {
        const circle = s.circles[p.next];
        return [id, { ...p, last: p.last ? { ...p.last } : null,
          circle: circle && now >= circle.at - CIRCLE_SHOT_FLIGHT && now < circle.at + (circle.windowMs ?? CIRCLE_SHOT_WINDOW) ? { ...circle } : null }];
      })) };
  },
};
