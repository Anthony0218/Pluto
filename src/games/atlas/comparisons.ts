import { STAT_DEFINITIONS } from "./config.ts";
import { entitiesForDifficulty, entitiesForScope, normalizedContinent } from "./engine.ts";
import { seededRandom, shuffled } from "./random.ts";
import type { AtlasDifficulty, AtlasExtras, AtlasStatKey, ComparableKind, GeographicEntity, HigherLowerQuestion } from "./types.ts";

type StatValue = { value: number; year?: number; source: string; note?: string };
/** Anything the Higher or Lower mode can put on a card: a country, a city, a continent or a UN subregion. */
export type Comparable = { id: string; label: string; kind: ComparableKind; detail?: string; stats: Partial<Record<AtlasStatKey, StatValue>> };

const KIND_STATS: Record<ComparableKind, AtlasStatKey[]> = {
  country: ["population", "areaKm2", "highestPointM", "neighborCount", "officialLanguageCount"],
  city: ["population", "elevationM"],
  continent: ["population", "areaKm2", "highestPointM", "countryCount"],
  subregion: ["population", "areaKm2", "highestPointM", "countryCount"],
};
const KIND_WEIGHTS: [ComparableKind, number][] = [["country", 45], ["city", 25], ["subregion", 18], ["continent", 12]];
/** Values closer than this share of the larger one are never paired, so rounding or survey differences cannot flip an answer. */
const MIN_GAP: Record<AtlasDifficulty, number> = { beginner: .3, intermediate: .12, expert: .05 };
const CITY_POOL: Record<AtlasDifficulty, number> = { beginner: 50, intermediate: 110, expert: Infinity };

export function buildComparables(entities: GeographicEntity[], extras: AtlasExtras, difficulty: AtlasDifficulty): Comparable[] {
  const countries = entitiesForScope(entities, "un195");
  const summit = (entity: GeographicEntity): StatValue | undefined => {
    const point = extras.highestPoints[entity.id];
    return point ? { value: point.elevationM, source: "Wikidata", note: point.name } : undefined;
  };
  const country = (entity: GeographicEntity): Comparable => ({
    id: entity.id, label: entity.shortName, kind: "country", detail: normalizedContinent(entity),
    stats: {
      population: entity.population ? { value: entity.population.value, year: entity.population.year, source: entity.population.source } : undefined,
      areaKm2: entity.areaKm2 ? { value: entity.areaKm2.value, year: entity.areaKm2.year, source: entity.areaKm2.source } : undefined,
      highestPointM: summit(entity),
      neighborCount: { value: entity.neighbors.length, source: "GeoNames" },
      officialLanguageCount: entity.officialLanguages.length ? { value: entity.officialLanguages.length, source: "GeoNames" } : undefined,
    },
  });
  const group = (kind: "continent" | "subregion", key: (entity: GeographicEntity) => string): Comparable[] => {
    const groups = new Map<string, GeographicEntity[]>();
    for (const entity of countries) if (key(entity) && key(entity) !== "Other") groups.set(key(entity), [...(groups.get(key(entity)) || []), entity]);
    return [...groups].map(([name, members]) => {
      const peak = members.map((member) => ({ member, point: extras.highestPoints[member.id] })).filter((item) => item.point).sort((left, right) => right.point.elevationM - left.point.elevationM)[0];
      return {
        id: `${kind}:${name}`, label: name, kind, detail: kind === "subregion" ? normalizedContinent(members[0]) : undefined,
        stats: {
          population: { value: members.reduce((sum, member) => sum + (member.population?.value || 0), 0), source: "World Bank (sum of UN members)" },
          areaKm2: { value: members.reduce((sum, member) => sum + (member.areaKm2?.value || 0), 0), source: "World Bank (sum of UN members)" },
          highestPointM: peak ? { value: peak.point.elevationM, source: "Wikidata", note: `${peak.point.name}, ${peak.member.shortName}` } : undefined,
          countryCount: { value: members.length, source: "UN M49" },
        },
      };
    });
  };
  const byId = new Map(countries.map((entity) => [entity.id, entity]));
  const cities = extras.cities.slice(0, CITY_POOL[difficulty]).filter((city) => byId.has(city.countryId)).map((city): Comparable => ({
    id: city.id, label: city.name, kind: "city", detail: byId.get(city.countryId)!.shortName,
    stats: { population: { value: city.population, source: "GeoNames" }, elevationM: city.elevationM === null ? undefined : { value: city.elevationM, source: "GeoNames" } },
  }));
  return [
    ...entitiesForDifficulty(countries, difficulty).map(country),
    ...cities,
    ...group("continent", normalizedContinent),
    ...group("subregion", (entity) => entity.subregion),
  ];
}

