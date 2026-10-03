import { isGoTimeControl, type GoTimeControl } from "./config.ts";

export type GoRankedProfileRow = { time_control: GoTimeControl; rating: number; rated_games: number; peak_rating: number; wins: number; losses: number; draws: number; leaderboard_rank: number | null };

/** RPC payloads are runtime data: a TS cast cannot guarantee a supported clock or numeric ratings. */
export function normalizeGoRankedProfile(value: unknown): GoRankedProfileRow[] {
  if (!Array.isArray(value)) return [];
  const rows: GoRankedProfileRow[] = [];
  const integer = (input: unknown) => {
    const number = typeof input === "number" ? input : typeof input === "string" && /^\d+$/.test(input) ? Number(input) : NaN;
    return Number.isSafeInteger(number) && number >= 0 ? number : null;
  };
  for (const row of value) {
    if (!row || typeof row !== "object" || !isGoTimeControl(row.time_control)) continue;
    const rating = integer(row.rating), peak = integer(row.peak_rating), games = integer(row.rated_games);
    const wins = integer(row.wins), losses = integer(row.losses), draws = integer(row.draws);
    if (rating === null || peak === null || games === null || wins === null || losses === null || draws === null) continue;
    const rank = integer(row.leaderboard_rank);
    rows.push({ time_control: row.time_control, rating, peak_rating: peak, rated_games: games, wins, losses, draws, leaderboard_rank: rank && rank > 0 ? rank : null });
  }
  return rows;
}
