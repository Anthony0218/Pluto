import { AVALANCHE_CONFIG } from "../config.ts";
import type { BlockedConnection, BoardMap, Match } from "../types.ts";
import { emit } from "./events.ts";
import {
  edgeKey,
  isMapConnected,
  NO_RESTRICTIONS,
  type RouteRestrictions,
} from "./graph.ts";

// Temporarily closed connections. The map graph is never mutated: `match.blockedConnections` is the only
// record, and every routing system (movement, bots, animals, Pluto routing) takes the set returned by
// `activeRestrictions` and passes it to the graph helpers in `graph.ts`.

export function restrictionsOf(
  blocked: readonly BlockedConnection[],
): RouteRestrictions {
  return blocked.length
    ? new Set(blocked.map((b) => edgeKey(b.fromNodeId, b.toNodeId)))
    : NO_RESTRICTIONS;
}
export function activeRestrictions(
  state: Pick<Match, "blockedConnections">,
): RouteRestrictions {
  return restrictionsOf(state.blockedConnections);
}
export function blockedConnectionOf(
  state: Pick<Match, "blockedConnections">,
  a: string,
  b: string,
): BlockedConnection | undefined {
  const key = edgeKey(a, b);
  return state.blockedConnections.find(
    (c) => edgeKey(c.fromNodeId, c.toNodeId) === key,
  );
}
// Rounds a connection stays closed, counting the current round (0 when open).
export function blockedRoundsLeft(
  state: Pick<Match, "blockedConnections" | "round">,
  block: BlockedConnection,
): number {
  return Math.max(0, block.expiresAfterRound - state.round + 1);
}

// Eligible closures: the map's blockable connections that are not already closed and whose closure (on top
// of every active closure) keeps the whole board connected. Empty on maps without blockable connections.
export function safeBlockableEdges(
  state: Pick<Match, "blockedConnections">,
  map: BoardMap,
): [string, string][] {
  return (map.blockableEdges ?? []).filter(([a, b]) => {
    if (blockedConnectionOf(state, a, b)) return false;
    const next = new Set(activeRestrictions(state));
    next.add(edgeKey(a, b));
    return isMapConnected(map, next);
  });
}

export function blockConnection(
  state: Match,
  fromNodeId: string,
  toNodeId: string,
  source: string,
  durationRounds: number = AVALANCHE_CONFIG.durationRounds,
): BlockedConnection {
  const block: BlockedConnection = {
    id: `block-${state.nextBlockNumber++}`,
    fromNodeId,
    toNodeId,
    expiresAfterRound: state.round + durationRounds - 1,
    source,
  };
  state.blockedConnections = [...state.blockedConnections, block];
  return block;
}

// Called at ROUND_END before the round counter moves on.
export function expireBlockedConnections(state: Match) {
  const expired = state.blockedConnections.filter(
    (b) => b.expiresAfterRound <= state.round,
  );
  if (!expired.length) return;
  state.blockedConnections = state.blockedConnections.filter(
    (b) => b.expiresAfterRound > state.round,
  );
  emit(state, {
    kind: "ROUTE_REOPENED",
    nodeId: expired[0].fromNodeId,
    text: `THE ROUTE IS OPEN AGAIN${expired.length > 1 ? ` (${expired.length} PATHS)` : ""}`,
  });
}
