import { GUESS_SCORING } from "./config.ts";
import { entitiesForDifficulty, entitiesForScope, normalizedContinent } from "./engine.ts";
import { randomCountryHints } from "./countryHints.ts";
import { seededRandom, shuffled } from "./random.ts";
import type { AtlasDifficulty, AtlasExtras, GeographicEntity, GuessClue, GuessCountryQuestion } from "./types.ts";

/** Four random hints followed by the decisive flag reveal in slot five. */
export function countryClues(entity: GeographicEntity, extras: AtlasExtras, random: () => number = Math.random): GuessClue[] {
  const summit = extras.highestPoints[entity.id];
  const clues: GuessClue[] = randomCountryHints({
    name: entity.shortName, otherNames: [entity.canonicalName, ...entity.aliases],
    continent: normalizedContinent(entity), subregion: entity.subregion,
    population: entity.population?.value, areaKm2: entity.areaKm2?.value, neighborCount: entity.neighbors.length,
    capital: entity.capitalCities[0] ?? null, capitalCoordinates: entity.capitalCoordinates,
    officialLanguages: entity.officialLanguages, currencies: entity.currencies,
    summitName: summit?.name, highestPointM: summit?.elevationM,
  }, random);
  const capital = entity.capitalCities[0];
  clues.push({ kind: "capital", text: capital ? `This is its flag, and its capital starts with “${capital[0]}”.` : "This is its flag.", flagAsset: entity.flagAsset });
  return clues;
}

export function generateGuessCountryQuestions(options: { entities: GeographicEntity[]; extras: AtlasExtras; datasetVersion: string; seed: string; difficulty: AtlasDifficulty; count: number }): GuessCountryQuestion[] {
  const pool = entitiesForDifficulty(entitiesForScope(options.entities, "un195"), options.difficulty).filter((entity) => entity.population && entity.flagAsset);
  const order = shuffled(pool, seededRandom(`${options.datasetVersion}:${options.seed}:${options.difficulty}:guess`));
  return Array.from({ length: options.count }, (_, index) => {
    const entity = order[index % order.length];
    return { id: `${options.seed}:guess:${index}`, seed: options.seed, entityId: entity.id, entityType: entity.entityType, category: "clues", interaction: "guess_country", difficulty: options.difficulty, scope: "un195", prompt: "Which country is it?", answer: entity.id, clues: countryClues(entity, options.extras, seededRandom(`${options.datasetVersion}:${options.seed}:${options.difficulty}:guess:${index}:${entity.id}:clues`)), sourceMetadata: [] };
  });
}

export type GuessAward = { userId: string; base: number; bonus: number; total: number; first: boolean };
/** Correct guesses of one tip, fastest first: 3 points for the first, 2 for everyone else, plus the early-tip bonus. */
export function scoreGuessTip(correct: { userId: string; submittedAt: number }[], tip: number): GuessAward[] {
  const bonus = GUESS_SCORING.tipBonus[tip] ?? 0;
  return [...correct].sort((left, right) => left.submittedAt - right.submittedAt).map((guess, index) => {
    const base = index === 0 ? GUESS_SCORING.first : GUESS_SCORING.other;
    return { userId: guess.userId, base, bonus, total: base + bonus, first: index === 0 };
  });
}
