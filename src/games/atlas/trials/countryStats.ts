import { entitiesForDifficulty, entitiesForScope } from "../engine.ts";
import type { AtlasDifficulty, AtlasExtras, Coordinates, GeographicEntity } from "../types.ts";

/**
 * Normalized country model for the Atlas Trials modes. Every number here comes from the bundled Atlas snapshot
 * (World Bank, GeoNames, Wikidata and attributed country supplements); nothing is estimated. Stats a country lacks are simply absent, and every mode
 * filters on availability, so adding a new stat only needs a field below plus a STATS entry.
 */
export type TrialStatId = "population" | "areaKm2" | "density" | "neighborCount" | "highestPointM" | "meanTempC" | "capitalLatitude" | "capitalEquatorDistance";
export type TrialCountry = {
  id: string; iso3: string; name: string; flag: string;
  geometryId: string | null; officialLanguages: string[];
  otherNames?: string[]; currencies?: GeographicEntity["currencies"]; capitalCoordinates?: Coordinates | null;
  /** GeoNames files South America under "North America"; the UN subregion restores the everyday continent. */
  continent: string; subregion: string; capital: string | null; neighbors: string[];
  stats: Partial<Record<TrialStatId, number>>;
  summitName: string | null;
};
export type StatDirection = "highest" | "lowest";
export type StatDefinition = {
  id: TrialStatId; label: string; unit: string; source: string;
  /** Short noun phrases for extreme questions: "the largest population" / "the smallest population". */
  extremes: Record<StatDirection, string>;
  format: (value: number) => string;
  /** Which modes may use this stat. Integers with many ties (border counts) are kept out of rankings. */
  usableIn: { detective: boolean; ranking: boolean; extreme: boolean; battle: boolean };
};

const compact = (value: number) => new Intl.NumberFormat("en", { notation: "compact", maximumFractionDigits: value >= 1e9 ? 2 : 1 }).format(value);
const grouped = (value: number) => new Intl.NumberFormat("en").format(Math.round(value));

export const STATS: Record<TrialStatId, StatDefinition> = {
  population: {
    id: "population", label: "Population", unit: "people", source: "World Bank / Vatican City State",
    extremes: { highest: "the largest population", lowest: "the smallest population" },
    format: compact, usableIn: { detective: true, ranking: true, extreme: true, battle: true },
  },
  areaKm2: {
    id: "areaKm2", label: "Area", unit: "km²", source: "World Bank / Vatican City State",
    extremes: { highest: "the largest area", lowest: "the smallest area" },
    format: (value) => `${value >= 1e6 ? compact(value) : value < 1 ? value.toLocaleString("en", { maximumFractionDigits: 2 }) : grouped(value)} km²`, usableIn: { detective: true, ranking: true, extreme: true, battle: true },
  },
  density: {
    id: "density", label: "Population density", unit: "people/km²", source: "Bundled population ÷ area",
    extremes: { highest: "the highest population density", lowest: "the lowest population density" },
    format: (value) => `${value < 10 ? value.toFixed(1) : grouped(value)}/km²`, usableIn: { detective: true, ranking: true, extreme: false, battle: true },
  },
  neighborCount: {
    id: "neighborCount", label: "Land borders", unit: "countries", source: "GeoNames",
    extremes: { highest: "the most land borders", lowest: "the fewest land borders" },
    format: (value) => `${value} ${value === 1 ? "country" : "countries"}`, usableIn: { detective: true, ranking: false, extreme: false, battle: true },
  },
  highestPointM: {
    id: "highestPointM", label: "Highest point", unit: "m", source: "Wikidata / The World Factbook",
    extremes: { highest: "the highest mountain peak", lowest: "the lowest highest point" },
    format: (value) => `${grouped(value)} m`, usableIn: { detective: true, ranking: true, extreme: true, battle: true },
  },
  capitalLatitude: {
    id: "capitalLatitude", label: "Capital latitude", unit: "°", source: "GeoNames capital coordinates",
    extremes: { highest: "the northernmost capital", lowest: "the southernmost capital" },
    format: value => `${Math.abs(value).toFixed(2)}° ${value >= 0 ? "N" : "S"}`,
    usableIn: { detective: false, ranking: false, extreme: true, battle: false },
  },
  capitalEquatorDistance: {
    id: "capitalEquatorDistance", label: "Capital distance from the equator", unit: "° latitude", source: "GeoNames capital coordinates",
    extremes: { highest: "the capital farthest from the equator", lowest: "the capital closest to the equator" },
    format: value => `${value.toFixed(2)}° from the equator`,
    usableIn: { detective: false, ranking: false, extreme: true, battle: false },
  },
  meanTempC: {
    id: "meanTempC", label: "Historical annual mean temperature", unit: "°C", source: "World Bank Climate Change Knowledge Portal, 1995–2014",
    extremes: { highest: "the warmest annual mean temperature (1995–2014)", lowest: "the coldest annual mean temperature (1995–2014)" },
    format: (value) => `${value.toFixed(2)} °C`, usableIn: { detective: false, ranking: false, extreme: true, battle: false },
  },
};
export const STAT_IDS = Object.keys(STATS) as TrialStatId[];