/**
 * Higher or Lower across countries, cities, continents and subregions. With `chain`, each answer's subject
 * becomes the next reference card (classic streak play) for a few rounds before the subject type or stat changes.
 */
export function generateComparisonQuestions(options: { entities: GeographicEntity[]; extras: AtlasExtras; datasetVersion: string; seed: string; difficulty: AtlasDifficulty; count: number; chain?: boolean; stats?: AtlasStatKey[] }): HigherLowerQuestion[] {
  const items = buildComparables(options.entities, options.extras, options.difficulty);
  const random = seededRandom(`${options.datasetVersion}:${options.seed}:${options.difficulty}:comparisons`);
  const gap = MIN_GAP[options.difficulty];
  const questions: HigherLowerQuestion[] = [];
  const kindStats = (kind: ComparableKind) => KIND_STATS[kind].filter((key) => !options.stats || options.stats.includes(key));
  const kinds = KIND_WEIGHTS.filter(([kind]) => kindStats(kind).length > 0);
  if (!kinds.length) throw new Error("Select at least one comparison category.");
  const schedule=shuffled(kinds.flatMap(([kind,weight])=>Array.from({length:Math.round(weight/10)},()=>kind)),random);
  let kindIndex=0;
  let current: Comparable | null = null, stat: AtlasStatKey = "population", segment = 0;
  const recent: string[] = [];
  // Only five continents exist, so they are exempt from the no-repeat window.
  const fresh = (item: Comparable) => item.kind === "continent" || !recent.includes(item.id);
  for (let attempt = 0; questions.length < options.count && attempt < options.count * 40; attempt += 1) {
    if (!current || segment <= 0 || !options.chain) {
      const kind = schedule[kindIndex++ % schedule.length];
      const stats = kindStats(kind);
      stat = stats[Math.floor(random() * stats.length)];
      const pool = items.filter((item) => item.kind === kind && item.stats[stat] && fresh(item));
      if (pool.length < 2) continue;
      current = pool[Math.floor(random() * pool.length)];
      segment = options.chain ? 3 + Math.floor(random() * 3) : 1;
    }
    const reference: Comparable = current, value = reference.stats[stat]!.value;
    const candidates = items.filter((item) => item.kind === reference.kind && item.id !== reference.id && fresh(item) && item.stats[stat]
      && Math.abs(item.stats[stat]!.value - value) >= gap * Math.max(Math.abs(item.stats[stat]!.value), Math.abs(value), 1));
    if (!candidates.length) { segment = 0; continue; }
    const maxGap = options.difficulty === "expert" ? .35 : options.difficulty === "intermediate" ? .65 : 1;
    const calibrated = candidates.filter(item => Math.abs(item.stats[stat]!.value - value) / Math.max(Math.abs(item.stats[stat]!.value), Math.abs(value), 1) <= maxGap);
    if (options.difficulty === "expert" && !calibrated.length) { segment = 0; continue; }
    const selection = calibrated.length ? calibrated : candidates;
    const next = selection[Math.floor(random() * selection.length)];
    const first = reference.stats[stat]!, second = next.stats[stat]!;
    questions.push({
      id: `${options.seed}:compare:${questions.length}`, seed: options.seed, entityId: next.id,
      entityType: next.kind === "subregion" ? "region" : next.kind, category: stat === "population" ? "population" : stat === "areaKm2" ? "area" : stat === "officialLanguageCount" ? "languages" : stat === "neighborCount" ? "borders" : "statistics",
      interaction: "higher_lower", difficulty: options.difficulty, scope: "un195",
      prompt: ["countryCount", "officialLanguageCount", "neighborCount"].includes(stat)
        ? `Does ${next.label} have more or fewer ${STAT_DEFINITIONS[stat].label.toLowerCase()} than ${reference.label}?`
        : `Is ${next.label}'s ${STAT_DEFINITIONS[stat].label.toLowerCase()} higher or lower than ${reference.label}'s?`,
      answer: second.value > first.value ? "higher" : "lower", comparisonEntityId: reference.id,
      stat: { key: stat, label: STAT_DEFINITIONS[stat].label, firstValue: first.value, secondValue: second.value, year: second.year, unit: STAT_DEFINITIONS[stat].unit },
      first: { label: reference.label, kind: reference.kind, detail: reference.detail, note: first.note },
      second: { label: next.label, kind: next.kind, detail: next.detail, note: second.note },
      sourceMetadata: [{ source: second.source, year: second.year }],
    });
    recent.push(reference.id); if (recent.length > 12) recent.shift();
    current = next; segment -= 1;
  }
  return questions;
}
