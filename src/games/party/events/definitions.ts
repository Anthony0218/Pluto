import { AVALANCHE_CONFIG, TRANSPORT_OUTAGE_CONFIG } from "../config.ts";
import { emit } from "../engine/events.ts";
import { spaceNumber } from "../engine/graph.ts";
import { blockConnection, safeBlockableEdges } from "../engine/routes.ts";
import { disableTransport, transportOutage } from "../engine/transport.ts";
import type { BoardMap, Match } from "../types.ts";
import type { EventDefinition } from "./types.ts";

const everyoneGains = (state: Match, coins: number) =>
  state.players.forEach((p) => {
    p.coins += coins;
  });

// Tropical Islands: the original Random Event outcome (unchanged behaviour).
export const islandBreeze: EventDefinition = {
  id: "island-breeze",
  name: "Island Breeze",
  icon: "🌴",
  description: "A warm breeze: every player receives 2 coins.",
  weight: 1,
  allowedMaps: ["sunspill"],
  canRun: () => true,
  execute(state) {
    everyoneGains(state, 2);
    emit(state, { kind: "EVENT", text: "ISLAND BREEZE! EVERYONE RECEIVES 2 COINS" });
  },
};

// Generic: eligible on any map that lists it in its event pool.
export const windfall: EventDefinition = {
  id: "windfall",
  name: "Windfall",
  icon: "🍀",
  description: "A lucky find: every player receives 2 coins.",
  weight: 2,
  canRun: () => true,
  execute(state) {
    everyoneGains(state, 2);
    emit(state, { kind: "EVENT", text: "WINDFALL! EVERYONE RECEIVES 2 COINS" });
  },
};

// Mountain: closes one blockable connection for AVALANCHE_CONFIG.durationRounds. The server picks it and
// never chooses a closure that would leave part of the board unreachable (`safeBlockableEdges`).
export const avalanche: EventDefinition = {
  id: "avalanche",
  name: "Avalanche",
  icon: "🏔️",
  description: "Snow and rock close one mountain path for 2 rounds.",
  weight: 3,
  allowedMaps: ["mountain"],
  canRun: (state, map) => safeBlockableEdges(state, map).length > 0,
  execute(state, { map, random }) {
    const edges = safeBlockableEdges(state, map);
    if (!edges.length) return;
    const [from, to] = edges[Math.min(edges.length - 1, Math.floor(random() * edges.length))];
    blockConnection(state, from, to, "avalanche");
    emit(state, {
      kind: "AVALANCHE",
      nodeId: from,
      text: `🏔️ AVALANCHE! THE PATH BETWEEN SPACES ${spaceNumber(from)} AND ${spaceNumber(to)} IS BLOCKED FOR ${AVALANCHE_CONFIG.durationRounds} ROUNDS`,
    });
  },
};

// Shared shape for "a transport is out of service" events (Mine Collapse, Cable Car Breakdown).
function transportOutageEvent(
  id: string,
  name: string,
  icon: string,
  kind: "cable-car" | "mine-cart",
  message: string,
): EventDefinition {
  const target = (state: Match, map: BoardMap) =>
    map.transports?.find((t) => t.kind === kind && !transportOutage(state, t.id));
  return {
    id,
    name,
    icon,
    description: `The ${kind === "cable-car" ? "Cable Car" : "Mine Cart"} is out of service for ${TRANSPORT_OUTAGE_CONFIG.durationRounds} rounds.`,
    weight: 1,
    allowedMaps: ["mountain"],
    canRun: (state, map) => !!target(state, map),
    execute(state, { map }) {
      const transport = target(state, map);
      if (!transport) return;
      disableTransport(state, transport.id, id);
      emit(state, {
        kind: "TRANSPORT",
        nodeId: transport.endpoints[0],
        text: `${icon} ${message} (${TRANSPORT_OUTAGE_CONFIG.durationRounds} ROUNDS)`,
      });
    },
  };
}
export const mineCollapse = transportOutageEvent(
  "mine-collapse",
  "Mine Collapse",
  "⛏️",
  "mine-cart",
  "MINE COLLAPSE! THE MINE CART TRACK IS CLOSED",
);
export const cableBreakdown = transportOutageEvent(
  "cable-breakdown",
  "Cable Car Breakdown",
  "🚡",
  "cable-car",
  "CABLE CAR BREAKDOWN! THE GONDOLAS ARE STOPPED",
);

