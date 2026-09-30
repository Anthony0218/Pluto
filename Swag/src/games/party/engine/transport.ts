import { TRANSPORT_OUTAGE_CONFIG } from "../config.ts";
import type {
  BoardMap,
  ForcedMove,
  MapSlide,
  MapTransport,
  Match,
} from "../types.ts";
import { findPlayer } from "./combat.ts";
import { emit } from "./events.ts";

// Map transports (Cable Car, Mine Cart) and Frozen Slides: forced, non-dice movement.
//
// Resolution rules (one place, so nothing double-triggers):
//  - Dice movement: the final node resolves its field normally.
//  - Transport ride: the origin station's field already resolved when the player landed on it. The ride
//    moves the pawn to the paired station and does NOT resolve the destination (no field, no property or
//    Pluto offer, no Radiation: those are landing-only). Animals never use transports.
//  - Slide: the origin's field resolves, then the pawn is moved along `slide.path` with no input and no
//    intermediate resolution; only the final node then resolves, once, and that landing cannot start
//    another slide or transport offer (`match.forcedMove.pending`).

export function transportAt(
  map: BoardMap,
  nodeId: string,
): MapTransport | undefined {
  return map.transports?.find((t) => t.endpoints.includes(nodeId));
}
export function transportDestination(
  transport: MapTransport,
  fromNodeId: string,
): string | null {
  const [a, b] = transport.endpoints;
  return fromNodeId === a ? b : fromNodeId === b ? a : null;
}
export function transportOutage(state: Pick<Match, "transportOutages">, transportId: string) {
  return state.transportOutages.find((o) => o.transportId === transportId);
}
export function transportRoundsOut(
  state: Pick<Match, "transportOutages" | "round">,
  transportId: string,
): number {
  const outage = transportOutage(state, transportId);
  return outage ? Math.max(0, outage.expiresAfterRound - state.round + 1) : 0;
}
// The ride currently on offer at the active player's node, if any.
export function availableTransport(
  state: Match,
  map: BoardMap,
  nodeId: string,
): MapTransport | null {
  const transport = transportAt(map, nodeId);
  if (!transport || transportOutage(state, transport.id)) return null;
  return transport;
}

export function slideAt(map: BoardMap, nodeId: string): MapSlide | undefined {
  return map.slides?.find((s) => s.nodeId === nodeId);
}
export function slideDestination(map: BoardMap, nodeId: string): string | null {
  const slide = slideAt(map, nodeId);
  return slide ? slide.path[slide.path.length - 1] : null;
}

function record(
  state: Match,
  kind: ForcedMove["kind"],
  playerId: string,
  fromNodeId: string,
  path: string[],
  pending: boolean,
) {
  state.forcedMove = {
    sequence: ++state.forcedMoveSeq,
    kind,
    playerId,
    fromNodeId,
    path,
    pending,
  };
}

// Moves a player through a slide; the caller then runs the landing of the final node.
export function performSlide(state: Match, map: BoardMap, playerId: string): boolean {
  const player = findPlayer(state, playerId),
    slide = slideAt(map, player.currentNodeId);
  if (!slide) return false;
  const from = player.currentNodeId,
    path = [...slide.path];
  player.previousNodeId = path.length > 1 ? path[path.length - 2] : from;
  player.currentNodeId = path[path.length - 1];
  record(state, "slide", playerId, from, path, true);
  emit(state, {
    kind: "SLIDE",
    playerId,
    nodeId: player.currentNodeId,
    amount: path.length,
    text: `🧊 ${player.name.toUpperCase()} SLID ${path.length} SPACE${path.length === 1 ? "" : "S"} ACROSS THE ICE`,
  });
  return true;
}

// Server-side validation for RIDE_TRANSPORT. Throws before anything is changed.
export function rideTransport(
  state: Match,
  map: BoardMap,
  playerId: string,
  transportId: string,
) {
  const player = findPlayer(state, playerId),
    transport = map.transports?.find((t) => t.id === transportId);
  if (!transport || !transport.endpoints.includes(player.currentNodeId))
    throw new Error(`You are not at a ${transport?.name ?? "transport"} station.`);
  if (transportOutage(state, transport.id))
    throw new Error(`The ${transport.name} is out of service.`);
  if (player.coins < transport.cost)
    throw new Error(`You need ${transport.cost} coins to ride the ${transport.name}.`);
  const destination = transportDestination(transport, player.currentNodeId)!,
    from = player.currentNodeId;
  player.coins -= transport.cost;
  player.currentNodeId = destination;
  player.previousNodeId = null;
  record(state, transport.kind, playerId, from, [destination], false);
  emit(state, {
    kind: "TRANSPORT",
    playerId,
    nodeId: destination,
    text: `${transport.icon} ${player.name.toUpperCase()} RODE THE ${transport.name.toUpperCase()}${transport.cost ? ` FOR ${transport.cost} COINS` : ""}`,
  });
}

export function disableTransport(
  state: Match,
  transportId: string,
  source: string,
  durationRounds: number = TRANSPORT_OUTAGE_CONFIG.durationRounds,
) {
  state.transportOutages = [
    ...state.transportOutages.filter((o) => o.transportId !== transportId),
    { transportId, source, expiresAfterRound: state.round + durationRounds - 1 },
  ];
}

// Called at ROUND_END before the round counter moves on.
export function expireTransportOutages(state: Match, map: BoardMap) {
  const expired = state.transportOutages.filter((o) => o.expiresAfterRound <= state.round);
  if (!expired.length) return;
  state.transportOutages = state.transportOutages.filter(
    (o) => o.expiresAfterRound > state.round,
  );
  for (const outage of expired) {
    const transport = map.transports?.find((t) => t.id === outage.transportId);
    if (transport)
      emit(state, {
        kind: "TRANSPORT",
        nodeId: transport.endpoints[0],
        text: `${transport.icon} THE ${transport.name.toUpperCase()} IS RUNNING AGAIN`,
      });
  }
}
