import type { BoardMap, BoardNode } from "../types.ts";

// Temporarily unusable connections, as undirected edge keys (see `edgeKey`). No event closes a route
// yet; pathfinding callers pass the active set so a future bridge collapse only has to supply it.
export type RouteRestrictions = ReadonlySet<string>;
export const NO_RESTRICTIONS: RouteRestrictions = new Set();
export function edgeKey(a: string, b: string): string {
  return a < b ? `${a}|${b}` : `${b}|${a}`;
}
const indexes = new WeakMap<BoardMap, Map<string, BoardNode>>();
function nodeIndex(map: BoardMap): Map<string, BoardNode> {
  let index = indexes.get(map);
  if (!index) {
    index = new Map(map.nodes.map((node) => [node.id, node]));
    indexes.set(map, index);
  }
  return index;
}
// Usable connections of a node, in the map's declared (stable) order.
export function openConnections(
  map: BoardMap,
  nodeId: string,
  restrictions: RouteRestrictions = NO_RESTRICTIONS,
): string[] {
  const connections = nodeIndex(map).get(nodeId)?.connections ?? [];
  return restrictions.size
    ? connections.filter((next) => !restrictions.has(edgeKey(nodeId, next)))
    : connections;
}

// Shortest connection distance by breadth-first search; never uses pixel positions.
export function graphDistances(
  map: BoardMap,
  from: string,
  maxDistance = Infinity,
  restrictions: RouteRestrictions = NO_RESTRICTIONS,
): Map<string, number> {
  const distances = new Map<string, number>([[from, 0]]);
  const queue = [from];
  for (let i = 0; i < queue.length; i++) {
    const id = queue[i],
      distance = distances.get(id)!;
    if (distance >= maxDistance) continue;
    for (const next of openConnections(map, id, restrictions))
      if (!distances.has(next)) {
        distances.set(next, distance + 1);
        queue.push(next);
      }
  }
  return distances;
}

// Shortest legal path (unweighted BFS) from `from` to `to`, excluding `from` and including `to`.
// [] when already there; null when unreachable or either node is unknown. Ties between equally short
// paths always resolve the same way: the first connection in map order wins.
export function findShortestPath(
  map: BoardMap,
  from: string,
  to: string,
  restrictions: RouteRestrictions = NO_RESTRICTIONS,
): string[] | null {
  const index = nodeIndex(map);
  if (!index.has(from) || !index.has(to)) return null;
  if (from === to) return [];
  const previous = new Map<string, string>([[from, from]]);
  const queue = [from];
  for (let i = 0; i < queue.length; i++) {
    const id = queue[i];
    for (const next of openConnections(map, id, restrictions)) {
      if (previous.has(next)) continue;
      previous.set(next, id);
      if (next === to) {
        const path = [to];
        for (let at = id; at !== from; at = previous.get(at)!) path.unshift(at);
        return path;
      }
      queue.push(next);
    }
  }
  return null;
}

// True when every node can be reached from every other node using only open connections. Route-closing
// mechanics use it to refuse a closure that would isolate part of the board.
export function isMapConnected(
  map: BoardMap,
  restrictions: RouteRestrictions = NO_RESTRICTIONS,
): boolean {
  if (!map.nodes.length) return true;
  return (
    graphDistances(map, map.nodes[0].id, Infinity, restrictions).size ===
    map.nodes.length
  );
}

// Player-facing space number: node ids are `<prefix>-<index>` and the index is the node's position.
export function spaceNumber(nodeId: string): number {
  return Number(nodeId.split("-")[1]) + 1;
}
