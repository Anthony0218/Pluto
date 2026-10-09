import type { MinigameCreateContext, MinigameDefinition } from "../types.ts";
import { random, rankScores } from "../festivalGames/common.ts";

export interface IslandObject { symbol: number; color: number; }
interface Observer { score: number; answered: boolean; choice: number | null; correct: boolean; }
export interface ImpostorState {
  startedAt: number; endsAt: number; simTime: number; seed: number;
  round: number; phase: "watch" | "blackout" | "answer" | "reveal" | "finished";
  phaseStartedAt: number; phaseEndsAt: number;
  before: IslandObject[]; after: IslandObject[]; changed: number;
  players: Record<string, Observer>; bots: Record<string, { round: number; choice: number; at: number }>;
}
export interface ImpostorView extends Omit<ImpostorState, "seed" | "before" | "after" | "changed" | "bots" | "players"> {
  objects: IslandObject[]; changed: number | null;
  players: Record<string, { score: number; answered: boolean }>;
  yourChoice: number | null; yourCorrect: boolean | null;
}
interface Guess { type: "IMPOSTOR_GUESS"; round: number; tile: number; }
function prepare(s: ImpostorState, at: number) {
  s.before = Array.from({ length: 6 }, () => ({ symbol: Math.floor(random(s) * 8), color: Math.floor(random(s) * 4) }));
  s.after = structuredClone(s.before); s.changed = Math.floor(random(s) * 6);
  if (s.round % 2) s.after[s.changed].symbol = (s.before[s.changed].symbol + 1 + Math.floor(random(s) * 7)) % 8;
  else s.after[s.changed].color = (s.before[s.changed].color + 1 + Math.floor(random(s) * 3)) % 4;
  s.phase = "watch"; s.phaseStartedAt = at; s.phaseEndsAt = at + 2400;
  for (const p of Object.values(s.players)) { p.answered = false; p.choice = null; p.correct = false; }
}
function create(c: MinigameCreateContext): ImpostorState {
  const s: ImpostorState = { startedAt: c.startedAt, endsAt: c.endsAt, simTime: c.startedAt, seed: Math.floor(c.random() * 4294967296), round: 1, phase: "watch", phaseStartedAt: c.startedAt, phaseEndsAt: 0, before: [], after: [], changed: 0, players: Object.fromEntries(c.participants.map((p) => [p.id, { score: 0, answered: false, choice: null, correct: false }])), bots: {} };
  prepare(s, c.startedAt); return s;
}
export const islandImpostor: MinigameDefinition<ImpostorState, Guess> = {
  id: "island-impostor", name: "Island Impostor", description: "Memorize six island souvenirs. After a blackout, find the one that changed its shape or color!",
  instructions: ["Watch the six souvenirs for 2.4 seconds. Remember both the object and its color.", "After a short blackout, exactly one object changes. Tap it or press 1–6.", "You have one guess per round. Correct guesses earn 2 points; wrong or missed guesses earn 0. Speed does not affect points.", "Everyone returns for all 8 rounds. The changed object is revealed only after guesses close."],
  controls: "Click / tap a souvenir · keys 1–6 (left to right, top to bottom)", durationSeconds: 60, gameType: "main", supportsBots: true, snapshotIntervalMs: 80, personalizedView: true, create,
  parseInput(i) { return i.type === "IMPOSTOR_GUESS" && Number.isInteger(i.tile) && Number(i.tile) >= 0 && Number(i.tile) < 6 && Number.isInteger(i.round) && Number(i.round) >= 1 && Number(i.round) <= 8 ? { type: "IMPOSTOR_GUESS", round: Number(i.round), tile: Number(i.tile) } : null; },
  applyInput(s, id, i, at) {
    const p = s.players[id]; if (!p || p.answered || s.phase !== "answer" || at < s.phaseStartedAt || at >= s.phaseEndsAt || i.round !== s.round) throw new Error("Wait for the next observation round.");
    p.answered = true; p.choice = i.tile; p.correct = i.tile === s.changed;
  },
  tick(s, now) {
    const end = Math.min(now, s.endsAt); if (end <= s.simTime || s.phase === "finished") return false;
    while (s.phase !== "finished" && end >= s.phaseEndsAt) {
      const at = s.phaseEndsAt;
      if (s.phase === "watch") { s.phase = "blackout"; s.phaseEndsAt = at + 600; }
      else if (s.phase === "blackout") { s.phase = "answer"; s.phaseEndsAt = at + 3200; }
      else if (s.phase === "answer") { for (const p of Object.values(s.players)) if (p.correct) p.score += 2; s.phase = "reveal"; s.phaseEndsAt = at + 1000; }
      else if (s.round >= 8) s.phase = "finished";
      else { s.round++; prepare(s, at); }
      s.phaseStartedAt = at;
    }
    s.simTime = end; if (end >= s.endsAt) s.phase = "finished"; return true;
  },
  botInputs(s, bot, now, rng) {
    const p = s.players[bot.id]; if (!p || now < s.startedAt || now >= s.endsAt || p.answered) return [];
    if (s.phase === "watch" && s.bots[bot.id]?.round !== s.round) {
      const accuracy = { beginner: .38, easy: .56, medium: .73, hard: .88, extreme: .99 }[bot.difficulty];
      s.bots[bot.id] = { round: s.round, choice: rng() < accuracy ? s.changed : (s.changed + 1 + Math.floor(rng() * 5)) % 6, at: s.phaseStartedAt + 3000 + 500 + rng() * 1200 };
    }
    const plan = s.bots[bot.id];
    return s.phase === "answer" && plan?.round === s.round && now >= plan.at ? [{ at: now, input: { type: "IMPOSTOR_GUESS", tile: plan.choice, round: s.round } }] : [];
  },
  isFinished: (s) => s.phase === "finished",
  scores: (s) => Object.fromEntries(Object.entries(s.players).map(([id, p]) => [id, p.score])), rank: rankScores,
  publicView(s, _now, viewerId): ImpostorView {
    return { startedAt: s.startedAt, endsAt: s.endsAt, simTime: s.simTime, round: s.round, phase: s.phase, phaseStartedAt: s.phaseStartedAt, phaseEndsAt: s.phaseEndsAt,
      objects: structuredClone(s.phase === "watch" ? s.before : s.phase === "blackout" ? [] : s.after), changed: s.phase === "reveal" || s.phase === "finished" ? s.changed : null,
      players: Object.fromEntries(Object.entries(s.players).map(([id, p]) => [id, { score: p.score, answered: p.answered }])), yourChoice: viewerId ? s.players[viewerId]?.choice ?? null : null, yourCorrect: s.phase === "reveal" && viewerId ? s.players[viewerId]?.correct ?? null : null };
  },
};
