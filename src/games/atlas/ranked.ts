import { ONLINE_ARENA_MODES, type ArenaModeDef } from "./modeCatalog.ts";

export const RANKED_CONFIG = {
  provisionalMatches: 10,
  maxBans: 3,
  queueHeartbeatMs: 2_000,
  prestartTimeoutMs: 30_000,
} as const;

export const rankedModes = (): ArenaModeDef[] => ONLINE_ARENA_MODES;
export const maxModeBans = (modeCount = rankedModes().length) => Math.max(0, Math.min(RANKED_CONFIG.maxBans, modeCount - 3));

export function sanitizeBans(ids: readonly string[], modes = rankedModes()): string[] {
  const valid = new Set<string>(modes.map((mode) => mode.online));
  return [...new Set(ids)].filter((id) => valid.has(id)).slice(0, maxModeBans(modes.length));
}

export function chooseRankedMode(modes: readonly string[], aBans: readonly string[], bBans: readonly string[], random = Math.random): string {
  if (!modes.length) throw new Error("No Ranked modes are available.");
  const a = new Set(aBans), b = new Set(bBans);
  // Prefer no bans, then a mode banned by just one player, then the least-banned remaining tier.
  // This guarantees a match if future catalog changes leave too few modes for both ban lists.
  for (const count of [0, 1, 2]) {
    const eligible = modes.filter((mode) => Number(a.has(mode)) + Number(b.has(mode)) === count);
    if (eligible.length) return eligible[Math.floor(random() * eligible.length) % eligible.length];
  }
  throw new Error("No Ranked modes are available.");
}

export function chooseRankedSeries(modes: readonly string[], aBans: readonly string[], bBans: readonly string[], random = Math.random): string[] {
  const available = [...new Set(modes)].filter((mode) => !aBans.includes(mode) && !bBans.includes(mode));
  if (available.length < 3) throw new Error("At least three unbanned Ranked modes are required.");
  const chosen: string[] = [];
  while (chosen.length < 3) {
    const index = Math.min(available.length - 1, Math.floor(random() * available.length));
    chosen.push(available.splice(index, 1)[0]);
  }
  return chosen;
}

export const RANK_THRESHOLDS = [
  { rating: -Infinity, tier: "Bronze", division: 3 }, { rating: 800, tier: "Bronze", division: 2 }, { rating: 900, tier: "Bronze", division: 1 },
  { rating: 1000, tier: "Silver", division: 3 }, { rating: 1100, tier: "Silver", division: 2 }, { rating: 1200, tier: "Silver", division: 1 },
  { rating: 1300, tier: "Gold", division: 3 }, { rating: 1400, tier: "Gold", division: 2 }, { rating: 1500, tier: "Gold", division: 1 },
  { rating: 1600, tier: "Platinum", division: 3 }, { rating: 1700, tier: "Platinum", division: 2 }, { rating: 1800, tier: "Platinum", division: 1 },
  { rating: 1900, tier: "Diamond", division: 3 }, { rating: 2000, tier: "Diamond", division: 2 }, { rating: 2100, tier: "Diamond", division: 1 },
  { rating: 2200, tier: "Master", division: null }, { rating: 2400, tier: "Grandmaster", division: null },
] as const;
const roman = { 1: "I", 2: "II", 3: "III" } as const;
export function getRankFromRating(rating: number) {
  if (!Number.isFinite(rating)) throw new Error("Invalid rating.");
  const rank = [...RANK_THRESHOLDS].reverse().find((entry) => rating >= entry.rating)!;
  return { tier: rank.tier, division: rank.division, displayName: rank.division === null ? rank.tier : `${rank.tier} ${roman[rank.division]}` };
}

export function certifiedRating(rating:number,deviation:number,matchesPlayed:number):number {
  let value=rating>=1900 ? rating-.5*Math.max(0,deviation) : rating;
  if(matchesPlayed<14)value=Math.min(value,1899);
  if(matchesPlayed<20)value=Math.min(value,2199);
  if(matchesPlayed<30)value=Math.min(value,2399);
  return value;
}
export function getRankFromProfile(profile:{rating:number;deviation:number;matches_played:number}) {
  const provisional=profile.matches_played<RANKED_CONFIG.provisionalMatches;
  return {...getRankFromRating(provisional?profile.rating:certifiedRating(profile.rating,profile.deviation,profile.matches_played)),provisional,tentative:profile.matches_played>=3,confidence:Math.max(0,Math.min(100,Math.round((1-profile.deviation/350)*100)))};
}
