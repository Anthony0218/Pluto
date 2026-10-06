import type { MinigameDefinition, MinigameCreateContext } from "../types.ts";
import type { MinigameInput } from "../../types.ts";

export const PATTERN_BEAT = 700;
export function patternLength(round: number) { return round === 1 ? 3 : round <= 3 ? 4 : round <= 7 ? 5 : round - 2; }
interface WallPlayer { alive: boolean; step: number; score: number; completed: number; lastTapAt: number; flashed: number | null; }
export interface PatternState {
  startedAt: number; endsAt: number; round: number; phase: "watch" | "repeat" | "break" | "finished";
  phaseStartedAt: number; phaseEndsAt: number; pattern: number[]; seed: number;
  players: Record<string, WallPlayer>; bots: Record<string, { round: number; recall: number[]; nextAt: number }>;
}
export interface PatternView extends Omit<PatternState, "pattern" | "seed" | "bots"> { length: number; lit: number | null; }
interface WallInput { type: "PATTERN_TAP"; tile: number; round: number; step: number; }
function random(s: PatternState) { s.seed = (Math.imul(s.seed, 1664525) + 1013904223) >>> 0; return s.seed / 4294967296; }
function prepare(s: PatternState, at: number) {
  s.pattern = Array.from({ length: patternLength(s.round) }, () => Math.floor(random(s) * 9));
  s.phase = "watch"; s.phaseStartedAt = at; s.phaseEndsAt = at + 1000 + s.pattern.length * PATTERN_BEAT;
  for (const p of Object.values(s.players)) { p.step = 0; p.flashed = null; }
}
function create(c: MinigameCreateContext): PatternState {
  const s: PatternState = { startedAt: c.startedAt, endsAt: c.endsAt, round: 1, phase: "watch", phaseStartedAt: c.startedAt, phaseEndsAt: 0,
    pattern: [], seed: Math.floor(c.random() * 4294967296), bots: {},
    players: Object.fromEntries(c.participants.map((p) => [p.id, { alive: true, step: 0, score: 0, completed: 0, lastTapAt: c.startedAt, flashed: null }])) };
  prepare(s, c.startedAt); return s;
}
export const patternWall: MinigameDefinition<PatternState, WallInput> = {
  id: "pattern-wall", name: "Echo Wall", description: "Watch a wall of nine lights, then tap the same sequence from memory.",
  instructions: ["Watch the 3×3 wall. Repeated squares count as separate beats.", "When the lights stop, tap the squares in exactly the same order. One wrong square eliminates you.",
    "Round 1: 3 lights. Rounds 2–3: 4. Rounds 4–7: 5. Each later round adds one light.", "Correct taps earn points. Completed rounds break ties; all players watch the same pattern."],
  controls: "Tap / click squares · keyboard 1–9 (left to right, top to bottom)", durationSeconds: 180, gameType: "main", supportsBots: true, personalizedView: true, snapshotIntervalMs: 100,
  create,
  parseInput(i: MinigameInput) {
    return i.type === "PATTERN_TAP" && Number.isInteger(i.tile) && Number(i.tile) >= 0 && Number(i.tile) < 9 && Number.isInteger(i.round) && Number(i.round) > 0 && Number.isInteger(i.step) && Number(i.step) >= 0
      ? { type: "PATTERN_TAP", tile: Number(i.tile), round: Number(i.round), step: Number(i.step) } : null;
  },
  applyInput(s, id, i, at) {
    const p = s.players[id];
    if (!p?.alive || s.phase !== "repeat" || at < s.phaseStartedAt || at >= s.phaseEndsAt || i.round !== s.round || i.step !== p.step || p.step >= s.pattern.length) throw new Error("Wait for your next square.");
    p.flashed = i.tile; p.lastTapAt = at;
    if (i.tile !== s.pattern[p.step]) p.alive = false;
    else { p.step++; p.score++; if (p.step === s.pattern.length) p.completed++; }
  },
  tick(s, now) {
    let changed = false;
    if (s.phase === "repeat" && Object.values(s.players).every((p) => !p.alive || p.step === s.pattern.length)) {
      s.phase = "break"; s.phaseStartedAt = now; s.phaseEndsAt = now + 1500; changed = true;
    }
    while (s.phase !== "finished" && now >= Math.min(s.phaseEndsAt, s.endsAt)) {
      changed = true; const at = Math.min(s.phaseEndsAt, s.endsAt);
      if (at >= s.endsAt) { s.phase = "finished"; break; }
      if (s.phase === "watch") { s.phase = "repeat"; s.phaseStartedAt = at; s.phaseEndsAt = at + Math.max(12_000, s.pattern.length * 1200); }
      else if (s.phase === "repeat") {
        for (const p of Object.values(s.players)) if (p.alive && p.step < s.pattern.length) p.alive = false;
        s.phase = "break"; s.phaseStartedAt = at; s.phaseEndsAt = at + 1500;
      } else {
        if (Object.values(s.players).filter((p) => p.alive).length <= 1) s.phase = "finished";
        else { s.round++; prepare(s, at); }
      }
    }
    return changed;
  },
  botInputs(s, bot, now, rng) {
    const p = s.players[bot.id]; if (!p?.alive || now < s.startedAt) return [];
    if (s.phase === "watch") {
      if (s.bots[bot.id]?.round !== s.round) {
        const accuracy = { easy: .82, medium: .93, hard: .985 }[bot.difficulty];
        s.bots[bot.id] = { round: s.round, recall: s.pattern.map((tile) => rng() < accuracy ? tile : Math.floor(rng() * 9)), nextAt: s.phaseEndsAt + 650 };
      }
      return [];
    }
    const plan = s.bots[bot.id];
    if (!plan || s.phase !== "repeat" || p.step >= s.pattern.length || now < plan.nextAt) return [];
    plan.nextAt = now + 500 + rng() * 350;
    return [{ at: now, input: { type: "PATTERN_TAP", tile: plan.recall[p.step], step: p.step, round: s.round } }];
  },
  isFinished: (s) => s.phase === "finished",
  scores: (s) => Object.fromEntries(Object.entries(s.players).map(([id, p]) => [id, p.score])),
  rank(s, ids, rng) { const ties = Object.fromEntries(ids.map((id) => [id, rng()])); return [...ids].sort((a, b) => s.players[b].score - s.players[a].score || s.players[b].completed - s.players[a].completed || ties[b] - ties[a]); },
  publicView(s, now, viewerId): PatternView {
    const index = Math.floor((now - s.phaseStartedAt - 700) / PATTERN_BEAT), beatAge = (now - s.phaseStartedAt - 700) % PATTERN_BEAT;
    const players = structuredClone(s.players);
    for (const [id, p] of Object.entries(players)) if (id !== viewerId) { p.flashed = null; p.lastTapAt = 0; }
    return { startedAt: s.startedAt, endsAt: s.endsAt, round: s.round, phase: s.phase, phaseStartedAt: s.phaseStartedAt, phaseEndsAt: s.phaseEndsAt, players, length: s.pattern.length,
      lit: s.phase === "watch" && index >= 0 && index < s.pattern.length && beatAge < 500 ? s.pattern[index] : null };
  },
};
