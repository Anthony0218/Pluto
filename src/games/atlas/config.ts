import type { AtlasDifficulty, AtlasStatKey } from "./types.ts";

export const ATLAS_SCORING = {
  normalCorrect: 1000,
  maxSpeedBonus: 50,
  speedRunCorrect: 150,
  speedRunWrong: -150,
  mapFillCountry: 100,
  mapFillCompletion: 2500,
  mapFillStreak: 10,
} as const;

export const DIFFICULTY_RULES: Record<AtlasDifficulty, { roundSeconds: number; minimumPopulation: number; minimumArea: number; choiceCount: number; sameContinentDistractors: boolean }> = {
  beginner: { roundSeconds: 20, minimumPopulation: 10_000_000, minimumArea: 250_000, choiceCount: 3, sameContinentDistractors: false },
  intermediate: { roundSeconds: 14, minimumPopulation: 250_000, minimumArea: 2_000, choiceCount: 4, sameContinentDistractors: true },
  expert: { roundSeconds: 9, minimumPopulation: 0, minimumArea: 0, choiceCount: 4, sameContinentDistractors: true },
};

/** Map Battle gives the same, longer deadline at every difficulty and in every match type (solo, casual, ranked). */
export const MAP_BATTLE_ROUND_SECONDS = 30;
/** Answer deadline for a question: Map Battle is fixed, other modes follow the chosen difficulty. */
export const roundSecondsFor = (mode: string, difficulty: AtlasDifficulty) => mode === "map_click" || mode === "map_battle" ? MAP_BATTLE_ROUND_SECONDS : DIFFICULTY_RULES[difficulty].roundSeconds;

export const STAT_DEFINITIONS: Record<AtlasStatKey, { label: string; unit: string; timeSensitive: boolean }> = {
  population: { label: "Population", unit: "people", timeSensitive: true },
  areaKm2: { label: "Area", unit: "km²", timeSensitive: false },
  neighborCount: { label: "Land borders", unit: "neighbors", timeSensitive: false },
  officialLanguageCount: { label: "Official languages", unit: "languages", timeSensitive: false },
  highestPointM: { label: "Highest point", unit: "m", timeSensitive: false },
  elevationM: { label: "Elevation", unit: "m", timeSensitive: false },
  countryCount: { label: "Countries", unit: "countries", timeSensitive: false },
};

/** Guess the Country: the first correct guesser earns `first`, every later correct guesser in the same tip `other`;
 *  solving on tip 1 or 2 adds `tipBonus[tip]`. */
export const GUESS_SCORING = { first: 3, other: 3, tipBonus: [2, 1] as readonly number[], tipSeconds: 25, afterFirstCorrectSeconds: 8 } as const;
