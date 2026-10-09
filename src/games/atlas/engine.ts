import { DIFFICULTY_RULES, STAT_DEFINITIONS } from "./config.ts";
import { seededRandom, shuffled } from "./random.ts";
import type { AtlasCategory, AtlasDifficulty, AtlasQuestion, AtlasScope, AtlasStatKey, ChoiceQuestion, GeographicEntity, HigherLowerQuestion, MapClickQuestion, MultiSelectQuestion } from "./types.ts";

export const normalizedContinent = (entity: GeographicEntity) => entity.subregion === "South America" ? "South America" : entity.continent;

export function entitiesForScope(entities: GeographicEntity[], scope: AtlasScope): GeographicEntity[] {
  if (scope === "un195") return entities.filter((entity) => entity.playable && entity.status === "un195");
  if (scope === "territories") return entities.filter((entity) => entity.status === "territory");
  return entities.filter((entity) => entity.geometryId || entity.centroid);
}

export function entitiesForDifficulty(entities: GeographicEntity[], difficulty: AtlasDifficulty): GeographicEntity[] {
  if (difficulty === "expert") return entities;
  const rules = DIFFICULTY_RULES[difficulty];
  return entities.filter((entity) => (entity.population?.value || 0) >= rules.minimumPopulation || (entity.areaKm2?.value || 0) >= rules.minimumArea);
}

export function sourceMetadata(entity: GeographicEntity, category?: AtlasCategory) {
  const metadata: { source: string; year?: number }[] = [];
  if (entity.population && (!category || category === "population")) metadata.push({ source: entity.population.source, year: entity.population.year });
  if (entity.areaKm2 && (!category || category === "area")) metadata.push({ source: entity.areaKm2.source, year: entity.areaKm2.year });
  for (const source of entity.sources) if (source !== "World Bank" && !metadata.some((item) => item.source === source)) metadata.push({ source });
  return metadata;
}

export function plausibleEntities(target: GeographicEntity, pool: GeographicEntity[], difficulty: AtlasDifficulty, count: number, value?: (entity: GeographicEntity) => number): GeographicEntity[] {
  return pool.filter((entity) => entity.id !== target.id).sort((left, right) => {
    const continentPenalty = DIFFICULTY_RULES[difficulty].sameContinentDistractors
      ? Number(normalizedContinent(right) === normalizedContinent(target)) - Number(normalizedContinent(left) === normalizedContinent(target))
      : Number(normalizedContinent(left) === normalizedContinent(target)) - Number(normalizedContinent(right) === normalizedContinent(target));
    if (continentPenalty) return continentPenalty;
    if (value) return Math.abs(value(left) - value(target)) - Math.abs(value(right) - value(target));
    return left.shortName.localeCompare(right.shortName);
  }).slice(0, count);
}

const mapPrompt = (entity: GeographicEntity, category: AtlasCategory) => {
  if (category === "capitals" && entity.capitalCities[0]) return `Find the country whose capital is ${entity.capitalCities[0]}.`;
  if (category === "flags") return "Find the country represented by this flag.";
  // Locating a country is only about where it is: no population, area, language, border or currency facts in the prompt.
  return category === "locations" ? `Where is ${entity.shortName}?` : `Find ${entity.shortName} on the map.`;
};

function makeMapQuestion(entity: GeographicEntity, category: AtlasCategory, difficulty: AtlasDifficulty, scope: AtlasScope, seed: string, index: number): MapClickQuestion {
  return {
    id: `${seed}:map:${index}`, seed, entityId: entity.id, entityType: entity.entityType,
    category, interaction: "map_click", difficulty, scope,
    prompt: mapPrompt(entity, category), answer: entity.id, targetGeometryId: entity.geometryId,
    targetCoordinates: entity.centroid, flagAsset: category === "flags" ? entity.flagAsset : null,
    sourceMetadata: sourceMetadata(entity, category),
  };
}

const propertyLabel = (entity: GeographicEntity, category: AtlasCategory) => {
  if (category === "capitals") return entity.capitalCities[0];
  if (category === "continents") return normalizedContinent(entity);
  if (category === "languages") return entity.officialLanguages[0];
  if (category === "currency") return entity.currencies[0]?.name;
  if (category === "flags") return entity.id;
  return entity.shortName;
};

