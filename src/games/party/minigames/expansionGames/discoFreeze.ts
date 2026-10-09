import type { MinigameCreateContext, MinigameDefinition } from "../types.ts";
import { applyMove, base, BOT_REACTION, control, move, parseMove, random, rankScores, type Mover, type MovingState, type MoveInput } from "../festivalGames/common.ts";

interface Dancer extends Mover { dance: number; failed: boolean; stops: number; }
export interface DiscoState extends MovingState {
  players: Record<string, Dancer>;
  phase: "dance" | "scratch" | "freeze";
  phaseStartedAt: number;
  phaseEndsAt: number;
  heat: number;
  bots: Record<string, number>;
}
function create(c: MinigameCreateContext): DiscoState {
  const s: DiscoState = { ...base(c), players: Object.fromEntries(c.participants.map((p, i) => [p.id, { x: 30 + i % 2 * 40, y: 35 + Math.floor(i / 2) * 35, score: 0, stunnedUntil: 0, dance: 0, failed: false, stops: 0 }])), phase: "dance", phaseStartedAt: c.startedAt, phaseEndsAt: 0, heat: 1, bots: {} };
  s.phaseEndsAt = c.startedAt + 4000 + random(s) * 2200;
  return s;
}
export const discoFreeze: MinigameDefinition<DiscoState, MoveInput> = {
  id: "disco-freeze", name: "Disco Freeze", description: "Dance across a cosmic disco floor, then freeze when the DJ stops. Ignore the fake record scratches!",
  instructions: ["Move while the floor says DANCE. Every second of dancing earns 1 point.", "A record scratch is a fake pause: keep dancing while the DJ says KEEP DANCING.", "When the red FREEZE cue appears, release your controls. You have 0.4 seconds to react.", "A clean freeze earns 3 bonus points. Moving after the grace period loses 2 points once per freeze; nobody is eliminated."],
  controls: "WASD / arrows to dance · release to freeze · touch direction pad", durationSeconds: 60, gameType: "main", supportsBots: true, snapshotIntervalMs: 80, create,
  parseInput: parseMove,
  applyInput: applyMove,
  tick(s, now) {
    const end = Math.min(now, s.endsAt); if (end <= s.simTime) return false;
    while (s.simTime < end) {
      const at = Math.min(s.simTime + 20, end, s.phaseEndsAt), dt = (at - s.simTime) / 1000;
      for (const [id, p] of Object.entries(s.players)) {
        const input = control(s, id, at), dancing = Math.hypot(input?.x ?? 0, input?.y ?? 0) > .1;
        move(p, input, 21, dt, at);
        if (s.phase !== "freeze" && dancing) { p.dance += dt; if (p.dance >= 1) { p.score++; p.dance -= 1; } }
        if (s.phase === "freeze" && at > s.phaseStartedAt + 400 && dancing && !p.failed) { p.failed = true; p.score = Math.max(0, p.score - 2); p.stunnedUntil = at + 500; }
      }
      s.simTime = at;
      if (at >= s.phaseEndsAt && at < s.endsAt) {
        if (s.phase === "freeze") {
          for (const p of Object.values(s.players)) { if (!p.failed) { p.score += 3; p.stops++; } p.failed = false; }
          s.heat++; s.phase = "dance"; s.phaseEndsAt = at + 4000 + random(s) * 2200;
        } else if (s.phase === "dance" && random(s) < .45) { s.phase = "scratch"; s.phaseEndsAt = at + 650; }
        else { s.phase = "freeze"; s.phaseEndsAt = at + 1800 + random(s) * 1000; }
        s.phaseStartedAt = at;
      }
    }
    return true;
  },
  botInputs(s, bot, now, rng) {
    const p = s.players[bot.id]; if (!p || now < s.startedAt || now >= s.endsAt || now < (s.bots[bot.id] ?? 0)) return [];
    s.bots[bot.id] = now + BOT_REACTION[bot.difficulty] * .55;
    const stop = s.phase === "freeze" && now >= s.phaseStartedAt + BOT_REACTION[bot.difficulty] * .75;
    return [{ at: now, input: { type: "FESTIVAL_MOVE", x: stop ? 0 : p.x > 80 ? -1 : p.x < 20 ? 1 : rng() > .5 ? 1 : -1, y: stop ? 0 : p.y > 80 ? -1 : p.y < 25 ? 1 : rng() > .5 ? 1 : -1, action: false } }];
  },
  scores: (s) => Object.fromEntries(Object.entries(s.players).map(([id, p]) => [id, p.score])), rank: rankScores,
  publicView: (s) => ({ startedAt: s.startedAt, endsAt: s.endsAt, simTime: s.simTime, phase: s.phase, phaseStartedAt: s.phaseStartedAt, heat: s.heat, players: structuredClone(s.players) }),
};