/** Historical country summaries published by the World Bank CCKP. A small, sourced climate deck. */
const HISTORICAL_MEAN_TEMP_C: Record<string, number> = {
  RUS: -3.60, SWE: 3.75, EST: 7.17, COL: 24.50, YEM: 25.40, GIN: 25.94,
};

export function getCountryStat(country: TrialCountry, statId: TrialStatId): number | null {
  return country.stats[statId] ?? null;
}
export function formatCountryStat(statId: TrialStatId, value: number | null): string {
  return value === null ? "—" : STATS[statId].format(value);
}
/** Positive when `a` wins the comparison, negative when `b` wins, 0 on a tie. */
export function compareCountryStats(a: TrialCountry, b: TrialCountry, statId: TrialStatId, direction: StatDirection = "highest"): number {
  const left = getCountryStat(a, statId), right = getCountryStat(b, statId);
  if (left === null || right === null) throw new Error(`Missing ${statId} for ${left === null ? a.name : b.name}.`);
  return direction === "highest" ? left - right : right - left;
}
export const hasStats = (country: TrialCountry, stats: TrialStatId[]) => stats.every((stat) => getCountryStat(country, stat) !== null);

export function toTrialCountry(entity: GeographicEntity, extras: AtlasExtras): TrialCountry {
  const population = entity.population?.value, area = entity.areaKm2?.value, summit = extras.highestPoints[entity.id];
  const stats: TrialCountry["stats"] = { neighborCount: entity.neighbors.length };
  if (entity.capitalCoordinates) {
    stats.capitalLatitude = entity.capitalCoordinates[1];
    stats.capitalEquatorDistance = Math.abs(entity.capitalCoordinates[1]);
  }
  if (population) stats.population = population;
  if (area) stats.areaKm2 = area;
  if (population && area) stats.density = population / area;
  if (summit) stats.highestPointM = summit.elevationM;
  if (HISTORICAL_MEAN_TEMP_C[entity.iso3] !== undefined) stats.meanTempC = HISTORICAL_MEAN_TEMP_C[entity.iso3];
  return {
    id: entity.id, iso3: entity.iso3, name: entity.shortName, flag: entity.flagAsset ?? "",
    geometryId: entity.geometryId, officialLanguages: entity.officialLanguages,
    otherNames: [entity.canonicalName, ...entity.aliases], currencies: entity.currencies, capitalCoordinates: entity.capitalCoordinates,
    continent: entity.subregion === "South America" ? "South America" : entity.continent,
    subregion: entity.subregion, capital: entity.capitalCities[0] ?? null, neighbors: entity.neighbors,
    stats, summitName: summit?.name ?? null,
  };
}

/** The 195-country scope (193 UN members plus Palestine and the Holy See), narrowed only by difficulty and required card data. */
export function buildTrialCountries(entities: GeographicEntity[], extras: AtlasExtras, difficulty: AtlasDifficulty = "expert"): TrialCountry[] {
  return entitiesForDifficulty(entitiesForScope(entities, "un195"), difficulty)
    .filter((entity) => entity.flagAsset && entity.population && entity.areaKm2)
    .map((entity) => toTrialCountry(entity, extras));
}

/** Draws `count` distinct items. Throws instead of silently returning fewer, so a round can never repeat a card. */
export function sampleUnique<T>(items: readonly T[], count: number, random: () => number): T[] {
  if (count > items.length) throw new Error(`Cannot draw ${count} unique items from ${items.length}.`);
  const copy = [...items];
  for (let index = 0; index < count; index += 1) {
    const swap = index + Math.floor(random() * (copy.length - index));
    [copy[index], copy[swap]] = [copy[swap], copy[index]];
  }
  return copy.slice(0, count);
}
export const pickOne = <T,>(items: readonly T[], random: () => number): T => items[Math.floor(random() * items.length)];

/**
 * Plausible wrong answers: the same subregion, continent, neighbors and a similar size score highest, then a
 * random draw from the best `spread × count` keeps rounds varied.
 */
export function generateDistractors(target: TrialCountry, pool: readonly TrialCountry[], count: number, random: () => number, spread = 2.5): TrialCountry[] {
  const log = (value?: number) => Math.log10(Math.max(1, value ?? 1));
  const similarity = (candidate: TrialCountry) =>
    (candidate.subregion === target.subregion ? 3 : 0) + (candidate.continent === target.continent ? 2.5 : 0)
    + (target.neighbors.includes(candidate.id) ? 1.5 : 0)
    - Math.abs(log(candidate.stats.population) - log(target.stats.population)) * .8
    - Math.abs(log(candidate.stats.areaKm2) - log(target.stats.areaKm2)) * .5
    + random() * .6;
  const ranked = pool.filter((candidate) => candidate.id !== target.id).map((candidate) => ({ candidate, score: similarity(candidate) }))
    .sort((left, right) => right.score - left.score).map(({ candidate }) => candidate);
  return sampleUnique(ranked.slice(0, Math.max(count, Math.ceil(count * spread))), count, random);
}

/** Relative difference of two values against the larger one; 1 when one side is 0. */
export const relativeGap = (left: number, right: number) => Math.abs(left - right) / Math.max(Math.abs(left), Math.abs(right), 1e-9);
