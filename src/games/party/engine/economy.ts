import type { BoardMap, Match, Player, Settings } from "../types.ts";
import type { Random } from "./engine.ts";
import { NO_RESTRICTIONS, openConnections, type RouteRestrictions } from "./graph.ts";

// Irradiated nodes (match state) are passed in `excluded` by the caller; see hazards/radiation.ts.
export function eligiblePlutoNodes(
  map: BoardMap,
  excluded: readonly string[] = [],
): string[] {
  return map.nodes
    .filter(
      (node) =>
        node.id !== map.start &&
        !map.cleansingNodeIds?.includes(node.id) &&
        node.type !== "rare" &&
        node.type !== "bank" &&
        node.type !== "property" &&
        node.plutoEligible !== false &&
        !excluded.includes(node.id),
    )
    .map((node) => node.id);
}

export function spawnPlutos(
  map: BoardMap,
  occupied: readonly string[],
  count: number,
  random: Random,
  excluded: readonly string[] = [],
): string[] {
  const candidates = eligiblePlutoNodes(map, [...occupied, ...excluded]);
  if (candidates.length < count)
    throw new Error("The map needs more eligible Golden Pluto spaces.");
  const spawned: string[] = [];
  for (let i = 0; i < count; i++) {
    const index = Math.min(
      candidates.length - 1,
      Math.max(0, Math.floor(random() * candidates.length)),
    );
    spawned.push(candidates.splice(index, 1)[0]);
  }
  return spawned;
}

export function rankedPlayers(state: Match, settings: Settings): Player[] {
  if (state.mode === "festival") return [...state.players].sort((a, b) => (state.festivalScores?.[b.id] ?? 0) - (state.festivalScores?.[a.id] ?? 0) || b.coins - a.coins || state.order.indexOf(a.id) - state.order.indexOf(b.id));
  const primary = (p: Player) =>
    settings.victory === "plutos" ? p.goldenPlutos : p.coins;
  const secondary = (p: Player) =>
    settings.victory === "plutos" ? p.coins : p.goldenPlutos;
  return [...state.players].sort((a, b) => {
    if (a.id === state.winner) return -1;
    if (b.id === state.winner) return 1;
    return (
      primary(b) - primary(a) ||
      secondary(b) - secondary(a) ||
      state.order.indexOf(a.id) - state.order.indexOf(b.id)
    );
  });
}

// Breadth-first traversal of directed steps respects the no-immediate-backtracking rule.
export function reachableLandings(
  map: BoardMap,
  from: string,
  previous: string,
  steps: number,
  restrictions: RouteRestrictions = NO_RESTRICTIONS,
): Set<string> {
  let frontier = new Map([
    [`${previous}/${from}`, { current: from, previous }],
  ]);
  for (let step = 0; step < steps; step++) {
    const next = new Map<string, { current: string; previous: string }>();
    for (const position of frontier.values()) {
      const connections = openConnections(map, position.current, restrictions);
      const forward = connections.filter((id) => id !== position.previous);
      for (const id of forward.length ? forward : connections)
        next.set(`${position.current}/${id}`, {
          current: id,
          previous: position.current,
        });
    }
    frontier = next;
  }
  return new Set([...frontier.values()].map((position) => position.current));
}

export function distanceToPluto(
  map: BoardMap,
  from: string,
  targets: readonly string[],
  restrictions: RouteRestrictions = NO_RESTRICTIONS,
): number {
  const visited = new Set<string>(),
    queue = [{ id: from, distance: 0 }];
  for (let i = 0; i < queue.length; i++) {
    const { id, distance } = queue[i];
    if (targets.includes(id)) return distance;
    if (visited.has(id)) continue;
    visited.add(id);
    for (const next of openConnections(map, id, restrictions))
      if (!visited.has(next)) queue.push({ id: next, distance: distance + 1 });
  }
  return map.nodes.length;
}
