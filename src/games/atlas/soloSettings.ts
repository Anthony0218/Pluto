import { DEFAULT_COMPARISON_STATS, MAP_BATTLE_CATEGORIES } from "./categories.ts";
import type { ArenaModeDef } from "./modeCatalog.ts";
import type { MapFillState } from "./rules.ts";
import type { FillScope } from "./scopes.ts";
import type { AtlasCategory, AtlasDifficulty, AtlasStatKey } from "./types.ts";

/** What a player chooses before a map or quiz run. Difficulty is shared by every mode; the rest only where the mode asks. */
export type SoloSettings = { difficulty: AtlasDifficulty; categories: AtlasCategory[]; stats: AtlasStatKey[]; scope: FillScope };
export const DEFAULT_SOLO_SETTINGS: SoloSettings = { difficulty: "intermediate", categories: MAP_BATTLE_CATEGORIES.map(({ id }) => id), stats: DEFAULT_COMPARISON_STATS, scope: "World" };
export type SoloSummary = {
  score: number; correct: number; wrong: number; bestStreak: number; elapsedMs: number; missed: string[];
  fill?: MapFillState; averageKm?: number;
};
export const DIFFICULTY_LABELS: Record<AtlasDifficulty, string> = { beginner: "Beginner", intermediate: "Explorer", expert: "Expert" };
export const settingsReady = (mode: ArenaModeDef, settings: SoloSettings) =>
  !(mode.options.includes("categories") && !settings.categories.length) && !(mode.options.includes("stats") && !settings.stats.length);
/** Player colours shared by the map pins, turn chips and scoreboards. */
export const PLAYER_COLORS = ["#3196d3", "#be5ad4", "#f5c66c", "#4ade80"];
