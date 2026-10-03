import { DEFAULT_SOLO_SETTINGS, type SoloSettings } from "./soloSettings.ts";
import { isFillScope } from "./scopes.ts";
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
    const parsed = JSON.parse(window.localStorage.getItem(STORAGE_KEY) ?? "null") as Partial<ArenaStored> | null;
    if (!parsed || !DIFFICULTIES.includes(parsed.difficulty as AtlasDifficulty)) return fallback;
    const settings = { ...DEFAULT_SOLO_SETTINGS, ...parsed.settings, difficulty: parsed.difficulty as AtlasDifficulty };
    if (!isFillScope(settings.scope) || !Array.isArray(settings.categories) || !Array.isArray(settings.stats)) return { ...fallback, difficulty: parsed.difficulty as AtlasDifficulty, best: parsed.best ?? {} };
    return { difficulty: parsed.difficulty as AtlasDifficulty, best: parsed.best ?? {}, settings };
  } catch { return fallback; }
}
export function saveArenaStored(value: ArenaStored) { try { window.localStorage.setItem(STORAGE_KEY, JSON.stringify(value)); } catch { /* storage blocked */ } }
export const bestKey = (bestId: string, difficulty: AtlasDifficulty) => `${bestId}:${difficulty}`;
export const freshSeed = () => `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
