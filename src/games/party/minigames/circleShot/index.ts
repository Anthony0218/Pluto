import type { MinigameDefinition, MinigameCreateContext } from "../types.ts";
import { circleOverlap, RHYTHM_WINDOW } from "../rhythm/index.ts";

export const CIRCLE_SHOT_WINDOW = 300;
export const CIRCLE_SHOT_FLIGHT = 900;
export interface ShotCircle { id: number; at: number; value: number }
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
interface ShotInput { type: "CIRCLE_SHOOT"; circleId: number }
export const shotOverlap = (error: number) => circleOverlap(error * RHYTHM_WINDOW / CIRCLE_SHOT_WINDOW);
function create(c: MinigameCreateContext): CircleShotState {
  const circles: ShotCircle[] = [];
  for (let at = c.startedAt + 2000; at < c.endsAt - CIRCLE_SHOT_WINDOW;) {
    const rarity = c.random();
    circles.push({ id: circles.length, at, value: rarity < .03 ? 5 : rarity < .2 ? 3 : 1 });
    // The previous circle expires before the next starts falling, even if nobody fires.
    at += Math.max(1250, 1550 - circles.length * 8) + Math.round(c.random() * 150);
  }
  return { startedAt: c.startedAt, endsAt: c.endsAt, simTime: c.startedAt, circles, bots: {},
    players: Object.fromEntries(c.participants.map((p) => [p.id, { score: 0, hits: 0, misses: 0, next: 0, last: null }])) };
}
export const circleShot: MinigameDefinition<CircleShotState, ShotInput> = {
  id: "circle-shot", name: "Circle Quickshot", description: "One weapon, one target. Fire when the falling circle overlaps your ring.",
  instructions: ["All four players appear in separate quadrants. Each player gets only one falling circle at a time.",
    "Click, press Space or tap Fire when the circle enters your target ring. Each circle gets one shot.",
    "Points = overlapping circle area × circle value. 80% overlap on a value-3 circle earns 2.4 points.",
    "White circles are worth 1, gold 3 and violet 5. Highest total wins."],
  controls: "Click · Space · touch Fire", durationSeconds: 60, gameType: "main", supportsBots: true, snapshotIntervalMs: 50,
  create,
  parseInput(i) { return i.type === "CIRCLE_SHOOT" && Number.isSafeInteger(i.circleId) && Number(i.circleId) >= 0 ? { type: "CIRCLE_SHOOT", circleId: Number(i.circleId) } : null; },
  applyInput(s, id, input, at) {
    const p = s.players[id], circle = p && s.circles[p.next];
    if (!p || !circle || at < s.startedAt || at >= s.endsAt || input.circleId !== circle.id ||
      at < circle.at - CIRCLE_SHOT_FLIGHT || at >= circle.at + CIRCLE_SHOT_WINDOW) throw new Error("Wait for your next circle.");
    const overlap = shotOverlap(at - circle.at), points = overlap * circle.value;
    p.score += points; p.next++;
    if (overlap > 0) p.hits++; else p.misses++;
    p.last = { at, overlap, points, value: circle.value };
  },
  tick(s, now) {
    const until = Math.min(now, s.endsAt); if (until <= s.simTime) return false;
    for (const p of Object.values(s.players)) while (s.circles[p.next] && s.circles[p.next].at + CIRCLE_SHOT_WINDOW <= until) {
      const circle = s.circles[p.next++]; p.misses++;
      p.last = { at: circle.at + CIRCLE_SHOT_WINDOW, overlap: 0, points: 0, value: circle.value };
    }
    s.simTime = until; return true;
  },
  botInputs(s, bot, now, random) {
    const p = s.players[bot.id], circle = p && s.circles[p.next];
    if (!circle || now < circle.at - CIRCLE_SHOT_FLIGHT || now >= s.endsAt) return [];
    const plan = (s.bots[`${bot.id}:${circle.id}`] ??= {
      at: circle.at + (random() - .5) * { easy: 440, medium: 250, hard: 110 }[bot.difficulty],
      done: random() < { easy: .15, medium: .07, hard: .02 }[bot.difficulty],
    });
    if (plan.done || now < plan.at || now >= circle.at + CIRCLE_SHOT_WINDOW) return [];
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
          circle: circle && now >= circle.at - CIRCLE_SHOT_FLIGHT && now < circle.at + CIRCLE_SHOT_WINDOW ? { ...circle } : null }];
      })) };
  },
};
