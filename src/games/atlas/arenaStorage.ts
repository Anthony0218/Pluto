import { DEFAULT_SOLO_SETTINGS, type SoloSettings } from "./soloSettings.ts";
import { isFillScope, type FillScope } from "./scopes.ts";
import { MAP_BATTLE_CATEGORIES, COMPARISON_CATEGORIES } from "./categories.ts";
import type { AtlasDifficulty } from "./types.ts";

/**
 * Per-viewer conveniences only (difficulty, last settings, personal bests). Blocked storage just means nothing is
 * remembered. The key is the one Atlas Trials used, so earlier personal bests carry over.
 */
const STORAGE_KEY = "atlas-trials:v1";
export type ArenaStored = { difficulty: AtlasDifficulty; best: Partial<Record<string, number>>; settings: SoloSettings };
const DIFFICULTIES: AtlasDifficulty[] = ["beginner", "intermediate", "expert"];

export function loadArenaStored(): ArenaStored {
  const fallback: ArenaStored = { difficulty: "intermediate", best: {}, settings: DEFAULT_SOLO_SETTINGS };
  try {
    const parsed = JSON.parse(window.localStorage.getItem(STORAGE_KEY) ?? "null") as (Partial<ArenaStored> & { categoryDefaultsVersion?: number }) | null;
    if (!parsed || !DIFFICULTIES.includes(parsed.difficulty as AtlasDifficulty)) return fallback;
    // The map region is never remembered: every new game starts on the whole world.
    const settings = { ...DEFAULT_SOLO_SETTINGS, ...parsed.settings, scope: DEFAULT_SOLO_SETTINGS.scope, difficulty: parsed.difficulty as AtlasDifficulty };
    if (!isFillScope(settings.scope) || !Array.isArray(settings.categories) || !Array.isArray(settings.stats)) return { ...fallback, difficulty: parsed.difficulty as AtlasDifficulty, best: Object.fromEntries(Object.entries(parsed.best??{}).filter(([,score])=>typeof score==="number"&&Number.isFinite(score))) };
    const oldDefaults = ["countries", "locations", "capitals", "flags"];
    if (parsed.categoryDefaultsVersion !== 2 && settings.categories.length === oldDefaults.length && oldDefaults.every(id => settings.categories.includes(id as typeof settings.categories[number]))) {
      settings.categories = [...DEFAULT_SOLO_SETTINGS.categories];
    }
    settings.categories=settings.categories.filter(id=>MAP_BATTLE_CATEGORIES.some(c=>c.id===id));
    if(!settings.categories.length)settings.categories=[...DEFAULT_SOLO_SETTINGS.categories];
    settings.stats=settings.stats.filter(id=>COMPARISON_CATEGORIES.some(c=>c.id===id));
    return { difficulty: parsed.difficulty as AtlasDifficulty, best: Object.fromEntries(Object.entries(parsed.best??{}).filter(([,score])=>typeof score==="number"&&Number.isFinite(score))), settings };
  } catch { return fallback; }
}
export function saveArenaStored(value: ArenaStored) { try { window.localStorage.setItem(STORAGE_KEY, JSON.stringify({ ...value, categoryDefaultsVersion: 2 })); } catch { /* storage blocked */ } }
// Keep earlier records in storage, but compare new runs only against the same scoring rules.
const revisedScores = new Set(["map-battle", "higher-lower", "guess-country", "flag-battle", "extreme-geography"]);
export const bestKey = (bestId: string, difficulty: AtlasDifficulty, scope?:FillScope) => `${bestId}:${difficulty}${scope?`:${scope}`:""}${revisedScores.has(bestId) ? ":knowledge-v2" : ""}`;
export const freshSeed = () => `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
