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
  const categories = options.mode === "map_battle" ? ["locations" as const] : options.categories ?? ["locations", "countries", "capitals"];
  const questions = generateQuestions({ ...options,
    entities: options.mode === "closest_wins" ? options.entities.filter((entity) => entity.centroid) : options.entities,
    categories, interaction: "map_click",
  });
  if (options.mode !== "closest_wins") return questions;
  return questions.map((question) => {
    if (question.interaction !== "map_click" || !question.targetCoordinates) throw new Error("Closest Wins requires a point target.");
    const city = question.category === "capitals" && options.entities.find((entity) => entity.id === question.entityId)?.capitalCoordinates;
    const capital = city && options.entities.find((entity) => entity.id === question.entityId)?.capitalCities[0];
    const point = city || question.targetCoordinates;
    return { ...question, prompt: capital ? `Drop a pin in ${capital}.` : question.prompt,
      interaction: "closest_click", answer: point, targetCoordinates: point,
      targetGeometryId: capital ? null : question.targetGeometryId, targetRadiusKm: capital ? 20 : undefined };
  });
}
