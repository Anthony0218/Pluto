import type { FillScope } from "../../../games/atlas/scopes";
import { useCallback, useState } from "react";
import { ArrowUpDown, Flag, Landmark, Languages, LayoutGrid, Lightbulb, ListOrdered, Map as MapIcon, MapPin, Mountain, ScanSearch, Swords, type LucideIcon } from "lucide-react";
import { bestKey, loadArenaStored, saveArenaStored, type ArenaStored } from "../../../games/atlas/arenaStorage";
import type { ArenaModeId } from "../../../games/atlas/modeCatalog";
import type { AtlasDifficulty } from "../../../games/atlas/types";

export const MODE_ICONS: Record<ArenaModeId, LucideIcon> = {
  "map-battle": MapPin, "higher-lower": ArrowUpDown, "guess-country": Lightbulb, "flag-battle": Flag,
  "stat-ranking": ListOrdered, "stat-battle": Swords, "region-builder": LayoutGrid, "stat-detective": ScanSearch,
  "extreme-geography": Mountain, "history-battle": Landmark, "map-fill": MapIcon,
  "language-guesser": Languages,
};

/** Difficulty, last solo settings and personal bests, kept in this browser. */
export function useArenaStore() {
  const [stored, setStored] = useState(loadArenaStored);
  const update = useCallback((patch: Partial<ArenaStored>) => setStored((current) => {
    const next = { ...current, ...patch };
    if (patch.difficulty) next.settings = { ...next.settings, difficulty: patch.difficulty };
    if (patch.settings) next.difficulty = patch.settings.difficulty;
    saveArenaStored(next);
    return next;
  }), []);
  const recordBest = useCallback((bestId: string, difficulty: AtlasDifficulty, score: number, scope?:FillScope) => setStored((current) => {
    const key = bestKey(bestId, difficulty, scope);
    if (score <= (current.best[key] ?? 0)) return current;
    const next = { ...current, best: { ...current.best, [key]: score } };
    saveArenaStored(next);
    return next;
  }), []);
  return { stored, update, recordBest };
}
