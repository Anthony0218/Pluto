import type { AtlasDifficulty } from "../types.ts";

/** Every Trials scoring and pacing constant lives here so balancing never means hunting through components. */
export const COUNTRY_GUESSER = {
  /** Points for a correct guess after 1, 2, 3, 4 or 5 revealed clues. */
  pointsByClues: [1000, 750, 500, 300, 100],
  options: 6, lives: 3, rounds: 10,
} as const;

export const STAT_DETECTIVE = {
  correct: 500, streakBonus: 100, maxStreakBonus: 500, lives: 3, rounds: 12,
  options: { beginner: 4, intermediate: 5, expert: 6 } satisfies Record<AtlasDifficulty, number>,
  statCount: 4,
} as const;

export const REGION_BUILDER = {
  perCountry: 100, regionComplete: 500, roundBonus: 100,
  /** Rounds aim for about this many cards (one more every two rounds), with 4–9 distractors. */
  maxShownMembers: 7, cardTarget: 12, minDistractors: 4, maxDistractors: 9,
} as const;

export const STAT_RANKING = {
  exact: 100, offByOne: 50, offByTwo: 20, perfectBonus: 100, rounds: 8,
  cards: { beginner: 4, intermediate: 5, expert: 6 } satisfies Record<AtlasDifficulty, number>,
  /** Neighbouring values in a round differ by at least this share, so rounding can't decide a ranking. */
  minGap: { beginner: .3, intermediate: .15, expert: .06 } satisfies Record<AtlasDifficulty, number>,
} as const;

export const EXTREME_GEOGRAPHY = {
  correct: 300, maxSpeedBonus: 15, timeLimitMs: 10_000, rounds: 15,
  choices: 4, extremeChoices: 6, extremeMultiplier: 2, extremeEvery: 5,
  /** The winner must beat the runner-up by this share, so the question is never a coin flip. */
  minGap: { beginner: .3, intermediate: .15, expert: .07 } satisfies Record<AtlasDifficulty, number>,
} as const;

export const STAT_BATTLE = { handSize: 5, winTarget: 5 } as const;
