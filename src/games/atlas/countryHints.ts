import { phraseFor } from "./phrases.ts";
import { shuffled } from "./random.ts";
import type { Coordinates } from "./types.ts";

export type CountryHintKind = "region" | "population" | "geography" | "capital" | "language" | "currency" | "phrase" | "summit" | "density" | "location" | "name" | "temperature";
export type CountryHint = { kind: CountryHintKind; text: string };
export type CountryHintFacts = {
  name: string; otherNames?: string[]; continent: string; subregion: string;
  population?: number; areaKm2?: number; neighborCount: number;
  capital: string | null; capitalCoordinates?: Coordinates | null;
  officialLanguages: string[]; currencies?: { name: string }[];
  summitName?: string | null; highestPointM?: number; meanTempC?: number;
};

const grouped = (value: number) => new Intl.NumberFormat("en").format(Math.round(value));
const compact = (value: number) => new Intl.NumberFormat("en", { notation: "compact", maximumFractionDigits: 0 }).format(value);
function band(value: number, edges: number[], format: (value: number) => string, unit = "") {
  const upper = edges.findIndex(edge => value < edge);
  if (upper === 0) return `under ${format(edges[0])}${unit}`;
  if (upper === -1) return `at least ${format(edges[edges.length - 1])}${unit}`;
  return `between ${format(edges[upper - 1])} and ${format(edges[upper])}${unit}`;
}

/** Reject country names and revealing stems such as "Kenyan" or "Kinyarwanda". */
export function namesCountry(text: string, facts: Pick<CountryHintFacts, "name" | "otherNames">) {
  const words = [facts.name, ...(facts.otherNames ?? [])].flatMap(name => name.toLowerCase().split(/[^\p{L}]+/u)).filter(word => word.length >= 4);
  const lower = text.toLowerCase(), stems = words.map(word => word.slice(0, 4));
  return lower.includes(facts.name.toLowerCase()) || words.some(word => word.length >= 5 && lower.includes(word))
    || lower.split(/[^\p{L}]+/u).some(word => word.length >= 4 && stems.includes(word.slice(0, 4)));
}

/** One candidate per subject; missing facts produce no hint instead of a fabricated zero. */
export function countryHintCandidates(facts: CountryHintFacts): CountryHint[] {
  const clues: CountryHint[] = [];
  const add = (kind: CountryHintKind, text: string) => { if (!namesCountry(text, facts)) clues.push({ kind, text }); };
  const { population, areaKm2, capital, neighborCount } = facts;
  const rawRegion = facts.subregion === "Australia and New Zealand" ? "Australasia"
    : facts.subregion === "Micronesia" ? "the western Pacific islands" : facts.subregion || facts.continent;
  const region = namesCountry(rawRegion, facts) ? facts.continent : rawRegion;
  // Region and area remain together even when this hint is drawn later in a round.
  if (areaKm2 && areaKm2 > 0) add("region", `This country is in ${region} and covers ${band(areaKm2, [1_000, 10_000, 50_000, 100_000, 250_000, 500_000, 1_000_000, 3_000_000], grouped, " km²")}.`);
  if (population && population > 0) add("population", `Its population is ${band(population, [1e6, 5e6, 10e6, 25e6, 50e6, 100e6, 250e6], compact)} people.`);
  add("geography", neighborCount ? `It shares land borders with ${neighborCount} ${neighborCount === 1 ? "country" : "countries"}.` : "It has no land borders at all.");
  if (population && areaKm2 && areaKm2 > 0) add("density", `Its average population density is ${band(population / areaKm2, [10, 50, 100, 250, 500, 1_000], grouped)} people per square kilometre.`);
  if (facts.highestPointM !== undefined) {
    const summit = facts.summitName && !namesCountry(facts.summitName, facts) ? `${facts.summitName}, at ` : "";
    add("summit", `Its highest point is ${summit}${grouped(facts.highestPointM)} m above sea level.`);
  }
  const languages = facts.officialLanguages.filter(language => language.trim() && !/^[a-z]{2,3}$/.test(language) && !namesCountry(language, facts)).slice(0, 3);
  if (languages.length) add("language", `Official languages include ${languages.join(", ")}.`);
  const currency = facts.currencies?.find(item => !namesCountry(item.name, facts));
  if (currency) add("currency", `People pay with the ${currency.name}.`);
  const phrase = phraseFor(facts.officialLanguages);
  if (phrase) add("phrase", `Overheard on a street here: “${phrase}”`);
  if (capital) add("capital", `Its capital's name begins with “${capital[0]}” and has ${capital.replace(/[^\p{L}]/gu, "").length} letters.`);
  if (facts.capitalCoordinates) {
    const [longitude, latitude] = facts.capitalCoordinates;
    if (Number.isFinite(latitude) && Number.isFinite(longitude)) add("location", `Its capital lies ${latitude >= 0 ? "north" : "south"} of the Equator and ${longitude >= 0 ? "east" : "west"} of the prime meridian.`);
  }
  const letters = facts.name.replace(/[^\p{L}]/gu, "").length;
  const words = facts.name.trim().split(/\s+/).length;
  add("name", `Its common English name has ${letters} letters${words > 1 ? ` across ${words} words` : " in one word"}.`);
  if (facts.meanTempC !== undefined) add("temperature", `Its historical annual mean temperature (1995–2014) was ${facts.meanTempC.toFixed(2)} °C.`);
  return clues;
}

/** Stable for a shared round seed, varied between rounds. The decisive hint is appended by each mode. */
export function randomCountryHints(facts: CountryHintFacts, random: () => number): CountryHint[] {
  return shuffled(countryHintCandidates(facts), random).slice(0, 4);
}
