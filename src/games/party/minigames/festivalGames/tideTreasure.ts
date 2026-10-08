import type { MinigameDefinition, MinigameCreateContext } from "../types.ts";
import { applyMove, base, BOT_REACTION, clamp, control, distance, move, parseMove, random, rankScores, toward, type Mover, type MoveInput, type MovingState } from "./common.ts";
export interface Treasure { id: number; x: number; y: number; value: number; respawnAt: number; }
export interface TideState extends MovingState { players: Record<string, Mover & { carried: number; losses: number }>; treasures: Treasure[]; bots: Record<string, number>; }
export const tideRadius = (s: Pick<TideState, "startedAt">, at: number) => 43 - Math.max(0, ((at - s.startedAt) % 15000) / 15000 - .4) / .6 * 28;
export const tideSafe = (s: TideState, p: Mover, at: number) => p.x <= 15 || Math.abs(p.y - 50) < 5 && p.x < 60 || distance(p, { x: 59, y: 50 }) <= tideRadius(s, at);
function create(c: MinigameCreateContext): TideState {
  const s: TideState = { ...base(c), players: Object.fromEntries(c.participants.map((p, i) => [p.id, { x: 10, y: 42 + i * 5, score: 0, stunnedUntil: 0, carried: 0, losses: 0 }])), treasures: [], bots: {} };
  for (let i = 0; i < 14; i++) { const a = random(s) * Math.PI * 2, r = 10 + random(s) * 30; s.treasures.push({ id: i, x: 59 + Math.cos(a) * r, y: 50 + Math.sin(a) * r, value: r > 30 ? 5 : r > 20 ? 3 : 1, respawnAt: 0 }); }
  return s;
}
export const tideTreasure: MinigameDefinition<TideState, MoveInput> = {
  id: "tide-treasure", name: "Tide Treasure", description: "Grab treasure before the tide takes it. Bank your haul at the boat—or risk one more trip.",
  instructions: ["Walk over treasure to carry it. Rare outer-island gems are worth more.", "Return to the boat on the left to bank your haul. Only banked treasure scores.", "Every 15 seconds the tide rises. The striped pier and boat stay safe; water drops your carried treasure.", "Watch the tide warning and decide when to turn back. Highest banked total wins."],
  controls: "WASD / arrows · touch direction pad", durationSeconds: 60, gameType: "main", supportsBots: true, snapshotIntervalMs: 100, create, parseInput: parseMove, applyInput: applyMove,
  tick(s, now) {
    const end = Math.min(now, s.endsAt); if (end <= s.simTime) return false;
    while (s.simTime < end) { const at = Math.min(s.simTime + 20, end), dt = (at - s.simTime) / 1000;
      for (const [id, p] of Object.entries(s.players)) {
        move(p, control(s, id, at), 29, dt, at); if (at < p.stunnedUntil) continue;
        if (!tideSafe(s, p, at)) { p.carried = 0; p.losses++; p.x = 10; p.y = 50; p.stunnedUntil = at + 900; continue; }
        if (p.x < 15 && p.carried) { p.score += p.carried; p.carried = 0; }
        for (const gem of s.treasures) if (gem.respawnAt <= at && distance(p, gem) < 4) { p.carried += gem.value; gem.respawnAt = at + 7000; }
      } s.simTime = at;
    } return true;
  },
  botInputs(s, bot, now) {
    const p = s.players[bot.id]; if (!p || now < s.startedAt || now < (s.bots[bot.id] ?? 0)) return []; s.bots[bot.id] = now + BOT_REACTION[bot.difficulty];
    const phase = (now - s.startedAt) % 15000, threshold = { beginner: 15, easy: 12, medium: 9, hard: 7, extreme: 6 }[bot.difficulty];
    const returnTime = (p.x - 12) / (29 * { beginner: .5, easy: .65, medium: .8, hard: .9, extreme: 1 }[bot.difficulty]) * 1000;
    const returnHome = p.carried >= threshold || p.carried > 0 && (phase > 8500 - returnTime || s.endsAt - now < returnTime + 1000);
    const gem = s.treasures.filter((g) => g.respawnAt <= now && (bot.difficulty === "beginner" || tideSafe(s, { ...p, x: g.x, y: g.y }, now + 1000))).sort((a, b) => distance(p, a) / a.value - distance(p, b) / b.value)[0];
    const target = returnHome || !gem ? { x: 10, y: 50 } : p.x < 30 && Math.abs(p.y - 50) > 3 ? { x: clamp(p.x + 5), y: 50 } : gem;
    return [{ at: now, input: toward(p, target, bot.difficulty) }];
  }, scores: (s) => Object.fromEntries(Object.entries(s.players).map(([id, p]) => [id, p.score])), rank: rankScores,
  publicView: (s) => ({ startedAt: s.startedAt, endsAt: s.endsAt, simTime: s.simTime, players: structuredClone(s.players), treasures: structuredClone(s.treasures) }),
};
