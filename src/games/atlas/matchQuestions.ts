import { generateComparisonQuestions } from "./comparisons.ts";
import { generateQuestions } from "./engine.ts";
import { generateFlagQuestions } from "./flags.ts";
import { generateGuessCountryQuestions } from "./guessCountry.ts";
import type { AtlasRoundMode } from "./multiplayer.ts";
import type { AtlasCategory, AtlasDifficulty, AtlasExtras, AtlasQuestion, AtlasStatKey, GeographicEntity } from "./types.ts";

export function generateMatchQuestions(options: {
  entities: GeographicEntity[]; extras: AtlasExtras; datasetVersion: string; seed: string;
  difficulty: AtlasDifficulty; count: number; mode: AtlasRoundMode;
  categories?: AtlasCategory[]; stats?: AtlasStatKey[];
}): AtlasQuestion[] {
  if (options.mode === "higher_lower") return generateComparisonQuestions(options);
  if (options.mode === "flag_battle") return generateFlagQuestions(options);
  if (options.mode === "guess_country") return generateGuessCountryQuestions(options);
  const categories: AtlasCategory[] = options.categories?.length ? options.categories : ["locations", "countries", "capitals"];
  const questions = generateQuestions({ ...options,
    entities: ["closest_wins", "map_battle"].includes(options.mode) ? options.entities.filter((entity) => entity.centroid) : options.entities,
    categories, interaction: "map_click",
  });
  if (options.mode !== "closest_wins" && options.mode !== "map_battle") return questions;
  return questions.map((question, index) => {
    if (options.mode === "map_battle" && index % 2 === 0) return question;
    if (question.interaction !== "map_click" || !question.targetCoordinates) throw new Error("Map Battle requires a point target.");
    const city = question.category === "capitals" && options.entities.find((entity) => entity.id === question.entityId)?.capitalCoordinates;
    const capital = city && options.entities.find((entity) => entity.id === question.entityId)?.capitalCities[0];
    const point = city || question.targetCoordinates;
    return { ...question, prompt: capital ? `Drop a pin in ${capital}.` : question.flagAsset ? "Place a pin inside the country represented by this flag." : question.prompt.replace(/^Find |^Where is /, "Drop a pin near "),
      interaction: "closest_click", answer: point, targetCoordinates: point,
      targetGeometryId: capital ? null : question.targetGeometryId, targetRadiusKm: capital ? 20 : undefined };
  });
}
