import { Registry } from "../content/registry.ts";
import type { Random } from "../engine/engine.ts";
import { log } from "../engine/events.ts";
import { pickWeighted } from "../engine/random.ts";
import type { BoardMap, Match } from "../types.ts";
import {
  avalanche,
  cableBreakdown,
  islandBreeze,
  mineCollapse,
  windfall,
  pirateTreasure, eruptionForecast, jungleBounty,
  calmWaters, coconutMarket, ruinsRelics,
} from "./definitions.ts";
import type { EventDefinition } from "./types.ts";

export const eventRegistry = new Registry<EventDefinition>();
for (const event of [islandBreeze, windfall, avalanche, mineCollapse, cableBreakdown, pirateTreasure, eruptionForecast, jungleBounty, calmWaters, coconutMarket, ruinsRelics])
  eventRegistry.register(event);

// Events the map's pool allows right now: listed in `eventPoolIds`, allowed on this map id, and runnable.
export function eligibleEvents(state: Match, map: BoardMap): EventDefinition[] {
  return map.eventPoolIds
    .map((id) => eventRegistry.get(id))
    .filter(
      (event) =>
        (!event.allowedMaps || event.allowedMaps.includes(map.id)) &&
        event.canRun(state, map),
    );
}

// Random Event field: the server picks a weighted eligible event. With a single candidate no random
// number is drawn, so a one-event pool behaves exactly like a fixed outcome.
export function runRandomEvent(
  state: Match,
  map: BoardMap,
  random: Random,
  playerId: string,
): EventDefinition | null {
  const candidates = eligibleEvents(state, map);
  if (!candidates.length) {
    log(state, "A quiet moment: nothing happens.");
    return null;
  }
  const chosen =
    candidates.length === 1
      ? candidates[0]
      : eventRegistry.get(
          pickWeighted(
            Object.fromEntries(candidates.map((e) => [e.id, e.weight])),
            random,
          ),
        );
  chosen.execute(state, { map, random, playerId });
  return chosen;
}
