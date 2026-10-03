import { seededRandom } from "../random.ts";
import type { AtlasDifficulty } from "../types.ts";
import { STAT_RANKING } from "./config.ts";
import { compareCountryStats, getCountryStat, pickOne, relativeGap, sampleUnique, STAT_IDS, STATS, type TrialCountry, type TrialStatId } from "./countryStats.ts";

export type RankingRound = { statId: TrialStatId; countryIds: string[]; correctOrder: string[] };
export type RankingPlacement = { id: string; guessedIndex: number; correctIndex: number; points: number };
export type RankingResult = { placements: RankingPlacement[]; total: number; perfect: boolean };
export type RankingRun = {
  seed: string; difficulty: AtlasDifficulty; roundIndex: number; round: RankingRound; order: string[];
  phase: "ordering" | "revealed" | "over"; result: RankingResult | null; score: number; perfects: number;
};

export const RANKING_STATS = STAT_IDS.filter((id) => STATS[id].usableIn.ranking);

/** Highest → lowest. Every card in a round has the stat, and neighbouring values differ by the difficulty's gap. */
export function generateRankingRound(pool: readonly TrialCountry[], seed: string, roundIndex: number, difficulty: AtlasDifficulty): RankingRound {
  const random = seededRandom(`${seed}:ranking:${roundIndex}`);
  const size = STAT_RANKING.cards[difficulty], gap = STAT_RANKING.minGap[difficulty];
  for (let attempt = 0; attempt < 200; attempt += 1) {
    const statId = pickOne(RANKING_STATS, random);
    const eligible = pool.filter((country) => getCountryStat(country, statId) !== null);
    const picked: TrialCountry[] = [];
    for (const candidate of sampleUnique(eligible, eligible.length, random)) {
      if (picked.every((other) => relativeGap(getCountryStat(candidate, statId)!, getCountryStat(other, statId)!) >= gap)) picked.push(candidate);
      if (picked.length === size) break;
    }
    if (picked.length < size) continue;
    const correctOrder = [...picked].sort((left, right) => compareCountryStats(right, left, statId)).map((country) => country.id);
    return { statId, countryIds: picked.map((country) => country.id), correctOrder };
  }
  throw new Error("Could not build a ranking round.");
}

/** Exact slot: 100; one/two slots off earn partial credit. A perfect order earns a small bonus. */
export function scoreRanking(order: string[], correctOrder: string[]): RankingResult {
  const placements = order.map((id, guessedIndex) => {
    const correctIndex = correctOrder.indexOf(id), offset = Math.abs(correctIndex - guessedIndex);
    return { id, guessedIndex, correctIndex, points: offset === 0 ? STAT_RANKING.exact : offset === 1 ? STAT_RANKING.offByOne : offset === 2 ? STAT_RANKING.offByTwo : 0 };
  });
  const perfect = placements.every((placement) => placement.guessedIndex === placement.correctIndex);
  return { placements, perfect, total: placements.reduce((sum, placement) => sum + placement.points, 0) + (perfect ? STAT_RANKING.perfectBonus : 0) };
}

export function createRankingRun(pool: readonly TrialCountry[], seed: string, difficulty: AtlasDifficulty): RankingRun {
  const round = generateRankingRound(pool, seed, 0, difficulty);
  return { seed, difficulty, roundIndex: 0, round, order: round.countryIds, phase: "ordering", result: null, score: 0, perfects: 0 };
}
/** Reordering only works before lock-in, and only with the round's own cards. */
export function reorderRanking(run: RankingRun, order: string[]): RankingRun {
  if (run.phase !== "ordering" || order.length !== run.order.length || [...order].sort().join() !== [...run.order].sort().join()) return run;
  return { ...run, order };
}
export function lockInRanking(run: RankingRun): RankingRun {
  if (run.phase !== "ordering") return run;
  const result = scoreRanking(run.order, run.round.correctOrder);
  return { ...run, phase: "revealed", result, score: run.score + result.total, perfects: run.perfects + Number(result.perfect) };
}
export function nextRankingRound(run: RankingRun, pool: readonly TrialCountry[]): RankingRun {
  if (run.phase !== "revealed") return run;
  if (run.roundIndex + 1 >= STAT_RANKING.rounds) return { ...run, phase: "over" };
  const roundIndex = run.roundIndex + 1, round = generateRankingRound(pool, run.seed, roundIndex, run.difficulty);
  return { ...run, roundIndex, round, order: round.countryIds, phase: "ordering", result: null };
}
