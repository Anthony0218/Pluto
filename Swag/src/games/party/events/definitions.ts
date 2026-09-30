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
