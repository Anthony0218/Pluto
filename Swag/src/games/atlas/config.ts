import type { AtlasDifficulty, AtlasStatKey } from "./types.ts";

export const ATLAS_SCORING = {
  normalCorrect: 1000,
  maxSpeedBonus: 500,
  speedRunCorrect: 100,
  speedRunMaxMultiplier: 3,
  mapFillCountry: 100,
  mapFillCompletion: 2500,
  mapFillStreak: 10,
  territoryRounds: 20,
} as const;

export const DIFFICULTY_RULES: Record<AtlasDifficulty, { roundSeconds: number; minimumPopulation: number; minimumArea: number; choiceCount: number; sameContinentDistractors: boolean }> = {
  beginner: { roundSeconds: 20, minimumPopulation: 10_000_000, minimumArea: 250_000, choiceCount: 3, sameContinentDistractors: false },
  intermediate: { roundSeconds: 14, minimumPopulation: 250_000, minimumArea: 2_000, choiceCount: 4, sameContinentDistractors: true },
  expert: { roundSeconds: 9, minimumPopulation: 0, minimumArea: 0, choiceCount: 4, sameContinentDistractors: true },
};

export const STAT_DEFINITIONS: Record<AtlasStatKey, { label: string; unit: string; timeSensitive: boolean }> = {
  population: { label: "Population", unit: "people", timeSensitive: true },
  areaKm2: { label: "Area", unit: "km²", timeSensitive: false },
  neighborCount: { label: "Land borders", unit: "neighbors", timeSensitive: false },
  officialLanguageCount: { label: "Official languages", unit: "languages", timeSensitive: false },
};
