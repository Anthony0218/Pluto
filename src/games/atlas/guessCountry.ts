import { GUESS_SCORING } from "./config.ts";
import { entitiesForDifficulty, entitiesForScope } from "./engine.ts";
import { phraseFor } from "./phrases.ts";
import { seededRandom, shuffled } from "./random.ts";
import type { AtlasDifficulty, AtlasExtras, GeographicEntity, GuessClue, GuessCountryQuestion } from "./types.ts";

const compact = (value: number) => new Intl.NumberFormat("en", { notation: "compact", maximumFractionDigits: 1 }).format(value);
const grouped = (value: number) => new Intl.NumberFormat("en").format(Math.round(value));
/** True when a clue word shares its first four letters with a word of the country name ("Mexican Peso", "Mount Kenya")
 *  or contains one outright ("Kinyarwanda"). */
function namesCountry(text: string, entity: GeographicEntity) {
  const words = [entity.shortName, entity.canonicalName, ...entity.aliases].flatMap((name) => name.toLowerCase().split(/[^\p{L}]+/u)).filter((word) => word.length >= 4);
  const lower = text.toLowerCase(), stems = words.map((word) => word.slice(0, 4));
  return words.some((word) => word.length >= 5 && lower.includes(word)) || lower.split(/[^\p{L}]+/u).some((word) => word.length >= 4 && stems.includes(word.slice(0, 4)));
}

/** Six clues, hardest first. None of them names the country; the last one shows the flag. */
export function countryClues(entity: GeographicEntity, extras: AtlasExtras): GuessClue[] {
  const clues: GuessClue[] = [];
  const population = entity.population?.value, area = entity.areaKm2?.value;
  clues.push({ kind: "numbers", text: population && area ? `About ${compact(population)} people live here, on ${grouped(area)} km².` : `This country is home to about ${compact(population || 0)} people.` });
  const summit = extras.highestPoints[entity.id];
  clues.push(summit
    ? { kind: "summit", text: namesCountry(summit.name, entity) ? `Its highest point rises to ${grouped(summit.elevationM)} m above sea level.` : `Its highest point is ${summit.name}, at ${grouped(summit.elevationM)} m.` }
    : { kind: "summit", text: entity.neighbors.length ? `It shares land borders with ${entity.neighbors.length} ${entity.neighbors.length === 1 ? "country" : "countries"}.` : "It has no land borders at all." });
  const phrase = phraseFor(entity.officialLanguages);
  if (phrase) clues.push({ kind: "phrase", text: `Overheard on a street here: “${phrase}”` });
  const borders = entity.neighbors.length ? `borders ${entity.neighbors.length} ${entity.neighbors.length === 1 ? "country" : "countries"}` : "has no land borders";
  const region = entity.subregion && !namesCountry(entity.subregion, entity) ? entity.subregion : entity.continent;
  clues.push({ kind: "region", text: `It lies in ${region} and ${borders}.` });
  // Some languages share the country's name (Tuvaluan "Tuvalu", Nauruan "Nauru"); those would give it away.
  const languages = entity.officialLanguages.filter((language) => !namesCountry(language, entity)).slice(0, 3).join(", ");
  const currency = entity.currencies[0] && !namesCountry(entity.currencies[0].name, entity) ? entity.currencies[0].name : null;
  clues.push({ kind: "language", text: [languages && `Official languages include ${languages}.`, currency && `People pay with the ${currency}.`].filter(Boolean).join(" ") || `It is part of ${entity.continent}.` });
  const capital = entity.capitalCities[0];
  clues.push({ kind: "capital", text: capital ? `This is its flag, and its capital starts with “${capital[0]}”.` : "This is its flag.", flagAsset: entity.flagAsset });
  return clues;
}

export function generateGuessCountryQuestions(options: { entities: GeographicEntity[]; extras: AtlasExtras; datasetVersion: string; seed: string; difficulty: AtlasDifficulty; count: number }): GuessCountryQuestion[] {
  const pool = entitiesForDifficulty(entitiesForScope(options.entities, "un195"), options.difficulty).filter((entity) => entity.population && entity.flagAsset);
  const order = shuffled(pool, seededRandom(`${options.datasetVersion}:${options.seed}:${options.difficulty}:guess`));
  return Array.from({ length: options.count }, (_, index) => {
    const entity = order[index % order.length];
    return { id: `${options.seed}:guess:${index}`, seed: options.seed, entityId: entity.id, entityType: entity.entityType, category: "clues", interaction: "guess_country", difficulty: options.difficulty, scope: "un195", prompt: "Which country is it?", answer: entity.id, clues: countryClues(entity, options.extras), sourceMetadata: [] };
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
