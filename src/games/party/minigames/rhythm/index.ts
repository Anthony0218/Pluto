import type { MinigameDefinition, MinigameCreateContext } from "../types.ts";
import type { MinigameInput } from "../../types.ts";
import { TIMING_INPUT_GRACE_MS, timingInputAt, validTimingElapsed } from "../timing.ts";

export const RHYTHM_KEYS = ["J", "K", "L"] as const;
export const RHYTHM_WINDOW = 220;
export const RHYTHM_NOTE_HEIGHT = 64;
export const rhythmNoteTop = (noteAt: number, displayedAt: number, hitLineY: number) =>
  hitLineY - RHYTHM_NOTE_HEIGHT / 2 + (displayedAt - noteAt) / RHYTHM_WINDOW * RHYTHM_NOTE_HEIGHT;
export interface RhythmNote { id: number; lane: number; at: number; value: number; }
interface RhythmPlayer { score: number; hits: number; misses: number; combo: number; bestCombo: number; judged: number[]; lastTapAt: number; last: { at: number; overlap: number; value: number; points: number; lane: number } | null; }
export interface RhythmState { startedAt: number; endsAt: number; simTime: number; notes: RhythmNote[]; players: Record<string, RhythmPlayer>; bots: Record<string, { note: number; at: number; skip: boolean }>; }
export interface RhythmView { startedAt: number; endsAt: number; notes: RhythmNote[]; judged: number[]; players: Record<string, Omit<RhythmPlayer, "judged" | "lastTapAt">>; }
interface RhythmInput { type: "RHYTHM_TAP"; lane: number; elapsedMs?: number; }
export function nextRhythmNote(s: Pick<RhythmView, "notes" | "judged">, at: number) {
  return s.notes.find((note) => !s.judged.includes(note.id) && note.at + RHYTHM_WINDOW > at) ?? null;
}
// Area of intersection of two equal circles / area of one circle. Zero at one diameter apart.
export function circleOverlap(timeError: number) {
  const d = Math.min(2, Math.max(0, Math.abs(timeError) / RHYTHM_WINDOW * 2));
  return Math.max(0, (2 * Math.acos(d / 2) - .5 * d * Math.sqrt(4 - d * d)) / Math.PI);
}
function create(c: MinigameCreateContext): RhythmState {
  const notes: RhythmNote[] = []; let at = c.startedAt + 3000;
  while (at < c.endsAt - 1500) {
    const rarity = c.random();
    notes.push({ id: notes.length, lane: Math.min(RHYTHM_KEYS.length - 1, Math.floor(c.random() * RHYTHM_KEYS.length)), at, value: rarity < .01 ? 5 : rarity < .13 ? 3 : 1 });
    at += 600; // 100 BPM · one note on each beat
  }
  return { startedAt: c.startedAt, endsAt: c.endsAt, simTime: c.startedAt, notes, bots: {},
    players: Object.fromEntries(c.participants.map((p) => [p.id, { score: 0, hits: 0, misses: 0, combo: 0, bestCombo: 0, judged: [], lastTapAt: -Infinity, last: null }])) };
}
export const rhythmRush: MinigameDefinition<RhythmState, RhythmInput> = {
  id: "rhythm-rush", name: "Pluto Pulse", description: "Follow one lane of falling letters. Press the shown key at the hit line.",
  instructions: ["Letters fall down one lane. Press J, K or L when the centre of that letter reaches the glowing line.",
    "Your points equal timing accuracy × note value. An 80% hit on a 3-point note earns 2.4 points.",
    "Most notes are worth 1, occasional gold notes 3, and rare violet notes 5. Each note scores once.",
    "Everyone sees the same letters and timing. On mobile, tap the matching J / K / L button at the line. Highest total wins."],
  controls: "J · K · L as shown / tap the matching J / K / L button", durationSeconds: 60, gameType: "main", supportsBots: true, personalizedView: true, snapshotIntervalMs: 100,
  create,
  parseInput(i: MinigameInput) { return i.type === "RHYTHM_TAP" && Number.isInteger(i.lane) && Number(i.lane) >= 0 && Number(i.lane) < RHYTHM_KEYS.length && validTimingElapsed(i.elapsedMs)
    ? { type: "RHYTHM_TAP", lane: Number(i.lane), ...(i.elapsedMs !== undefined && { elapsedMs: i.elapsedMs }) } : null; },
  applyInput(s, id, i, at) {
    const p = s.players[id];
    const displayedAt = timingInputAt(s.startedAt, at, i.elapsedMs);
    if (!p || at < s.startedAt || at >= s.endsAt || at - p.lastTapAt < 65) throw new Error("Wait for the next beat.");
    p.lastTapAt = at;
    const note = s.notes.filter((n) => n.lane === i.lane && !p.judged.includes(n.id) && Math.abs(displayedAt - n.at) < RHYTHM_WINDOW)
      .sort((a, b) => Math.abs(displayedAt - a.at) - Math.abs(displayedAt - b.at))[0];
    const overlap = note ? circleOverlap(displayedAt - note.at) : 0, points = note ? overlap * note.value : 0;
    if (note) { p.judged.push(note.id); p.hits++; p.combo = overlap >= .45 ? p.combo + 1 : 0; p.bestCombo = Math.max(p.bestCombo, p.combo); p.score = Math.round((p.score + points) * 10000) / 10000; } else p.combo = 0;
    p.last = { at, lane: i.lane, overlap, value: note?.value ?? 0, points };
  },
  tick(s, now) {
    const until = Math.min(now, s.endsAt); if (until <= s.simTime) return false;
    for (const p of Object.values(s.players)) for (const note of s.notes) {
      if (note.at + RHYTHM_WINDOW + TIMING_INPUT_GRACE_MS <= until && !p.judged.includes(note.id)) { p.judged.push(note.id); p.misses++; p.combo = 0; }
    }
    s.simTime = until; return true;
  },
  botInputs(s, bot, now, rng) {
    const p = s.players[bot.id]; if (!p || now < s.startedAt) return [];
    const inputs: { at: number; input: RhythmInput }[] = [];
    for (const note of s.notes) {
      if (p.judged.includes(note.id) || note.at - now > 500 || now - note.at > RHYTHM_WINDOW) continue;
      const key = `${bot.id}:${note.id}`;
      const plan = (s.bots[key] ??= { note: note.id, at: note.at + (rng() - .5) * { beginner: 500, easy: 310, medium: 245, hard: 180, extreme: 18 }[bot.difficulty], skip: rng() < { beginner: .3, easy: .17, medium: .125, hard: .08, extreme: .001 }[bot.difficulty] });
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
      judged: [...(s.players[viewer ?? ""]?.judged ?? [])], players: Object.fromEntries(Object.entries(s.players).map(([id, p]) => [id, { score: p.score, hits: p.hits, misses: p.misses, combo: p.combo, bestCombo: p.bestCombo, last: p.last ? { ...p.last } : null }])) };
  },
};
