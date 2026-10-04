import { entitiesForScope, sourceMetadata } from "./engine.ts";
import { seededRandom, shuffled } from "./random.ts";
import type { AtlasQuestion, GeographicEntity } from "./types.ts";

export type ChallengeTier = "standard" | "master" | "grandmaster";
export const challengeTierFromRating = (rating: number): ChallengeTier => rating >= 2400 ? "grandmaster" : rating >= 2200 ? "master" : "standard";

/** Unique constraint solutions and applied ratios; advanced difficulty does not shrink the time to navigate. */
export function generateAdvancedQuestions(entities: GeographicEntity[], seed: string, count: number, tier: Exclude<ChallengeTier, "standard">, map = false): AtlasQuestion[] {
  const pool = entitiesForScope(entities, "un195"), random = seededRandom(`${seed}:${tier}:reasoning`);
  const result: AtlasQuestion[] = [];
  const candidates = shuffled(pool.filter(c => c.neighbors.length >= 2 && (!map || c.centroid)), random);
  for (const target of candidates) {
    const neighbors = shuffled(target.neighbors.map(id => pool.find(c => c.id === id)).filter((c): c is GeographicEntity => Boolean(c)), random);
    for (let i = 0; i < neighbors.length && result.length < count; i++) for (let j = i+1; j < neighbors.length && result.length < count; j++) {
      const a = neighbors[i], b = neighbors[j];
      const intersection = pool.filter(c => c.neighbors.includes(a.id) && c.neighbors.includes(b.id));
      const filtered = tier === "grandmaster" ? intersection.filter(c => c.subregion === target.subregion && c.neighbors.length === target.neighbors.length) : intersection;
      if (filtered.length !== 1 || filtered[0].id !== target.id) continue;
      const prompt = `Which country shares land borders with both ${a.shortName} and ${b.shortName}${tier === "grandmaster" ? `, lies in ${target.subregion}, and has ${target.neighbors.length} land neighbors` : ""}?`;
      const base = { id: `${seed}:reasoning:${result.length}`, seed, entityId: target.id, entityType: "country" as const, category: "borders" as const, difficulty: "expert" as const, scope: "un195" as const, prompt, sourceMetadata: sourceMetadata(target) };
      if (map) result.push({ ...base, interaction: "map_click", answer: target.id, targetCoordinates: target.centroid, targetGeometryId: target.geometryId });
      else {
        const wrong = shuffled(pool.filter(c => c.id !== target.id && (c.neighbors.includes(a.id) || c.neighbors.includes(b.id))), random).slice(0,3);
        if (wrong.length < 3) continue;
        const choices = shuffled([target,...wrong], random).map(c => ({ id: c.id, label: c.shortName }));
        result.push({ ...base, interaction: "single_choice", answer: target.id, choices });
      }
      // One target per run; subsequent questions apply a different concept.
      i = neighbors.length; break;
    }
    if (result.length >= count) break;
  }
  if (result.length < count) throw new Error("Insufficient unique advanced geography challenges.");
  return result;
}

/** Displayed, rounded figures are the actual operands, so the result remains independently checkable. */
export function generateDensityQuestion(entities: GeographicEntity[], seed: string, index: number, tier: ChallengeTier): AtlasQuestion {
  const random = seededRandom(`${seed}:density:${index}`);
  const pool = shuffled(entitiesForScope(entities,"un195").filter(c => c.population && c.areaKm2),random);
  const numbers = (c: GeographicEntity) => ({ population: Math.round(c.population!.value / 1000)*1000, area: Math.max(1, Math.round(c.areaKm2!.value)) });
  const density = (c: GeographicEntity) => { const n = numbers(c); return n.population/n.area; };
  const target = [...pool.slice(0,12)].sort((a,b)=>density(b)-density(a))[0], others = pool.slice(1).filter(c => density(c) < density(target)*.9);
  const sorted = others.sort((a,b) => density(b)-density(a));
  const wrong = (tier === "grandmaster" ? sorted : shuffled(sorted,random)).slice(0,3);
  if (wrong.length < 3) return generateDensityQuestion(entities,`${seed}:retry`,index,tier);
  const choices = shuffled([target,...wrong],random).map(c => { const n = numbers(c); return { id:c.id, label:`${c.shortName} · ${n.population.toLocaleString("en")} people / ${n.area.toLocaleString("en")} km²` }; });
  return { id:`${seed}:density:${index}`, seed, entityId:target.id, entityType:"country", category:"statistics", property:"density", difficulty:"expert", scope:"un195", prompt:"Using these figures, which country has the greatest population density? Compare people per km².", answer:target.id, interaction:"single_choice", choices, sourceMetadata:sourceMetadata(target) };
}
