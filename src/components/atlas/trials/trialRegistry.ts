import { useMemo, type ComponentType } from "react";
import type { TrialKind } from "../../../games/atlas/modeCatalog";
import { buildTrialCountries } from "../../../games/atlas/trials/countryStats";
import type { AtlasDataset, AtlasDifficulty } from "../../../games/atlas/types";
import { CountryGuesserGame } from "./CountryGuesserGame";
import { ExtremeGeographyGame } from "./ExtremeGeographyGame";
import { HistoryBattleGame } from "./HistoryBattleGame";
import { LanguageGuesserGame } from "./LanguageGuesserGame";
import { RegionBuilderGame } from "./RegionBuilderGame";
import { StatBattleGame } from "./StatBattleGame";
import { StatDetectiveGame } from "./StatDetectiveGame";
import { StatRankingGame } from "./StatRankingGame";
import type { TrialModeProps } from "./TrialsUI";

/** Region Builder and Stat Battle always deal from every country; battle difficulty controls the opponent. */
export const TRIAL_GAMES: Record<TrialKind, { component: ComponentType<TrialModeProps>; fullPool?: boolean }> = {
  "country-guesser": { component: CountryGuesserGame },
  "stat-detective": { component: StatDetectiveGame },
  "region-builder": { component: RegionBuilderGame, fullPool: true },
  "stat-ranking": { component: StatRankingGame },
  "extreme-geography": { component: ExtremeGeographyGame },
  "language-guesser": { component: LanguageGuesserGame },
  "history-battle": { component: HistoryBattleGame },
  "stat-battle": { component: StatBattleGame, fullPool: true },
};

/** Countries at the chosen difficulty, every country, and a lookup over all of them. */
export function useTrialPools(data: AtlasDataset | null, difficulty: AtlasDifficulty) {
  return useMemo(() => {
    if (!data) return null;
    const full = buildTrialCountries(data.countries, data.extras, "expert");
    return { difficulty: difficulty === "expert" ? full : buildTrialCountries(data.countries, data.extras, difficulty), full, byId: new Map(full.map((country) => [country.id, country])) };
  }, [data, difficulty]);
}
