import type { MinigameCreateContext, MinigameDefinition } from "../types.ts";
import { rankScores } from "../festivalGames/common.ts";

interface Footballer { score: number; goals: number; saves: number; shots: number; keeperTurns: number; }
interface Shot { lane: number; at: number; power: number; onTarget: boolean; }
export interface PenaltyState {
  startedAt: number; endsAt: number; simTime: number;
  attempt: number; schedule: { shooter: string; keeper: string }[];
  phase: "aim" | "flight" | "result" | "finished";
  phaseStartedAt: number; phaseEndsAt: number;
  shot: Shot | null; keeper: { lane: number; at: number } | null;
  choices: Record<string, number>;
  outcome: "goal" | "save" | "miss" | null;
  players: Record<string, Footballer>;
  bots: Record<string, { attempt: number; lane: number; at: number }>;
}
export interface PenaltyView extends Omit<PenaltyState, "schedule" | "choices" | "bots"> {
  shooterId: string; keeperId: string; yourLane: number | null; shotLocked: boolean; keeperLocked: boolean;
}
interface PenaltyInput { type: "PENALTY_CHOICE"; attempt: number; lane: number; action: "aim" | "kick" | "dive"; }
export function penaltyPower(at: number, startedAt: number) { return .5 + .5 * Math.sin((at - startedAt) / 1000 * Math.PI * 1.3); }
function create(c: MinigameCreateContext): PenaltyState {
  const ids = c.participants.map((p) => p.id);
  for (let i = ids.length - 1; i > 0; i--) { const j = Math.floor(c.random() * (i + 1)); [ids[i], ids[j]] = [ids[j], ids[i]]; }
  const schedule = [1, 2, 3].flatMap((offset) => ids.map((shooter, i) => ({ shooter, keeper: ids[(i + offset) % ids.length] })));
  return { startedAt: c.startedAt, endsAt: c.endsAt, simTime: c.startedAt, attempt: 1, schedule, phase: "aim", phaseStartedAt: c.startedAt, phaseEndsAt: c.startedAt + 4000, shot: null, keeper: null, choices: {}, outcome: null, players: Object.fromEntries(ids.map((id) => [id, { score: 0, goals: 0, saves: 0, shots: 0, keeperTurns: 0 }])), bots: {} };
}
export const penaltyShootout: MinigameDefinition<PenaltyState, PenaltyInput> = {
  id: "penalty-shootout", name: "Pluto Penalties", description: "A fair four-player shootout: everyone takes three penalties and keeps goal three times. Read your rival's dive!",
  instructions: ["Everyone shoots once against every other player, and keeps goal once against each of them: 3 shots and 3 keeper turns each.", "Shooters choose left, middle or right, then press Space/Kick while the power marker is in the green zone. Outside it, the shot misses.", "Keepers lock a left, middle or right dive. Both choices stay secret until the ball flies. Matching an on-target shot earns a save.", "Goals earn the shooter 1 point; saved on-target penalties earn the keeper 1 point. Misses and unanswered kicks give neither player a point. Highest goals + saves wins."],
  controls: "1 / 2 / 3 or tap to choose a lane · Space to kick · keeper lane selection locks the dive", durationSeconds: 75, gameType: "main", supportsBots: true, personalizedView: true, snapshotIntervalMs: 80, create,
  parseInput(i) {
    return i.type === "PENALTY_CHOICE" && Number.isInteger(i.attempt) && Number(i.attempt) >= 1 && Number(i.attempt) <= 12 && Number.isInteger(i.lane) && Number(i.lane) >= 0 && Number(i.lane) <= 2 && (i.action === "aim" || i.action === "kick" || i.action === "dive") ? { type: "PENALTY_CHOICE", attempt: Number(i.attempt), lane: Number(i.lane), action: i.action } : null;
  },
  applyInput(s, id, input, at) {
    if (!s.players[id] || s.phase !== "aim" || input.attempt !== s.attempt || at < s.phaseStartedAt || at >= s.phaseEndsAt) throw new Error("Wait for your next penalty.");
    const pair = s.schedule[s.attempt - 1];
    if (pair.shooter === id && input.action !== "dive" && !s.shot) {
      s.choices[id] = input.lane;
      if (input.action === "kick") { const power = penaltyPower(at, s.phaseStartedAt); s.shot = { lane: input.lane, at, power, onTarget: power >= .22 && power <= .9 }; }
    } else if (pair.keeper === id && input.action === "dive" && !s.keeper) { s.choices[id] = input.lane; s.keeper = { lane: input.lane, at }; }
    else throw new Error("Only the current shooter and keeper may lock their choices.");
  },
  tick(s, now) {
    const end = Math.min(now, s.endsAt); if (end <= s.simTime || s.phase === "finished") return false;
    while (s.phase !== "finished") {
      const boundary = s.phase === "aim" && s.shot && s.keeper ? Math.max(s.shot.at, s.keeper.at) : s.phaseEndsAt;
      if (end < boundary) break;
      if (s.phase === "aim") { s.phase = "flight"; s.phaseEndsAt = boundary + 800; }
      else if (s.phase === "flight") {
        const pair = s.schedule[s.attempt - 1], shooter = s.players[pair.shooter], keeper = s.players[pair.keeper];
        shooter.shots++; keeper.keeperTurns++;
        s.outcome = !s.shot?.onTarget ? "miss" : s.keeper?.lane === s.shot.lane ? "save" : "goal";
        if (s.outcome === "goal") { shooter.score++; shooter.goals++; }
        if (s.outcome === "save") { keeper.score++; keeper.saves++; }
        s.phase = "result"; s.phaseEndsAt = boundary + 1200;
      } else if (s.attempt === s.schedule.length) s.phase = "finished";
      else { s.attempt++; s.phase = "aim"; s.phaseEndsAt = boundary + 4000; s.shot = null; s.keeper = null; s.choices = {}; s.outcome = null; }
      s.phaseStartedAt = boundary;
    }
    s.simTime = end; if (end >= s.endsAt) s.phase = "finished"; return true;
  },
  botInputs(s, bot, now, rng) {
    if (s.phase !== "aim" || now < s.phaseStartedAt || now >= s.phaseEndsAt) return [];
    const pair = s.schedule[s.attempt - 1]; if (bot.id !== pair.shooter && bot.id !== pair.keeper) return [];
    const plan = s.bots[bot.id];
    if (!plan || plan.attempt !== s.attempt) {
      s.bots[bot.id] = { attempt: s.attempt, lane: Math.floor(rng() * 3), at: s.phaseStartedAt + 350 + rng() * 900 }; return [];
    }
    if (now < plan.at) return [];
    if (bot.id === pair.keeper) return !s.keeper ? [{ at: now, input: { type: "PENALTY_CHOICE", attempt: s.attempt, lane: plan.lane, action: "dive" } }] : [];
    // Keeper's private choice is never consulted by a shooter bot.
    const accuracy = { beginner: .55, easy: .7, medium: .82, hard: .92, extreme: .995 }[bot.difficulty];
    const power = penaltyPower(now, s.phaseStartedAt);
    return !s.shot && (power >= .30 && power <= .8 || rng() > accuracy) ? [{ at: now, input: { type: "PENALTY_CHOICE", attempt: s.attempt, lane: plan.lane, action: "kick" } }] : [];
  },
  isFinished: (s) => s.phase === "finished",
  scores: (s) => Object.fromEntries(Object.entries(s.players).map(([id, p]) => [id, p.score])), rank: rankScores,
  publicView(s, _now, viewerId): PenaltyView {
    const pair = s.schedule[s.attempt - 1];
    return { startedAt: s.startedAt, endsAt: s.endsAt, simTime: s.simTime, attempt: s.attempt, phase: s.phase, phaseStartedAt: s.phaseStartedAt, phaseEndsAt: s.phaseEndsAt, players: structuredClone(s.players), shooterId: pair.shooter, keeperId: pair.keeper, yourLane: viewerId ? s.choices[viewerId] ?? null : null, shotLocked: s.shot !== null, keeperLocked: s.keeper !== null, shot: s.phase === "aim" ? null : structuredClone(s.shot), keeper: s.phase === "aim" ? null : structuredClone(s.keeper), outcome: s.outcome };
  },
};
