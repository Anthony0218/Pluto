import { assertDatasetVersion, captureTerritory, haversineKm, normalScore, type TerritoryState } from "./rules.ts";
import { validateAnswer } from "./engine.ts";
import { scoreGuessTip, type GuessAward } from "./guessCountry.ts";
import type { AtlasQuestion, Coordinates } from "./types.ts";

export type AtlasMultiplayerMode = "map_battle" | "closest_wins" | "higher_lower" | "territory_battle" | "flag_battle" | "guess_country";
export const ATLAS_MULTIPLAYER_MODES: AtlasMultiplayerMode[] = ["map_battle", "closest_wins", "higher_lower", "territory_battle", "flag_battle", "guess_country"];
/** Territory ownership is two-coloured; every other mode seats two to four players. */
export const maxPlayersFor = (mode: AtlasMultiplayerMode) => mode === "territory_battle" ? 2 : 4;
export const clampPlayers = (mode: AtlasMultiplayerMode, requested: unknown) => Math.min(maxPlayersFor(mode), Math.max(2, Math.trunc(Number(requested)) || 2));
export type AtlasMatchStatus = "waiting" | "ready" | "countdown" | "round_active" | "round_resolving" | "next_round" | "finished";
export type ServerSubmission = { userId: string; round: number; answer: string | Coordinates; submittedAt: number; correct: boolean; distanceKm?: number; tip?: number };

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

export function createAuthoritativeSubmission(options: { userId: string; round: number; answer: unknown; mode: AtlasMultiplayerMode; question: AtlasQuestion; submittedAt: number }): ServerSubmission {
  const answer = parseClientAnswer(options.answer, options.mode);
  if (options.mode === "closest_wins") {
    const target = options.question.interaction === "closest_click" ? options.question.targetCoordinates : options.question.interaction === "map_click" ? options.question.targetCoordinates : null;
    if (!target || typeof answer === "string") throw new Error("This round has no point target.");
    return { userId: options.userId, round: options.round, answer, submittedAt: options.submittedAt, correct: true, distanceKm: haversineKm(answer, target) };
  }
  if (Array.isArray(answer)) throw new Error("Unexpected coordinate answer.");
  return { userId: options.userId, round: options.round, answer, submittedAt: options.submittedAt, correct: validateAnswer(options.question, answer) };
}

export function resolveRoundScores(options: { submissions: ServerSubmission[]; playerIds: string[]; roundStartedAt: number; roundDurationMs: number; currentScores: Record<string, number> }): { scores: Record<string, number>; winnerId: string | null } {
  const scores = { ...options.currentScores };
  const ranked = [...options.submissions].filter((submission) => submission.correct).sort((left, right) => (left.distanceKm ?? 0) - (right.distanceKm ?? 0) || left.submittedAt - right.submittedAt);
  const winnerId = ranked[0]?.userId || null;
  for (const submission of options.submissions) {
    const remaining = Math.max(0, options.roundStartedAt + options.roundDurationMs - submission.submittedAt);
    scores[submission.userId] = (scores[submission.userId] || 0) + normalScore(submission.correct, remaining, options.roundDurationMs);
  }
  if (winnerId && ranked[0].distanceKm !== undefined) scores[winnerId] += 500;
  return { scores, winnerId };
}

export function applyTerritoryRound(state: TerritoryState, entityId: string, winnerId: string | null, playerIds: [string, string], allowSteal: boolean): TerritoryState {
  if (!winnerId) return state;
  return captureTerritory(state, entityId, winnerId === playerIds[0] ? "player_a" : "player_b", allowSteal);
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
