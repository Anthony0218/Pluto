import type { Match, MinigameResult } from "../types.ts";

export const FESTIVAL_PLACEMENT_POINTS = [6, 4, 2, 0] as const;

// Every four-player round distributes 12 points. Equal game scores share the
// average of their occupied places, so a random rank tiebreak never awards points.
export function festivalRoundPoints(
  results: readonly MinigameResult[],
  teamOf?: (playerId: string) => string,
): Record<string, number> {
  if (!results.length) return {};
  if (teamOf) {
    const winningTeam = teamOf(results[0].playerId);
    const draw = results.every((r) => r.score === results[0].score);
    const winners = results.filter((r) => teamOf(r.playerId) === winningTeam).length;
    if (winners !== 2) return Object.fromEntries(results.map((r) => [r.playerId,
      draw ? 12 / results.length : teamOf(r.playerId) === winningTeam ? 12 / winners : 0,
    ]));
    return Object.fromEntries(results.map((r) => [r.playerId,
      draw ? 3 : teamOf(r.playerId) === winningTeam ? 5 : 1,
    ]));
  }
  const sorted = [...results].sort((a, b) => (b.score ?? 0) - (a.score ?? 0));
  return Object.fromEntries(sorted.map((r) => {
    const tiedPlaces = sorted.flatMap((other, i) => (other.score ?? 0) === (r.score ?? 0) ? [i] : []);
    const points = tiedPlaces.reduce((sum, i) => sum + FESTIVAL_PLACEMENT_POINTS[i], 0) / tiedPlaces.length;
    return [r.playerId, points];
  }));
}

// Coins, seats and the last game's shuffled ranking never decide a festival tie.
export function festivalWinners(match: Match): string[] {
  const best = Math.max(...match.players.map((p) => match.festivalScores?.[p.id] ?? 0));
  return match.players.filter((p) => (match.festivalScores?.[p.id] ?? 0) === best).map((p) => p.id);
}
