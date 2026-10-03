import { seededRandom } from "../random.ts";
import type { AtlasDifficulty } from "../types.ts";
import { STAT_DETECTIVE } from "./config.ts";
import { generateDistractors, getCountryStat, pickOne, relativeGap, sampleUnique, STAT_IDS, STATS, type TrialCountry, type TrialStatId } from "./countryStats.ts";

export type DetectiveRound = { answerId: string; optionIds: string[]; statIds: TrialStatId[]; showRegion: boolean };
export type DetectiveRun = {
  seed: string; difficulty: AtlasDifficulty; roundIndex: number; round: DetectiveRound;
  phase: "guessing" | "revealed" | "over"; picked: string | null; correct: boolean | null;
  score: number; lives: number; streak: number; bestStreak: number; solved: number; lastPoints: number; history: string[];
};

const DETECTIVE_STATS = STAT_IDS.filter((id) => STATS[id].usableIn.detective);
/** A distractor must differ visibly on at least one shown stat, so every question has exactly one defensible answer. */
const distinguishable = (answer: TrialCountry, candidate: TrialCountry, stats: TrialStatId[]) => stats.some((stat) => {
  const left = getCountryStat(answer, stat), right = getCountryStat(candidate, stat);
  if (left === null || right === null) return false;
  return stat === "neighborCount" ? left !== right : relativeGap(left, right) >= .2;
});

export function generateDetectiveRound(pool: readonly TrialCountry[], seed: string, roundIndex: number, difficulty: AtlasDifficulty, avoid: string[] = []): DetectiveRound {
  const random = seededRandom(`${seed}:detective:${roundIndex}`);
  const fresh = pool.filter((country) => !avoid.includes(country.id));
  const answer = pickOne(fresh.length ? fresh : pool, random);
  const statIds = sampleUnique(DETECTIVE_STATS.filter((stat) => getCountryStat(answer, stat) !== null), STAT_DETECTIVE.statCount, random)
    .sort((left, right) => DETECTIVE_STATS.indexOf(left) - DETECTIVE_STATS.indexOf(right));
  const optionCount = STAT_DETECTIVE.options[difficulty];
  const candidates = pool.filter((country) => country.id !== answer.id && distinguishable(answer, country, statIds));
  const options = sampleUnique([answer, ...generateDistractors(answer, candidates, optionCount - 1, random)], optionCount, random);
  // Beginners always see the continent; later players get it only when the options span several continents anyway.
  const showRegion = difficulty === "beginner" || new Set(options.map((country) => country.continent)).size > 1;
  return { answerId: answer.id, optionIds: options.map((country) => country.id), statIds, showRegion };
}

export function createDetectiveRun(pool: readonly TrialCountry[], seed: string, difficulty: AtlasDifficulty): DetectiveRun {
  const round = generateDetectiveRound(pool, seed, 0, difficulty);
  return { seed, difficulty, roundIndex: 0, round, phase: "guessing", picked: null, correct: null, score: 0, lives: STAT_DETECTIVE.lives, streak: 0, bestStreak: 0, solved: 0, lastPoints: 0, history: [round.answerId] };
}
export const detectivePoints = (streakBefore: number) => STAT_DETECTIVE.correct + Math.min(STAT_DETECTIVE.maxStreakBonus, streakBefore * STAT_DETECTIVE.streakBonus);

/** One guess per case: right or wrong, the round is revealed. Out-of-phase guesses are ignored. */
export function submitDetectiveGuess(run: DetectiveRun, countryId: string): DetectiveRun {
  if (run.phase !== "guessing" || !run.round.optionIds.includes(countryId)) return run;
  if (countryId === run.round.answerId) {
    const points = detectivePoints(run.streak), streak = run.streak + 1;
    return { ...run, phase: "revealed", picked: countryId, correct: true, score: run.score + points, streak, bestStreak: Math.max(run.bestStreak, streak), solved: run.solved + 1, lastPoints: points };
  }
  return { ...run, phase: "revealed", picked: countryId, correct: false, lives: run.lives - 1, streak: 0, lastPoints: 0 };
}
export function nextDetectiveRound(run: DetectiveRun, pool: readonly TrialCountry[]): DetectiveRun {
  if (run.phase !== "revealed") return run;
  if (run.lives <= 0 || run.roundIndex + 1 >= STAT_DETECTIVE.rounds) return { ...run, phase: "over" };
  const roundIndex = run.roundIndex + 1, round = generateDetectiveRound(pool, run.seed, roundIndex, run.difficulty, run.history);
  return { ...run, roundIndex, round, phase: "guessing", picked: null, correct: null, lastPoints: 0, history: [...run.history, round.answerId] };
}
