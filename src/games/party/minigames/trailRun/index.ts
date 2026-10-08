import type { MinigameDefinition, MinigameCreateContext } from "../types.ts";
import type { MinigameInput } from "../../types.ts";

export type TrailTheme = "ice" | "jungle" | "sky";
export interface TrailPlatform { x: number; w: number; y: number; }
export const TRAIL_MAPS: Record<TrailTheme, TrailPlatform[]> = {
  ice: [{ x: 0, w: 6, y: 0 }, { x: 6.5, w: 3, y: .3 }, { x: 11, w: 3, y: 0 }, { x: 15.5, w: 3, y: .7 }, { x: 20.5, w: 4, y: .2 }, { x: 26, w: 3, y: 1 }, { x: 30.5, w: 3, y: .5 }, { x: 35, w: 3, y: 0 }, { x: 40.5, w: 5, y: .4 }, { x: 46, w: 4, y: 0 }],
  jungle: [{ x: 0, w: 6, y: 0 }, { x: 6, w: 2.5, y: 1 }, { x: 10, w: 2.5, y: 1.8 }, { x: 14, w: 3, y: .8 }, { x: 19, w: 4, y: 0 }, { x: 24.5, w: 3, y: 1 }, { x: 29, w: 3, y: 1.8 }, { x: 34, w: 4, y: .7 }, { x: 39.5, w: 3, y: 1.5 }, { x: 45.5, w: 6, y: 0 }],
  sky: [{ x: 0, w: 6, y: 0 }, { x: 6.7, w: 3, y: .6 }, { x: 11.8, w: 3.5, y: 1.1 }, { x: 17, w: 3, y: .3 }, { x: 22, w: 3.5, y: 1 }, { x: 27.1, w: 3, y: 1.7 }, { x: 32.4, w: 3.8, y: .6 }, { x: 37.7, w: 3, y: 1.2 }, { x: 43, w: 5, y: .5 }, { x: 48, w: 4, y: 0 }],
};
export const TRAIL_FINISH: Record<TrailTheme, number> = { ice: 45, jungle: 44, sky: 47 };
export const trailPlatformY = (theme: TrailTheme, index: number, now: number) => TRAIL_MAPS[theme][index].y + (theme === "jungle" && [2, 5, 8].includes(index) ? Math.sin(now / 1100 + index) * .25 : 0);
const THEMES: TrailTheme[] = ["ice", "jungle", "sky"];
interface Runner { x: number; y: number; vx: number; vy: number; lane: number; grounded: boolean; checkpoint: number; furthest: number; finishAt: number | null; falls: number; respawnUntil: number; score: number; lastGroundedAt?: number; jumpBufferedUntil?: number; }
interface RunInput { type: "RUN_CONTROL"; forward: number; jump: boolean; round: number; }
export interface TrailState {
  startedAt: number; endsAt: number; simTime: number; round: number; theme: TrailTheme; phase: "race" | "break" | "finished"; phaseEndsAt: number;
  players: Record<string, Runner>; controls: Record<string, { input: RunInput; at: number; jumping: boolean }>;
  results: { round: number; theme: TrailTheme; ranking: string[]; points: Record<string, number> }[];
  bots: Record<string, { nextAt: number; jump: boolean }>; seed: number;
}
export type TrailView = Omit<TrailState, "controls" | "bots" | "seed">;
function runner(lane: number, score = 0): Runner { return { x: -1, y: 0, vx: 0, vy: 0, lane, grounded: true, checkpoint: 0, furthest: -1, finishAt: null, falls: 0, respawnUntil: 0, score }; }
function create(c: MinigameCreateContext): TrailState {
  return { startedAt: c.startedAt, endsAt: c.endsAt, simTime: c.startedAt, round: 1, theme: "ice", phase: "race", phaseEndsAt: c.startedAt + 20_000,
    players: Object.fromEntries(c.participants.map((p, i) => [p.id, runner(i)])), controls: {}, results: [], bots: {}, seed: Math.floor(c.random() * 4294967296) };
}
function finishRace(s: TrailState, at: number) {
  const ties = Object.fromEntries(Object.keys(s.players).map((id) => { s.seed = (Math.imul(s.seed, 1664525) + 1013904223) >>> 0; return [id, s.seed]; }));
  const ranking = Object.keys(s.players).sort((a, b) => (s.players[a].finishAt ?? Infinity) - (s.players[b].finishAt ?? Infinity) ||
    s.players[b].furthest - s.players[a].furthest || s.players[a].falls - s.players[b].falls || ties[b] - ties[a]);
  const points = Object.fromEntries(ranking.map((id, i) => [id, Math.max(0, 3 - i)]));
  for (const id of ranking) s.players[id].score += points[id];
  s.results.push({ round: s.round, theme: s.theme, ranking, points }); s.phase = s.round === 3 ? "finished" : "break"; s.phaseEndsAt = at + 1800;
}
// Shared fixed-step physics keeps short client predictions on the same platforms as the authority.
function stepRunner(p: Runner, theme: TrailTheme, input: Pick<RunInput, "forward" | "jump"> | null, jumping: boolean, next: number, dt: number) {
  const speed = input?.forward ?? 0, accel = theme === "ice" ? 7 : 28;
  p.vx += Math.max(-accel * dt, Math.min(accel * dt, speed * 6 - p.vx));
  if (p.grounded) p.lastGroundedAt = next;
  if (input?.jump && !jumping) p.jumpBufferedUntil = next + 120;
  if ((p.jumpBufferedUntil ?? 0) >= next && (p.grounded || next - (p.lastGroundedAt ?? -Infinity) <= 100)) { p.vy = 9; p.grounded = false; p.jumpBufferedUntil = 0; p.lastGroundedAt = -Infinity; }
  const oldY = p.y;
  p.x += (p.vx + (theme === "sky" ? Math.sin(next / 1700) * .35 : 0)) * dt;
  p.x = Math.max(-2.4, p.x); p.vy -= 22 * dt; p.y += p.vy * dt; p.grounded = false;
  const platforms = TRAIL_MAPS[theme];
  for (let i = 0; i < platforms.length; i++) {
    const platform = { ...platforms[i], y: trailPlatformY(theme, i, next) };
    if (p.vy <= 0 && oldY >= platform.y - .015 && p.y <= platform.y && Math.abs(p.x - platform.x) < platform.w / 2 + .12) {
      p.y = platform.y; p.vy = 0; p.grounded = true; if (i === 3 || i === 6) p.checkpoint = Math.max(p.checkpoint, i); break;
    }
  }
  p.furthest = Math.max(p.furthest, p.x);
  if (p.y < -4) { const platform = platforms[p.checkpoint]; Object.assign(p, { x: platform.x, y: platform.y, vx: 0, vy: 0, grounded: true, respawnUntil: next + 600 }); p.falls++; }
  if (p.grounded && p.x >= TRAIL_FINISH[theme]) { p.finishAt = next; p.vx = 0; }
}

