import { STAT_DEFINITIONS } from "./config.ts";
import type { AtlasCategory, AtlasStatKey } from "./types.ts";

export const QUESTION_CATEGORIES: { id: AtlasCategory; label: string }[] = [
  { id: "countries", label: "Countries" }, { id: "locations", label: "Locations" },
  { id: "capitals", label: "Capitals" }, { id: "flags", label: "Flags" },
  { id: "population", label: "Population" }, { id: "area", label: "Area" },
  { id: "continents", label: "Continents" }, { id: "languages", label: "Languages" },
  { id: "borders", label: "Borders" }, { id: "currency", label: "Currency" },
];
/** Map Battle is only about where a country is, so it offers no fact categories (population, area, language, ...); Guess the Country carries those as tips. */
export const MAP_BATTLE_CATEGORIES = QUESTION_CATEGORIES.filter(({ id }) => ["countries", "locations", "capitals", "flags"].includes(id));
export const COMPARISON_CATEGORIES = Object.entries(STAT_DEFINITIONS).map(([id, definition]) => ({ id: id as AtlasStatKey, label: definition.label }));
export const DEFAULT_COMPARISON_STATS = COMPARISON_CATEGORIES.map(({ id }) => id);
export const usesMapCategories = (mode: string) => ["map_battle", "closest_wins"].includes(mode);

/** Validate room settings once, so every participant gets the same supported categories. */
export function parseSelection<T extends string>(value: unknown, options: { id: T }[], defaults: T[]): T[] {
  if (value === undefined) return defaults;
  if (!Array.isArray(value) || !value.length || value.some((id) => !options.some((option) => option.id === id))) {
    throw new Error("Select at least one supported category.");
  }
  return [...new Set(value)] as T[];
}
