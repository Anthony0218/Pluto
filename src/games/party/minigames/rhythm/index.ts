import type { MinigameDefinition, MinigameCreateContext } from "../types.ts";
import type { MinigameInput } from "../../types.ts";

export const RHYTHM_KEYS = ["W", "A", "S", "D", "SPACE", "SHIFT"] as const;
export const RHYTHM_WINDOW = 220;
export interface RhythmNote { id: number; lane: number; at: number; value: number; }
interface RhythmPlayer { score: number; hits: number; misses: number; judged: number[]; lastTapAt: number; last: { at: number; overlap: number; value: number; points: number; lane: number } | null; }
export interface RhythmState { startedAt: number; endsAt: number; simTime: number; notes: RhythmNote[]; players: Record<string, RhythmPlayer>; bots: Record<string, { note: number; at: number; skip: boolean }>; }
export interface RhythmView { startedAt: number; endsAt: number; notes: RhythmNote[]; judged: number[]; players: Record<string, Omit<RhythmPlayer, "judged" | "lastTapAt">>; }
interface RhythmInput { type: "RHYTHM_TAP"; lane: number; }
// Area of intersection of two equal circles / area of one circle. Zero at one diameter apart.
export function circleOverlap(timeError: number) {
  const d = Math.min(2, Math.max(0, Math.abs(timeError) / RHYTHM_WINDOW * 2));
  return Math.max(0, (2 * Math.acos(d / 2) - .5 * d * Math.sqrt(4 - d * d)) / Math.PI);
}
function create(c: MinigameCreateContext): RhythmState {
  const notes: RhythmNote[] = []; let at = c.startedAt + 3000;
  while (at < c.endsAt - 1500) {
    const rarity = c.random();
    notes.push({ id: notes.length, lane: Math.min(5, Math.floor(c.random() * 6)), at, value: rarity < .01 ? 5 : rarity < .13 ? 3 : 1 });
    at += Math.round(650 - Math.min(200, notes.length * 2) + c.random() * 100);
  }
  return { startedAt: c.startedAt, endsAt: c.endsAt, simTime: c.startedAt, notes, bots: {},
    players: Object.fromEntries(c.participants.map((p) => [p.id, { score: 0, hits: 0, misses: 0, judged: [], lastTapAt: -Infinity, last: null }])) };
}
export const rhythmRush: MinigameDefinition<RhythmState, RhythmInput> = {
  id: "rhythm-rush", name: "Pluto Pulse", description: "Hit six keys as falling circles meet their targets. Precision earns points.",
  instructions: ["Everyone receives exactly the same notes and timing. Hit W, A, S, D, Space or Shift as its circle overlaps the target.",
    "Your points equal circle overlap × note value. An 80% overlap on a 3-point note earns 2.4 points.",
    "Most notes are worth 1, occasional gold notes 3, and rare violet notes 5. Each note scores once.",
    "On mobile, tap the six matching targets. Highest total wins."],
  controls: "W · A · S · D · Space · Shift / six touch targets", durationSeconds: 65, gameType: "main", supportsBots: true, personalizedView: true, snapshotIntervalMs: 100,
  create,
  parseInput(i: MinigameInput) { return i.type === "RHYTHM_TAP" && Number.isInteger(i.lane) && Number(i.lane) >= 0 && Number(i.lane) < 6 ? { type: "RHYTHM_TAP", lane: Number(i.lane) } : null; },
  applyInput(s, id, i, at) {
    const p = s.players[id];
    if (!p || at < s.startedAt || at >= s.endsAt || at - p.lastTapAt < 65) throw new Error("Wait for the next beat.");
    p.lastTapAt = at;
    const note = s.notes.filter((n) => n.lane === i.lane && !p.judged.includes(n.id) && Math.abs(at - n.at) < RHYTHM_WINDOW)
      .sort((a, b) => Math.abs(at - a.at) - Math.abs(at - b.at))[0];
    const overlap = note ? circleOverlap(at - note.at) : 0, points = note ? overlap * note.value : 0;
    if (note) { p.judged.push(note.id); p.hits++; p.score = Math.round((p.score + points) * 10000) / 10000; }
    p.last = { at, lane: i.lane, overlap, value: note?.value ?? 0, points };
  },
  tick(s, now) {
    const until = Math.min(now, s.endsAt); if (until <= s.simTime) return false;
    for (const p of Object.values(s.players)) for (const note of s.notes) {
      if (note.at + RHYTHM_WINDOW <= until && !p.judged.includes(note.id)) { p.judged.push(note.id); p.misses++; }
    }
    s.simTime = until; return true;
  },
  botInputs(s, bot, now, rng) {
    const p = s.players[bot.id]; if (!p || now < s.startedAt) return [];
    const inputs: { at: number; input: RhythmInput }[] = [];
    for (const note of s.notes) {
      if (p.judged.includes(note.id) || note.at - now > 500 || now - note.at > RHYTHM_WINDOW) continue;
      const key = `${bot.id}:${note.id}`;
      const plan = (s.bots[key] ??= { note: note.id, at: note.at + (rng() - .5) * { easy: 310, medium: 180, hard: 80 }[bot.difficulty], skip: rng() < { easy: .17, medium: .08, hard: .025 }[bot.difficulty] });
      if (!plan.skip && plan.at <= now && plan.at > s.simTime - 150) {
        inputs.push({ at: Math.max(plan.at, s.simTime), input: { type: "RHYTHM_TAP", lane: note.lane } }); plan.skip = true;
      }
    }
    return inputs;
  },
  scores: (s) => Object.fromEntries(Object.entries(s.players).map(([id, p]) => [id, p.score])),
  rank(s, ids, rng) { const ties = Object.fromEntries(ids.map((id) => [id, rng()])); return [...ids].sort((a, b) => s.players[b].score - s.players[a].score || s.players[b].hits - s.players[a].hits || ties[b] - ties[a]); },
  publicView(s, now, viewer): RhythmView {
    return { startedAt: s.startedAt, endsAt: s.endsAt, notes: s.notes.filter((n) => n.at >= now - RHYTHM_WINDOW && n.at <= now + 2800).map((n) => ({ ...n })),
      judged: [...(s.players[viewer ?? ""]?.judged ?? [])], players: Object.fromEntries(Object.entries(s.players).map(([id, p]) => [id, { score: p.score, hits: p.hits, misses: p.misses, last: p.last ? { ...p.last } : null }])) };
  },
};