export function predictTrailRunner(p: Runner, theme: TrailTheme, simTime: number, now: number, input = { forward: p.vx / 6, jump: false }, jumping = false): Runner {
  const predicted = { ...p };
  const end = Math.min(now, simTime + 150);
  for (let at = simTime; at < end;) {
    const next = Math.min(at + 20, end);
    if (predicted.finishAt === null && next >= predicted.respawnUntil)
      stepRunner(predicted, theme, input, jumping, next, (next - at) / 1000);
    jumping = input.jump; at = next;
  }
  return predicted;
}

export const trailRun: MinigameDefinition<TrailState, RunInput> = {
  id: "trail-run", name: "Triple Trail", description: "Race through ice, jungle and clouds in three different 3D obstacle courses.",
  instructions: ["Run right and jump between platforms. Falling sends you to your last checkpoint.", "Three races: slippery ice, swinging jungle treetops, and a windy course over the clouds.",
    "Each race gives 3 / 2 / 1 points to first / second / third. After 3 races, highest total wins.", "If time runs out, distance reached decides placement. Gold rings mark checkpoints."],
  controls: "A / D or arrows to run · Space / W to jump · touch movement and jump buttons", durationSeconds: 66, gameType: "main", supportsBots: true, snapshotIntervalMs: 100,
  create,
  parseInput(i: MinigameInput) { return i.type === "RUN_CONTROL" && typeof i.forward === "number" && Number.isFinite(i.forward) && Math.abs(i.forward) <= 1 && typeof i.jump === "boolean" && Number.isInteger(i.round) && Number(i.round) > 0
    ? { type: "RUN_CONTROL", forward: i.forward, jump: i.jump, round: Number(i.round) } : null; },
  applyInput(s, id, input, at) {
    if (!s.players[id] || s.phase !== "race" || input.round !== s.round || at < s.startedAt || at >= s.phaseEndsAt || s.players[id].finishAt !== null) throw new Error("Wait for the next race.");
    const previous = s.controls[id]; s.controls[id] = { input: { ...input }, at, jumping: previous?.jumping ?? false };
  },
  tick(s, now) {
    const end = Math.min(now, s.endsAt); if (end <= s.simTime || s.phase === "finished") return false;
    while (s.simTime < end && !(s.phase as string === "finished")) {
      const next = Math.min(s.simTime + 20, end, s.phaseEndsAt), dt = (next - s.simTime) / 1000;
      if (s.phase === "race") for (const [id, p] of Object.entries(s.players)) {
        if (p.finishAt !== null || next < p.respawnUntil) continue;
        const c = s.controls[id], input = c && next - c.at <= 350 ? c.input : null;
        stepRunner(p, s.theme, input, c?.jumping ?? false, next, dt);
        if (c) c.jumping = !!input?.jump;
      }
      s.simTime = next;
      if (s.phase === "race" && (next >= s.phaseEndsAt || Object.values(s.players).every((p) => p.finishAt !== null))) finishRace(s, next);
      else if (s.phase === "break" && next >= s.phaseEndsAt) {
        s.round++; s.theme = THEMES[s.round - 1]; s.phase = "race"; s.phaseEndsAt = next + 20_000; s.controls = {}; s.bots = {};
        for (const [id, p] of Object.entries(s.players)) s.players[id] = runner(p.lane, p.score);
      }
    }
    if (end >= s.endsAt && !(s.phase as string === "finished")) { if (s.phase === "race") finishRace(s, end); s.phase = "finished"; }
    return true;
  },
  botInputs(s, bot, now, rng) {
    const p = s.players[bot.id]; if (!p || s.phase !== "race" || p.finishAt !== null || now < s.startedAt) return [];
    const plan = (s.bots[bot.id] ??= { nextAt: 0, jump: false }); if (now < plan.nextAt) return [];
    plan.nextAt = now + 100;
    const platform = TRAIL_MAPS[s.theme].map((f, i) => ({ ...f, y: trailPlatformY(s.theme, i, now) })).find((f) => Math.abs(p.x - f.x) <= f.w / 2 + .2 && Math.abs(p.y - f.y) < .3);
    const edge = !!platform && platform.x + platform.w / 2 - p.x < 1.2;
    const jump = p.grounded && edge && !plan.jump && rng() < { beginner: .55, easy: .78, medium: .855, hard: .93, extreme: .9998 }[bot.difficulty]; plan.jump = jump;
    return [{ at: now, input: { type: "RUN_CONTROL", forward: { beginner: .65, easy: .85, medium: .9, hard: .95, extreme: 1 }[bot.difficulty], jump, round: s.round } }];
  },
  isFinished: (s) => s.phase === "finished",
  scores: (s) => Object.fromEntries(Object.entries(s.players).map(([id, p]) => [id, p.score])),
  rank(s, ids, rng) { const ties = Object.fromEntries(ids.map((id) => [id, rng()])); return [...ids].sort((a, b) => s.players[b].score - s.players[a].score ||
    s.results.reduce((n, r) => n + r.ranking.indexOf(a) - r.ranking.indexOf(b), 0) || ties[b] - ties[a]); },
  publicView(s): TrailView { return { startedAt: s.startedAt, endsAt: s.endsAt, simTime: s.simTime, round: s.round, theme: s.theme, phase: s.phase, phaseEndsAt: s.phaseEndsAt, players: structuredClone(s.players), results: structuredClone(s.results) }; },
};
