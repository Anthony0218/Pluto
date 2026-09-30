import type { Match, PlayerMatchStats } from "../types.ts";

export function emptyStats(): PlayerMatchStats {
  return { minigameWins: 0, duelWins: 0, knockouts: 0 };
}
// Results-screen tallies only. Never read by a rule, so they cannot change an outcome.
export function bumpStat(state: Match, playerId: string, key: keyof PlayerMatchStats) {
  state.stats ??= {};
  const entry = (state.stats[playerId] ??= emptyStats());
  entry[key]++;
}
