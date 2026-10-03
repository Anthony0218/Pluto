import { seededRandom } from "../random.ts";
import { REGION_BUILDER } from "./config.ts";
import { pickOne, sampleUnique, type TrialCountry } from "./countryStats.ts";
import { REGIONS, type RegionDefinition } from "./regions.ts";

export type RegionRound = { regionId: string; targetIds: string[]; optionIds: string[] };
export type RegionRun = {
  seed: string; roundIndex: number; round: RegionRound; found: string[];
  /** picking → complete (next region) or over: the first wrong card ends the run immediately. */
  phase: "picking" | "complete" | "over"; wrongId: string | null;
  score: number; lastPoints: number; regionsCompleted: number; correctPicks: number; usedRegions: string[];
};

export const regionById = (id: string) => REGIONS.find((region) => region.id === id)!;
/** Members of a region that exist in the playable pool, e.g. Palestine only when the pool includes it. */
const membersIn = (region: RegionDefinition, byIso: Map<string, TrialCountry>) => region.members.map((iso) => byIso.get(iso)).filter((country): country is TrialCountry => Boolean(country));

/** Regions open up by tier as the run goes on; at least three members must be playable. */
export function regionsForRound(roundIndex: number, byIso: Map<string, TrialCountry>) {
  const maxTier = roundIndex < 3 ? 1 : roundIndex < 6 ? 2 : 3;
  return REGIONS.filter((region) => region.tier <= maxTier && membersIn(region, byIso).length >= 3);
}

/**
 * Shows up to seven members plus distractors. Later rounds add distractors and draw more of them from right next
 * door (neighbours of members, then the same subregion), never from countries other definitions would include.
 */
export function generateRegionRound(pool: readonly TrialCountry[], seed: string, roundIndex: number, usedRegions: string[] = []): RegionRound {
  const random = seededRandom(`${seed}:region:${roundIndex}`);
  const byIso = new Map(pool.map((country) => [country.iso3, country]));
  const available = regionsForRound(roundIndex, byIso);
  const fresh = available.filter((region) => !usedRegions.includes(region.id));
  const region = pickOne(fresh.length ? fresh : available, random);
  const members = membersIn(region, byIso);
  const targets = sampleUnique(members, Math.min(REGION_BUILDER.maxShownMembers, members.length), random);
  const excluded = new Set([...region.members, ...(region.ambiguous ?? [])]);
  const outsiders = pool.filter((country) => !excluded.has(country.iso3));
  const memberIds = new Set(members.map((country) => country.id));
  const near = outsiders.filter((country) => country.neighbors.some((id) => memberIds.has(id)));
  const sameArea = outsiders.filter((country) => !near.includes(country) && members.some((member) => member.subregion === country.subregion || member.continent === country.continent));
  const distractorCount = Math.max(REGION_BUILDER.minDistractors, Math.min(REGION_BUILDER.maxDistractors, REGION_BUILDER.cardTarget + Math.floor(roundIndex / 2) - targets.length));
  // The share of "next door" distractors grows from about a third to all of them.
  const closeShare = Math.min(1, .35 + roundIndex * .1);
  const picks: TrialCountry[] = [];
  for (const [source, wanted] of [[near, Math.round(distractorCount * closeShare)], [sameArea, distractorCount], [outsiders, distractorCount]] as const) {
    const remaining = source.filter((country) => !picks.includes(country));
    picks.push(...sampleUnique(remaining, Math.min(remaining.length, wanted, distractorCount - picks.length), random));
  }
  const options = sampleUnique([...targets, ...picks], targets.length + picks.length, random);
  return { regionId: region.id, targetIds: targets.map((country) => country.id), optionIds: options.map((country) => country.id) };
}

export function createRegionRun(pool: readonly TrialCountry[], seed: string): RegionRun {
  const round = generateRegionRound(pool, seed, 0);
  return { seed, roundIndex: 0, round, found: [], phase: "picking", wrongId: null, score: 0, lastPoints: 0, regionsCompleted: 0, correctPicks: 0, usedRegions: [round.regionId] };
}

/** Correct cards lock in; a wrong card ends the run at once. Repeated or out-of-phase picks change nothing. */
export function pickRegionCountry(run: RegionRun, countryId: string): RegionRun {
  if (run.phase !== "picking" || run.found.includes(countryId) || !run.round.optionIds.includes(countryId)) return run;
  if (!run.round.targetIds.includes(countryId)) return { ...run, phase: "over", wrongId: countryId, lastPoints: 0 };
  const found = [...run.found, countryId], complete = found.length === run.round.targetIds.length;
  const bonus = complete ? REGION_BUILDER.regionComplete + run.roundIndex * REGION_BUILDER.roundBonus : 0;
  const points = REGION_BUILDER.perCountry + bonus;
  return { ...run, found, correctPicks: run.correctPicks + 1, score: run.score + points, lastPoints: points, phase: complete ? "complete" : "picking", regionsCompleted: run.regionsCompleted + Number(complete) };
}
export function nextRegionRound(run: RegionRun, pool: readonly TrialCountry[]): RegionRun {
  if (run.phase !== "complete") return run;
  const roundIndex = run.roundIndex + 1, round = generateRegionRound(pool, run.seed, roundIndex, run.usedRegions);
  return { ...run, roundIndex, round, found: [], phase: "picking", wrongId: null, lastPoints: 0, usedRegions: [...run.usedRegions, round.regionId] };
}