// Regions produce readable, temporary opportunities rather than interchangeable coin payouts.
const regionNodes = (map: BoardMap, motif: string) => map.nodes.filter((n) => map.regions[n.region].motif === motif && !map.cleansingNodeIds?.includes(n.id));
export const pirateTreasure: EventDefinition = {
  id: "pirate-treasure", name: "Pirate Treasure", icon: "💎", description: "Three pirate spaces hide 5 coins each until next round ends.", weight: 2, allowedMaps: ["sunspill"],
  canRun: (state, map) => regionNodes(map, "boat").length >= 3 && !state.boardEffects?.some((e) => e.kind === "treasure"),
  execute(state, { map, random }) { const pool = [...regionNodes(map, "boat")], ids: string[] = []; for (let i = 0; i < 3; i++) ids.push(pool.splice(Math.min(pool.length - 1, Math.floor(random() * pool.length)), 1)[0].id);
    (state.boardEffects ??= []).push({ id: `treasure-${state.round}-${state.eventSeq}`, kind: "treasure", nodeIds: ids, expiresAfterRound: state.round + 1 });
    emit(state, { kind: "EVENT", nodeId: ids[0], text: "PIRATE TREASURE! THREE MARKED SPACES HOLD +5 COINS UNTIL NEXT ROUND ENDS" });
  },
};
export const eruptionForecast: EventDefinition = {
  id: "eruption-forecast", name: "Ember Forecast", icon: "🌋", description: "Ember Peak erupts at the end of next round. Move away from marked spaces.", weight: 2, allowedMaps: ["sunspill"],
  canRun: (state) => !state.boardEffects?.some((e) => e.kind === "eruption"),
  execute(state, { map }) { const ids = regionNodes(map, "volcano").map((n) => n.id); (state.boardEffects ??= []).push({ id: `eruption-${state.round}`, kind: "eruption", nodeIds: ids, expiresAfterRound: state.round + 1 }); emit(state, { kind: "EVENT", nodeId: ids[0], text: "⚠ EMBER PEAK ERUPTS AT THE END OF NEXT ROUND · MARKED SPACES DEAL 10 HP DAMAGE" }); },
};
export const jungleBounty: EventDefinition = {
  id: "jungle-bounty", name: "Jungle Bounty", icon: "🍃", description: "Jade Jungle spaces give 2 extra coins for the rest of this round and next.", weight: 2, allowedMaps: ["sunspill"],
  canRun: (state) => !state.boardEffects?.some((e) => e.kind === "breeze"),
  execute(state, { map }) { const ids = map.nodes.filter((n) => n.region === 5 && !map.cleansingNodeIds?.includes(n.id)).map((n) => n.id); (state.boardEffects ??= []).push({ id: `bounty-${state.round}`, kind: "breeze", nodeIds: ids, expiresAfterRound: state.round + 1 }); emit(state, { kind: "EVENT", nodeId: ids[0], text: "JADE JUNGLE BOUNTY! LAND ON A MARKED SPACE FOR +2 BONUS COINS" }); },
};

export const calmWaters: EventDefinition = {
  id: "calm-waters", name: "Calm Waters", icon: "💚", description: "Sunspill Bay becomes a sanctuary: marked landings heal an extra 5 HP through next round.", weight: 2, allowedMaps: ["sunspill"],
  canRun: (state) => !state.boardEffects?.some((e) => e.kind === "sanctuary"),
  execute(state, { map }) {
    const nodeIds = map.nodes.filter((n) => n.region === 0 && !map.cleansingNodeIds?.includes(n.id)).map((n) => n.id);
    (state.boardEffects ??= []).push({ id: `sanctuary-${state.round}`, kind: "sanctuary", nodeIds, expiresAfterRound: state.round + 1 });
    emit(state, { kind: "EVENT", nodeId: nodeIds[0], text: "CALM WATERS! SUNSPILL BAY LANDINGS HEAL +5 HP THROUGH NEXT ROUND" });
  },
};
export const coconutMarket: EventDefinition = {
  id: "coconut-market", name: "Coconut Market", icon: "🛍", description: "Players in Coconut Club save 2 coins on normal shop items through next round. Mystery boxes remain 10 coins.", weight: 2, allowedMaps: ["sunspill"],
  canRun: (state) => !state.boardEffects?.some((e) => e.kind === "sale"),
  execute(state, { map }) {
    const nodeIds = map.nodes.filter((n) => n.region === 1).map((n) => n.id);
    (state.boardEffects ??= []).push({ id: `sale-${state.round}`, kind: "sale", nodeIds, expiresAfterRound: state.round + 1 });
    emit(state, { kind: "EVENT", nodeId: nodeIds[0], text: "COCONUT MARKET! NORMAL SHOP ITEMS COST 2 LESS WHILE YOU ARE IN COCONUT CLUB THROUGH NEXT ROUND" });
  },
};
export const ruinsRelics: EventDefinition = {
  id: "ruins-relics", name: "Ruins Relics", icon: "◆", description: "Three marked Whisper Ruins spaces become one-use item caches through next round.", weight: 2, allowedMaps: ["sunspill"],
  canRun: (state, map) => map.nodes.filter((n) => n.region === 3 && ["coin", "heal", "deposit", "empty"].includes(n.type)).length >= 3 && !state.boardEffects?.some((e) => e.kind === "relic"),
  execute(state, { map, random }) {
    const pool = map.nodes.filter((n) => n.region === 3 && ["coin", "heal", "deposit", "empty"].includes(n.type) && !map.cleansingNodeIds?.includes(n.id));
    const nodeIds = Array.from({ length: 3 }, () => pool.splice(Math.min(pool.length - 1, Math.floor(random() * pool.length)), 1)[0].id);
    (state.boardEffects ??= []).push({ id: `relic-${state.round}-${state.eventSeq}`, kind: "relic", nodeIds, expiresAfterRound: state.round + 1 });
    emit(state, { kind: "EVENT", nodeId: nodeIds[0], text: "RUINS RELICS! THREE MARKED SPACES GRANT AN ITEM INSTEAD OF THEIR NORMAL FIELD THROUGH NEXT ROUND" });
  },
};
