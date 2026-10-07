import { assertDatasetVersion, normalScore } from "./rules.ts";
import { distanceToTerritory, type CountryShapes } from "./territoryDistance.ts";
import { validateAnswer } from "./engine.ts";
import { scoreGuessTip, type GuessAward } from "./guessCountry.ts";
import type { AtlasQuestion, Coordinates } from "./types.ts";

/** Server-run rounds: every player answers the same question, and the server scores it. */
export type AtlasRoundMode = "map_battle" | "closest_wins" | "higher_lower" | "flag_battle" | "guess_country";
/** Races: everyone plays the same seeded run on their own device at once; the room collects live scores. */
export type AtlasRaceMode = "speed_run" | "map_fill" | "stat_ranking" | "region_builder" | "stat_detective" | "country_guesser" | "extreme_geography" | "language_guesser" | "history_battle";
export type AtlasMultiplayerMode = AtlasRoundMode | AtlasRaceMode | "stat_battle";
export const ATLAS_ROUND_MODES: AtlasRoundMode[] = ["map_battle", "closest_wins", "higher_lower", "flag_battle", "guess_country"];
export const ATLAS_RACE_MODES: AtlasRaceMode[] = ["speed_run", "map_fill", "stat_ranking", "region_builder", "stat_detective", "country_guesser", "extreme_geography", "language_guesser", "history_battle"];
export const ATLAS_MULTIPLAYER_MODES: AtlasMultiplayerMode[] = [...ATLAS_ROUND_MODES, ...ATLAS_RACE_MODES, "stat_battle"];
export const isRaceMode = (mode: string): mode is AtlasRaceMode => ATLAS_RACE_MODES.includes(mode as AtlasRaceMode);
export const isRoundMode = (mode: string): mode is AtlasRoundMode => ATLAS_ROUND_MODES.includes(mode as AtlasRoundMode);
/** Stat Battle is a duel; every other mode seats two to four players. */
export const maxPlayersFor = (mode: AtlasMultiplayerMode) => mode === "stat_battle" ? 2 : 4;
export const clampPlayers = (mode: AtlasMultiplayerMode, requested: unknown) => Math.min(maxPlayersFor(mode), Math.max(2, Math.trunc(Number(requested)) || 2));
export type AtlasMatchStatus = "waiting" | "draft" | "ready" | "intermission" | "countdown" | "round_active" | "round_resolving" | "next_round" | "finished" | "cancelled";
export type ServerSubmission = { userId: string; round: number; answer: string | Coordinates; submittedAt: number; correct: boolean; distanceKm?: number; nearest?: Coordinates; tip?: number; concept?:string; elapsedMs?:number };

export function parseClientAnswer(value: unknown, mode: AtlasMultiplayerMode): string | Coordinates {
  if (mode === "closest_wins") {
    if (!Array.isArray(value) || value.length !== 2 || !value.every((part) => typeof part === "number" && Number.isFinite(part))) throw new Error("A valid map coordinate is required.");
    const [longitude, latitude] = value;
    if (longitude < -180 || longitude > 180 || latitude < -90 || latitude > 90) throw new Error("Map coordinate is outside Earth.");
    return [longitude, latitude];
  }
  if (typeof value !== "string" || value.length > 100) throw new Error("A valid answer is required.");
  return value;
}

/** `shapes` lets Closest Wins measure to the target's borders (0 km inside); without them it measures to the reference point. */
export function createAuthoritativeSubmission(options: { userId: string; round: number; answer: unknown; mode: AtlasMultiplayerMode; question: AtlasQuestion; submittedAt: number; shapes?: CountryShapes }): ServerSubmission {
  const answer = parseClientAnswer(options.answer, options.mode);
  if (options.mode === "closest_wins") {
    const question = options.question;
    if ((question.interaction !== "closest_click" && question.interaction !== "map_click") || typeof answer === "string") throw new Error("This round has no point target.");
    const { distanceKm, nearest } = distanceToTerritory(answer, { geometryId: question.targetGeometryId, point: question.targetCoordinates, radiusKm: question.interaction === "closest_click" ? question.targetRadiusKm : undefined }, options.shapes);
    return { userId: options.userId, round: options.round, answer, submittedAt: options.submittedAt, correct: true, distanceKm, nearest };
  }
  if (Array.isArray(answer)) throw new Error("Unexpected coordinate answer.");
  return { userId: options.userId, round: options.round, answer, submittedAt: options.submittedAt, correct: validateAnswer(options.question, answer) };
}

export function resolveRoundScores(options: { submissions: ServerSubmission[]; playerIds: string[]; roundStartedAt: number; roundDurationMs: number; currentScores: Record<string, number> }): { scores: Record<string, number>; winnerId: string | null } {
  const scores = { ...options.currentScores };
  const ranked = [...options.submissions].filter((submission) => submission.correct).sort((left, right) => (left.distanceKm ?? 0) - (right.distanceKm ?? 0) || left.submittedAt - right.submittedAt);
  const winnerId = ranked[0]?.userId || null;
  // Closest Wins rewards distance; placing a faraway pin faster earns no advantage.
  if (winnerId && ranked[0].distanceKm !== undefined) {
    const tied=ranked.filter(item=>(item.distanceKm??Infinity)-(ranked[0].distanceKm??0)<.05);
    for(const item of tied)scores[item.userId]=(scores[item.userId]||0)+normalScore(true,0,options.roundDurationMs);
    return {scores,winnerId:tied.length===1?winnerId:null};
  }
  for (const submission of options.submissions) {
    const remaining = Math.max(0, options.roundStartedAt + options.roundDurationMs - submission.submittedAt);
    scores[submission.userId] = (scores[submission.userId] || 0) + normalScore(submission.correct, remaining, options.roundDurationMs);
  }
  return { scores, winnerId };
}

export function verifyMatchDataset(serverVersion: string, clientVersion: string): void {
  assertDatasetVersion(serverVersion, clientVersion);
}

/**
 * Resolves one Guess the Country tip. When anybody guessed right, the country is finished and the awards are added;
 * otherwise `solved` is false and the next tip should be revealed.
 */
export function resolveGuessTip(options: { submissions: ServerSubmission[]; tip: number; currentScores: Record<string, number> }): { scores: Record<string, number>; awards: GuessAward[]; solved: boolean } {
  const awards = scoreGuessTip(options.submissions.filter((submission) => submission.correct && (submission.tip ?? 0) === options.tip), options.tip);
  const scores = { ...options.currentScores };
  for (const award of awards) scores[award.userId] = (scores[award.userId] || 0) + award.total;
  return { scores, awards, solved: awards.length > 0 };
}

/** One racer's live standing. `done` is final: a finished run can no longer change its score. */
export type RaceEntry = { score: number; done: boolean; updatedAt: number; finishedAt?: number };
export const raceComplete = (race: Record<string, RaceEntry>, playerIds: string[]) => playerIds.length > 0 && playerIds.every((id) => race[id]?.done);
export const raceScores = (race: Record<string, RaceEntry>, playerIds: string[]) => Object.fromEntries(playerIds.map((id) => [id, race[id]?.score ?? 0]));
