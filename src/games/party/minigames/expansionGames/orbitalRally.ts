import type { MinigameCreateContext, MinigameDefinition } from "../types.ts";
import { applyMove, base, BOT_REACTION, clamp, control, parseMove, rankScores, type Mover, type MovingState, type MoveInput } from "../festivalGames/common.ts";

export const RALLY_LAPS = 3;
export const RALLY_HAZARDS = [{ t: .12, lane: -1 }, { t: .29, lane: 1 }, { t: .46, lane: -1 }, { t: .64, lane: -1 }, { t: .79, lane: 1 }, { t: .94, lane: -1 }];
export const RALLY_CELLS = [{ t: .06, lane: 1 }, { t: .23, lane: -1 }, { t: .42, lane: 1 }, { t: .60, lane: 1 }, { t: .83, lane: -1 }];
export function rallyPoint(progress: number, lane: number) { const a = progress * Math.PI * 2 - Math.PI / 2; return { x: 50 + Math.cos(a) * (35 + lane * 5), y: 50 + Math.sin(a) * (25 + lane * 5), heading: Math.atan2(Math.cos(a) * (25 + lane * 5), -Math.sin(a) * (35 + lane * 5)) }; }
interface Kart extends Mover { progress: number; lane: number; speed: number; charges: number; boostUntil: number; actionHeld: boolean; finishedAt: number | null; visited: Record<string, boolean>; hits: number; }
export interface RallyState extends MovingState { players: Record<string, Kart>; bots: Record<string, number>; }
function create(c: MinigameCreateContext): RallyState {
  return { ...base(c), players: Object.fromEntries(c.participants.map((p, i) => [p.id, { ...rallyPoint(0, -.9 + i * .6), score: 0, stunnedUntil: 0, progress: 0, lane: -.9 + i * .6, speed: 0, charges: 1, boostUntil: 0, actionHeld: false, finishedAt: null, visited: {}, hits: 0 }])), bots: {} };
}
export const orbitalRally: MinigameDefinition<RallyState, MoveInput> = {
  id: "orbital-rally", name: "Orbital Rally", description: "Race magnetic hover-karts around a moon circuit. Trade a fast inside lane for safer routes and harvest charge-cell boosts!",
  instructions: ["Complete 3 laps. Karts accelerate automatically; W/up adds throttle, S/down brakes. A/D or left/right move between magnetic lanes.", "The inside lane is shorter but has more cracked tiles. Hitting one slows your kart; change lanes before the warning chevrons.", "Collect cyan charge cells. Space spends one cell on a 1-second boost. Each cell can be collected once per lap; hold at most 3.", "Fastest finish wins. Unfinished racers rank by progress when time runs out. Nobody can cut the track or skip laps."],
  controls: "A/D change lane · W throttle · S brake · Space boost · touch lane buttons and Boost", durationSeconds: 75, gameType: "main", supportsBots: true, snapshotIntervalMs: 60, create, parseInput: parseMove, applyInput: applyMove,
  tick(s, now) {
    const end = Math.min(now, s.endsAt); if (end <= s.simTime || Object.values(s.players).every((p) => p.finishedAt !== null)) return false;
    while (s.simTime < end) { const at = Math.min(s.simTime + 20, end), dt = (at - s.simTime) / 1000;
      for (const [id, p] of Object.entries(s.players)) {
        if (p.finishedAt !== null) continue;
        const input = control(s, id, at);
        p.lane = clamp(p.lane + (input?.x ?? 0) * 2.2 * dt, -1, 1);
        if (input?.action && !p.actionHeld && p.charges > 0 && at >= p.stunnedUntil) { p.charges--; p.boostUntil = at + 1000; }
        p.actionHeld = input?.action ?? false;
        const targetSpeed = at < p.stunnedUntil ? 9 : at < p.boostUntil ? 36 : (input?.y ?? 0) > .1 ? 10 : (input?.y ?? 0) < -.1 ? 24 : 20;
        p.speed += (targetSpeed - p.speed) * Math.min(1, dt * 2.5);
        p.progress += p.speed * dt / (240 * (1 + p.lane * .14));
        const lap = Math.floor(p.progress), t = p.progress % 1;
        RALLY_HAZARDS.forEach((h, i) => { const key = `h${lap}:${i}`; if (Math.abs(t - h.t) < .012 && Math.abs(p.lane - h.lane) < .38 && !p.visited[key]) { p.visited[key] = true; p.speed *= .35; p.stunnedUntil = at + 650; p.hits++; } });
        RALLY_CELLS.forEach((cell, i) => { const key = `c${lap}:${i}`; if (Math.abs(t - cell.t) < .014 && Math.abs(p.lane - cell.lane) < .42 && !p.visited[key]) { p.visited[key] = true; p.charges = Math.min(3, p.charges + 1); } });
        Object.assign(p, rallyPoint(p.progress, p.lane));
        if (p.progress >= RALLY_LAPS) { p.progress = RALLY_LAPS; p.finishedAt = at; p.score = 300 + (s.endsAt - at) / 1000; }
        else p.score = p.progress * 100;
      }
      s.simTime = at;
      if (Object.values(s.players).every((p) => p.finishedAt !== null)) break;
    } return true;
  },
  botInputs(s, bot, now) {
    const p = s.players[bot.id]; if (!p || p.finishedAt !== null || now < s.startedAt || now >= s.endsAt || now < (s.bots[bot.id] ?? 0)) return [];
    s.bots[bot.id] = now + Math.min(300, BOT_REACTION[bot.difficulty]);
    const t = p.progress % 1;
    const nextCell = RALLY_CELLS.find((c) => c.t > t + .018 && c.t < t + .09);
    const hazard = RALLY_HAZARDS.find((h) => h.t > t && h.t < t + .10);
    let lane = nextCell && p.charges < 3 ? nextCell.lane : bot.difficulty === "beginner" ? 0 : -.8;
    if (hazard && Math.abs(lane - hazard.lane) < .5) lane = hazard.lane === -1 ? .1 : -.3;
    return [{ at: now, input: { type: "FESTIVAL_MOVE", x: clamp((lane - p.lane) * 3, -1, 1), y: bot.difficulty === "beginner" ? 0 : -1, action: !p.actionHeld && p.charges > 0 && p.boostUntil <= now && !hazard } }];
  },
  isFinished: (s) => Object.values(s.players).every((p) => p.finishedAt !== null),
  scores: (s) => Object.fromEntries(Object.entries(s.players).map(([id, p]) => [id, p.score])), rank: rankScores,
  publicView: (s) => ({ startedAt: s.startedAt, endsAt: s.endsAt, simTime: s.simTime, players: Object.fromEntries(Object.entries(s.players).map(([id, p]) => [id, { x: p.x, y: p.y, score: p.score, stunnedUntil: p.stunnedUntil, progress: p.progress, lane: p.lane, speed: p.speed, charges: p.charges, boostUntil: p.boostUntil, finishedAt: p.finishedAt, hits: p.hits }])) }),
};
