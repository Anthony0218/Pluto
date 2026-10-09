import { entitiesForDifficulty, entitiesForScope, plausibleEntities, sourceMetadata } from "./engine.ts";
import { seededRandom, shuffled } from "./random.ts";
import type { AtlasDifficulty, ChoiceQuestion, GeographicEntity } from "./types.ts";

export const FLAG_CHOICES = 4;
const OPTION_IDS = ["a", "b", "c", "d"] as const;

/**
 * Alternates two flag drills: identify the country behind a flag (four names), then pick the flag of a
 * country shown on its own as a silhouette (four flags). Flag options use opaque ids so neither the
 * label nor the id reveals the answer.
 */
export function generateFlagQuestions(options: { entities: GeographicEntity[]; datasetVersion: string; seed: string; difficulty: AtlasDifficulty; count: number }): ChoiceQuestion[] {
  const pool = entitiesForScope(options.entities, "un195").filter((entity) => entity.flagAsset);
  const eligible = entitiesForDifficulty(pool, options.difficulty);
  const random = seededRandom(`${options.datasetVersion}:${options.seed}:${options.difficulty}:flags`);
  const order = shuffled(eligible, random);
  const questions: ChoiceQuestion[] = [];
  const recent: string[] = [];
  if (!order.length) return questions;
  for (let index = 0; index < options.count; index += 1) {
    const offset = index % order.length;
    const candidates = [...order.slice(offset), ...order.slice(0, offset)];
    const showShape = index % 2 === 1;
    const available = candidates.filter(candidate => !recent.includes(candidate.id));
    const entity = (showShape ? available.find(candidate => candidate.geometryId) : available[0]) || available[0];
    if (!entity) throw new Error("Flag Battle needs at least eleven eligible countries for varied rounds.");
    recent.push(entity.id);
    if (recent.length > 10) recent.shift();
    const distractors = shuffled(plausibleEntities(entity, pool, options.difficulty, 8), random).slice(0, FLAG_CHOICES - 1);
    const entities = shuffled([entity, ...distractors], random);
    const base = { seed: options.seed, entityId: entity.id, entityType: entity.entityType, category: "flags" as const, interaction: "single_choice" as const, difficulty: options.difficulty, scope: "un195" as const, targetGeometryId: entity.geometryId, sourceMetadata: sourceMetadata(entity, "flags") };
    if (showShape && entity.geometryId) {
      const choices = entities.map((candidate, choice) => ({ id: OPTION_IDS[choice], label: `Flag ${OPTION_IDS[choice].toUpperCase()}`, flagAsset: candidate.flagAsset }));
      questions.push({ ...base, id: `${options.seed}:flag-shape:${index}`, prompt: `Which flag belongs to ${entity.shortName}?`, answer: OPTION_IDS[entities.indexOf(entity)], choices, promptShape: { geometryId: entity.geometryId, label: entity.shortName } });
    } else {
      questions.push({ ...base, id: `${options.seed}:flag-name:${index}`, prompt: "Which country does this flag belong to?", answer: entity.id, choices: entities.map((candidate) => ({ id: candidate.id, label: candidate.shortName })), promptFlagAsset: entity.flagAsset });
    }
  }
  return questions;
}
