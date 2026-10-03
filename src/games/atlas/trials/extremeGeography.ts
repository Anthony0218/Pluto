import { seededRandom } from "../random.ts";
import type { AtlasDifficulty } from "../types.ts";
import { EXTREME_GEOGRAPHY } from "./config.ts";
import { compareCountryStats, getCountryStat, pickOne, relativeGap, sampleUnique, STAT_IDS, STATS, type StatDirection, type TrialCountry, type TrialStatId } from "./countryStats.ts";

/** One question type per stat and direction, so "highest" vs "lowest" is configuration, not code. */
export type ExtremeCategory = { id: string; statId: TrialStatId; direction: StatDirection; question: string };
export const EXTREME_CATEGORIES: ExtremeCategory[] = STAT_IDS.filter((id) => STATS[id].usableIn.extreme).flatMap((statId) =>
  (["highest", "lowest"] as const).map((direction) => ({ id: `${statId}:${direction}`, statId, direction, question: `Which country has ${STATS[statId].extremes[direction]}?` })));

export type ExtremeRound = { categoryId: string; countryIds: string[]; answerId: string; extreme: boolean };
export type ExtremeRun = {
  seed: string; difficulty: AtlasDifficulty; roundIndex: number; round: ExtremeRound;
  phase: "answering" | "revealed" | "over"; picked: string | null; correct: boolean | null;
  score: number; correctCount: number; streak: number; bestStreak: number; lastPoints: number;
};

export const categoryById = (id: string) => EXTREME_CATEGORIES.find((category) => category.id === id)!;
export const isExtremeRound = (roundIndex: number) => (roundIndex + 1) % EXTREME_GEOGRAPHY.extremeEvery === 0;
/** The country that wins `category` among `countries` (callers guarantee no tie at the top). */
export function extremeWinner(countries: TrialCountry[], category: Pick<ExtremeCategory, "statId" | "direction">): TrialCountry {
  return [...countries].sort((left, right) => compareCountryStats(right, left, category.statId, category.direction))[0];
}

export function generateExtremeRound(pool: readonly TrialCountry[], seed: string, roundIndex: number, difficulty: AtlasDifficulty, previousCategory?: string): ExtremeRound {
  const random = seededRandom(`${seed}:extreme:${roundIndex}`);
  const extreme = isExtremeRound(roundIndex), size = extreme ? EXTREME_GEOGRAPHY.extremeChoices : EXTREME_GEOGRAPHY.choices;
  const gap = EXTREME_GEOGRAPHY.minGap[difficulty];
  const categories = EXTREME_CATEGORIES.filter((category) => category.id !== previousCategory);
  for (let attempt = 0; attempt < 300; attempt += 1) {
    const category = pickOne(categories, random);
    const eligible = pool.filter((country) => getCountryStat(country, category.statId) !== null);
    if (eligible.length < size) continue;
    const countries = sampleUnique(eligible, size, random);
    const ranked = [...countries].sort((left, right) => compareCountryStats(right, left, category.statId, category.direction));
    const best = getCountryStat(ranked[0], category.statId)!, runnerUp = getCountryStat(ranked[1], category.statId)!;
    // Border counts are small integers: a clear winner simply needs a strictly better count.
    const clear = category.statId === "neighborCount" ? best !== runnerUp : relativeGap(best, runnerUp) >= gap;
    if (clear) return { categoryId: category.id, countryIds: countries.map((country) => country.id), answerId: ranked[0].id, extreme };
  }
  throw new Error("Could not build an extreme round.");
}

/** Base points plus a bonus that shrinks linearly over the time limit; doubled on extreme rounds. */
export function extremePoints(elapsedMs: number, extreme: boolean) {
  const speed = Math.max(0, 1 - elapsedMs / EXTREME_GEOGRAPHY.timeLimitMs);
  return Math.round((EXTREME_GEOGRAPHY.correct + EXTREME_GEOGRAPHY.maxSpeedBonus * speed) * (extreme ? EXTREME_GEOGRAPHY.extremeMultiplier : 1));
}

export function createExtremeRun(pool: readonly TrialCountry[], seed: string, difficulty: AtlasDifficulty): ExtremeRun {
  return { seed, difficulty, roundIndex: 0, round: generateExtremeRound(pool, seed, 0, difficulty), phase: "answering", picked: null, correct: null, score: 0, correctCount: 0, streak: 0, bestStreak: 0, lastPoints: 0 };
}
/** `countryId === null` is a timeout. Only the first answer of a round counts. */
export function answerExtreme(run: ExtremeRun, countryId: string | null, elapsedMs: number): ExtremeRun {
  if (run.phase !== "answering" || (countryId !== null && !run.round.countryIds.includes(countryId))) return run;
  const correct = countryId === run.round.answerId, points = correct ? extremePoints(elapsedMs, run.round.extreme) : 0, streak = correct ? run.streak + 1 : 0;
  return { ...run, phase: "revealed", picked: countryId, correct, score: run.score + points, correctCount: run.correctCount + Number(correct), streak, bestStreak: Math.max(run.bestStreak, streak), lastPoints: points };
}
export function nextExtremeRound(run: ExtremeRun, pool: readonly TrialCountry[]): ExtremeRun {
  if (run.phase !== "revealed") return run;
  if (run.roundIndex + 1 >= EXTREME_GEOGRAPHY.rounds) return { ...run, phase: "over" };
  const roundIndex = run.roundIndex + 1;
  return { ...run, roundIndex, round: generateExtremeRound(pool, run.seed, roundIndex, run.difficulty, run.round.categoryId), phase: "answering", picked: null, correct: null, lastPoints: 0 };
}