export function makeChoiceQuestion(entity: GeographicEntity, category: AtlasCategory, pool: GeographicEntity[], difficulty: AtlasDifficulty, scope: AtlasScope, seed: string, index: number): ChoiceQuestion | MultiSelectQuestion | HigherLowerQuestion {
  const random = seededRandom(`${seed}:${index}:${category}`);
  if (category === "population" || category === "area") {
    const key: AtlasStatKey = category === "population" ? "population" : "areaKm2";
    const available = pool.filter((candidate) => candidate[key] && candidate.id !== entity.id && candidate[key]?.value !== entity[key]?.value);
    const candidates = plausibleEntities(entity, available, difficulty, 3, (candidate) => candidate[key]?.value || 0);
    const comparison = candidates[Math.floor(random() * candidates.length)];
    const firstValue = entity[key]?.value || 0, secondValue = comparison[key]?.value || 0;
    return {
      id: `${seed}:higher-lower:${index}`, seed, entityId: comparison.id, entityType: comparison.entityType,
      category, interaction: "higher_lower", difficulty, scope,
      prompt: `Is ${comparison.shortName}'s ${STAT_DEFINITIONS[key].label.toLowerCase()} higher or lower than ${entity.shortName}'s?`,
      answer: secondValue > firstValue ? "higher" : "lower", comparisonEntityId: entity.id,
      first: { label: entity.shortName, kind: "country" },
      second: { label: comparison.shortName, kind: "country" },
      stat: { key, label: STAT_DEFINITIONS[key].label, firstValue, secondValue, year: comparison[key]?.year, unit: STAT_DEFINITIONS[key].unit },
      sourceMetadata: sourceMetadata(comparison, category),
    };
  }
  if (category === "borders" && entity.neighbors.length) {
    const correct = entity.neighbors.filter((id) => pool.some((candidate) => candidate.id === id));
    const wrong = plausibleEntities(entity, pool.filter((candidate) => !correct.includes(candidate.id)), difficulty, Math.max(2, 6 - correct.length));
    const choices = shuffled([...correct.map((id) => pool.find((candidate) => candidate.id === id)!).filter(Boolean), ...wrong], random).slice(0, 6);
    return { id: `${seed}:borders:${index}`, seed, entityId: entity.id, entityType: entity.entityType, category, interaction: "multi_select", difficulty, scope, prompt: `Select every country shown that borders ${entity.shortName}.`, answer: choices.filter((choice) => correct.includes(choice.id)).map((choice) => choice.id), choices: choices.map((choice) => ({ id: choice.id, label: choice.shortName })), sourceMetadata: [] };
  }
  const count = DIFFICULTY_RULES[difficulty].choiceCount;
  const valid = pool.filter((candidate) => propertyLabel(candidate, category));
  const distractors: GeographicEntity[] = [];
  const seenProperties = new Set([propertyLabel(entity, category)]);
  for (const candidate of plausibleEntities(entity, valid, difficulty, valid.length)) {
    const property = propertyLabel(candidate, category);
    if (!property || seenProperties.has(property) || (category === "languages" && entity.officialLanguages.includes(property)) || (category === "currency" && entity.currencies.some(currency => currency.name === property))) continue;
    seenProperties.add(property); distractors.push(candidate);
    if (distractors.length >= count - 1) break;
  }
  const choiceEntities = shuffled([entity, ...distractors], random);
  const answerProperty = propertyLabel(entity, category) || entity.shortName;
  const prompt = category === "capitals" ? `What is the capital of ${entity.shortName}?`
    : category === "continents" ? `Which continent contains ${entity.shortName}?`
      : category === "languages" ? `Which language is used in ${entity.shortName}?`
        : category === "currency" ? `Which currency is used in ${entity.shortName}?`
          : category === "flags" ? `Which flag belongs to ${entity.shortName}?`
            : category === "countries" || category === "locations" ? `Which country has ${entity.capitalCities[0] || "this capital"} as its capital?` : `Which country is ${entity.shortName}?`;
  const rawChoices = category === "continents"
    ? shuffled([...new Set([normalizedContinent(entity), ...distractors.map(normalizedContinent)])].slice(0, count), random).map((label) => ({ id: label, label }))
    : choiceEntities.map((candidate) => ({ id: propertyLabel(candidate, category) || candidate.id, label: propertyLabel(candidate, category) || candidate.shortName, flagAsset: category === "flags" ? candidate.flagAsset : undefined }));
  if(category === "flags") {
    const answer=`option:${choiceEntities.findIndex(candidate=>candidate.id===entity.id)}`;
    return {id:`${seed}:choice:${index}`,seed,entityId:entity.id,entityType:entity.entityType,category,interaction:"single_choice",difficulty,scope,prompt,answer,choices:choiceEntities.map((candidate,i)=>({id:`option:${i}`,label:`Flag ${i+1}`,flagAsset:candidate.flagAsset})),sourceMetadata:sourceMetadata(entity,category)};
  }
  return { id: `${seed}:choice:${index}`, seed, entityId: entity.id, entityType: entity.entityType, category, interaction: "single_choice", difficulty, scope, prompt, answer: answerProperty, choices: rawChoices, targetGeometryId: entity.geometryId, sourceMetadata: sourceMetadata(entity, category) };
}

