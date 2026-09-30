import { FIELD_DISTRIBUTION, MAP_NODE_COUNT } from "../config.ts";
import { edgeKey, graphDistances } from "../engine/graph.ts";
import type { BoardMap, TileType } from "../types.ts";

const TILE_TYPES: readonly TileType[] = FIELD_DISTRIBUTION.map(([type]) => type);

// Structural validation shared by every playable map. Returns human-readable problems; an empty list
// means the map is valid. Tests assert it is empty for each registered map, so a broken definition
// (wrong node count, one-way link, unreachable space, bad slide path…) fails the suite.
export function validateMap(map: BoardMap): string[] {
  const errors: string[] = [];
  const fail = (message: string) => errors.push(`${map.id}: ${message}`);
  const byId = new Map(map.nodes.map((n) => [n.id, n]));

  if (map.nodes.length !== MAP_NODE_COUNT)
    fail(`expected ${MAP_NODE_COUNT} playable nodes, found ${map.nodes.length}`);
  if (byId.size !== map.nodes.length) fail("node ids are not unique");
  if (!byId.has(map.start)) fail(`start node ${map.start} does not exist`);
  if (!(map.goldenPlutoCount >= 1)) fail("goldenPlutoCount must be at least 1");

  for (const node of map.nodes) {
    if (!TILE_TYPES.includes(node.type)) fail(`${node.id} has invalid type ${node.type}`);
    if (!map.regions[node.region]) fail(`${node.id} has unknown region ${node.region}`);
    if (new Set(node.connections).size !== node.connections.length)
      fail(`${node.id} lists a connection twice`);
    if (!node.connections.length) fail(`${node.id} has no connections`);
    for (const other of node.connections) {
      const target = byId.get(other);
      if (!target) fail(`${node.id} connects to unknown node ${other}`);
      else if (other === node.id) fail(`${node.id} connects to itself`);
      else if (!target.connections.includes(node.id))
        fail(`${node.id} → ${other} is not reciprocal`);
    }
  }

  const counts = new Map<TileType, number>();
  for (const node of map.nodes) counts.set(node.type, (counts.get(node.type) ?? 0) + 1);
  for (const [type, expected] of FIELD_DISTRIBUTION)
    if ((counts.get(type) ?? 0) !== expected)
      fail(`expected ${expected} ${type} fields, found ${counts.get(type) ?? 0}`);

  if (byId.has(map.start)) {
    const reachable = graphDistances(map, map.start);
    for (const node of map.nodes)
      if (!reachable.has(node.id)) fail(`${node.id} is unreachable from Start`);
  }

  // Forced-movement mechanics must be predictable and never chain or strand a player.
  const forcedOrigins = new Set<string>([
    ...(map.slides ?? []).map((s) => s.nodeId),
    ...(map.transports ?? []).flatMap((t) => t.endpoints),
  ]);
  const edgeExists = (a: string, b: string) => !!byId.get(a)?.connections.includes(b);
  const noPluto = (nodeId: string) => byId.get(nodeId)?.plutoEligible === false;
  for (const slide of map.slides ?? []) {
    const origin = byId.get(slide.nodeId);
    if (!origin) {
      fail(`slide origin ${slide.nodeId} does not exist`);
      continue;
    }
    if (!slide.path.length) fail(`slide ${slide.nodeId} has an empty path`);
    let previous = slide.nodeId;
    for (const step of slide.path) {
      if (!byId.has(step)) fail(`slide ${slide.nodeId} passes unknown node ${step}`);
      else if (!edgeExists(previous, step))
        fail(`slide ${slide.nodeId}: ${previous} → ${step} is not a connection`);
      previous = step;
    }
    if (new Set([slide.nodeId, ...slide.path]).size !== slide.path.length + 1)
      fail(`slide ${slide.nodeId} revisits a node`);
    const destination = slide.path[slide.path.length - 1];
    if (forcedOrigins.has(destination) || byId.get(destination)?.type === "warp")
      fail(`slide ${slide.nodeId} ends on a forced-movement space (${destination})`);
    if (origin.type === "property" || !noPluto(origin.id))
      fail(`slide origin ${origin.id} must not be a property or Pluto space`);
  }
  for (const transport of map.transports ?? []) {
    const [a, b] = transport.endpoints;
    if (a === b || !byId.has(a) || !byId.has(b))
      fail(`transport ${transport.id} needs two distinct existing stations`);
    for (const station of transport.endpoints) {
      const node = byId.get(station);
      if (node && (node.type === "property" || !noPluto(station)))
        fail(`station ${station} must not be a property or Pluto space`);
      if (map.slides?.some((s) => s.nodeId === station))
        fail(`station ${station} is also a slide`);
    }
  }
  for (const [from, to] of Object.entries(map.warps ?? {})) {
    if (byId.get(from)?.type !== "warp") fail(`warp source ${from} is not a warp field`);
    if (!byId.has(to)) fail(`warp destination ${to} does not exist`);
  }
  for (const [a, b] of map.blockableEdges ?? [])
    if (!edgeExists(a, b)) fail(`blockable edge ${edgeKey(a, b)} is not a connection`);

  return errors;
}