export function generateQuestions(options: { entities: GeographicEntity[]; datasetVersion: string; seed: string; difficulty: AtlasDifficulty; scope?: AtlasScope; categories: AtlasCategory[]; interaction?: "map_click" | "mixed" | "choice"; count: number }): AtlasQuestion[] {
  const scope = options.scope || "un195";
  const scoped = entitiesForScope(options.entities, scope);
  const eligible = entitiesForDifficulty(scoped, options.difficulty).filter((entity) => entity.geometryId || entity.centroid);
  const random = seededRandom(`${options.datasetVersion}:${options.seed}:${options.difficulty}:${scope}:${options.categories.join(",")}`);
  const order = shuffled(eligible, random);
  const categories = shuffled(options.categories.length ? options.categories : ["countries" as const], random);
  if (!order.length) return [];
  const used = new Set<string>();
  const questions: AtlasQuestion[] = [];
  for (let index = 0; index < options.count; index += 1) {
    const entity = order[index % order.length];
    const category = categories[index % categories.length];
    const isCompatible = (candidate: GeographicEntity) => ["capitals", "countries", "locations"].includes(category) ? candidate.capitalCities.length > 0
      : category === "languages" ? candidate.officialLanguages.length > 0
        : category === "currency" ? candidate.currencies.length > 0
          : category === "population" ? Boolean(candidate.population)
            : category === "area" ? Boolean(candidate.areaKm2)
              : category === "borders" ? candidate.neighbors.length > 0 : true;
    const candidates = [...order.slice(index % order.length), ...order.slice(0, index % order.length)];
    const target = candidates.find(candidate => isCompatible(candidate) && !used.has(candidate.id)) || candidates.find(isCompatible) || entity;
    used.add(target.id);
    if (used.size >= order.length) used.clear();
    questions.push(options.interaction === "map_click" || (options.interaction === "mixed" && category === "locations")
      ? makeMapQuestion(target, category, options.difficulty, scope, options.seed, index)
      : makeChoiceQuestion(target, category, scoped, options.difficulty, scope, options.seed, index));
  }
  return questions;
}

export function generateHigherLowerQuestions(options: { entities: GeographicEntity[]; datasetVersion: string; seed: string; difficulty: AtlasDifficulty; scope?: AtlasScope; stats: AtlasStatKey[]; count: number }): HigherLowerQuestion[] {
  const scope = options.scope || "un195";
  const pool = entitiesForDifficulty(entitiesForScope(options.entities, scope), options.difficulty);
  const random = seededRandom(`${options.datasetVersion}:${options.seed}:${options.difficulty}:${scope}:${options.stats.join(",")}`);
  const order = shuffled(pool, random);
  const questions: HigherLowerQuestion[] = [];
  for (let index = 0; index < options.count; index += 1) {
    const stat = options.stats[index % options.stats.length];
    const available = order.filter((entity) => statValue(entity, stat) !== null);
    const first = available[index % available.length];
    const candidates = plausibleEntities(first, available.filter(entity=>statValue(entity,stat)!==statValue(first,stat)), options.difficulty, available.length, (entity) => statValue(entity, stat) || 0);
    if(!candidates.length)continue;
    const second = candidates[Math.floor(random() * Math.min(4, candidates.length))] || candidates[0];
    const firstValue = statValue(first, stat) || 0, secondValue = statValue(second, stat) || 0;
    const category: AtlasCategory = stat === "population" ? "population" : stat === "areaKm2" ? "area" : stat === "neighborCount" ? "borders" : "languages";
    const sourced = stat === "population" ? second.population : stat === "areaKm2" ? second.areaKm2 : null;
    questions.push({
      id: `${options.seed}:stat:${stat}:${index}`, seed: options.seed, entityId: second.id, entityType: second.entityType,
      category, interaction: "higher_lower", difficulty: options.difficulty, scope,
      prompt: `Is ${second.shortName}'s ${STAT_DEFINITIONS[stat].label.toLowerCase()} higher or lower than ${first.shortName}'s?`,
      answer: secondValue > firstValue ? "higher" : "lower", comparisonEntityId: first.id,
      stat: { key: stat, label: STAT_DEFINITIONS[stat].label, firstValue, secondValue, year: sourced?.year, unit: STAT_DEFINITIONS[stat].unit },
      sourceMetadata: sourced ? [{ source: sourced.source, year: sourced.year }] : [],
    });
  }
  return questions;
}

export function validateAnswer(question: AtlasQuestion, answer: string | string[]): boolean {
  if (question.interaction === "multi_select") {
    if (!Array.isArray(answer)) return false;
    return new Set(answer).size === answer.length && [...answer].sort().join("|") === [...question.answer].sort().join("|");
  }
  if (question.interaction === "closest_click") return false;
  return !Array.isArray(answer) && question.answer === answer;
}

export function statValue(entity: GeographicEntity, stat: AtlasStatKey): number | null {
  if (stat === "population" || stat === "areaKm2") return entity[stat]?.value ?? null;
  if (stat === "neighborCount") return entity.neighbors.length;
  if (stat === "officialLanguageCount") return entity.officialLanguages.length;
  return null;
}
