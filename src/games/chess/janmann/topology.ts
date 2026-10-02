import { DIVIDENDS_PER_SECTOR, SECTOR_COUNT, type DividendId, type Side, type Vec3 } from "./config.ts";

export interface DividendNode {
  id: DividendId;
  sectorId: number;
  dividendIndex: number;
  /** Signed odd-integer octahedral lattice; independent of world/camera coordinates. */
  logical: Vec3;
  barycentric: Vec3;
  neighbors: DividendId[];
  rookContinuations: DividendId[][];
  bishopContinuations: DividendId[][];
  knightJumps: DividendId[];
  pawn: Record<Side, { forward: DividendId | null; captures: DividendId[] }>;
}

export function getSectorOrientation(sector: number): Vec3 {
  return [sector & 4 ? -1 : 1, sector & 2 ? -1 : 1, sector & 1 ? -1 : 1];
}

export function getDividendBarycentricPosition(index: number): Vec3 {
  if (!Number.isInteger(index) || index < 0 || index >= DIVIDENDS_PER_SECTOR) throw new RangeError("Invalid Dividend index");
  const row = Math.floor((Math.sqrt(8 * index + 1) - 1) / 2);
  const column = index - row * (row + 1) / 2;
  return [(7 - 2 * row) / 9, (1 + 2 * column) / 9, (1 + 2 * (row - column)) / 9];
}

const dot = (a: Vec3, b: Vec3) => a.reduce((sum, value, i) => sum + value * b[i], 0);
const cross = (a: Vec3, b: Vec3): Vec3 => [a[1]*b[2]-a[2]*b[1], a[2]*b[0]-a[0]*b[2], a[0]*b[1]-a[1]*b[0]];

/** Each plane cuts a closed logical ring. Both traversal directions are stored.
 * Axis planes give rook lines; pair-sum/difference planes give diagonal lines.
 * Ring ordering is calculated once on the integer graph, never from the mesh.
 */
function ringRays(nodes: DividendNode[], normals: Vec3[]) {
  const rays = new Map<DividendId, DividendId[][]>(nodes.map((node) => [node.id, []]));
  for (const normal of normals) {
    const groups = new Map<number, DividendNode[]>();
    for (const node of nodes) {
      const level = dot(node.logical, normal);
      groups.set(level, [...(groups.get(level) ?? []), node]);
    }
    const u = cross(normal, Math.abs(normal[0]) < .5 ? [1, 0, 0] : [0, 1, 0]);
    const v = cross(normal, u);
    // Equal-length axes are necessary for geometric angle ordering.
    const ul = Math.hypot(...u), vl = Math.hypot(...v);
    for (const group of groups.values()) {
      if (group.length < 3) continue;
      group.sort((a, b) => Math.atan2(dot(a.logical, v)/vl, dot(a.logical, u)/ul) - Math.atan2(dot(b.logical, v)/vl, dot(b.logical, u)/ul));
      group.forEach((node, index) => {
        for (const direction of [1, -1]) {
          rays.get(node.id)!.push(Array.from({ length: group.length - 1 }, (_, step) => group[(index + direction * (step + 1) + group.length) % group.length].id));
        }
      });
    }
  }
  return rays;
}

function createTopology(): DividendNode[] {
  const nodes: DividendNode[] = Array.from({ length: SECTOR_COUNT }, (_, sectorId) => {
    const signs = getSectorOrientation(sectorId);
    return Array.from({ length: DIVIDENDS_PER_SECTOR }, (_, dividendIndex): DividendNode => {
      const barycentric = getDividendBarycentricPosition(dividendIndex);
      return {
        id: `${sectorId}:${dividendIndex}`, sectorId, dividendIndex, barycentric,
        logical: barycentric.map((value, axis) => Math.round(value * 9) * signs[axis]) as Vec3,
        neighbors: [], rookContinuations: [], bishopContinuations: [], knightJumps: [],
        pawn: { white: { forward: null, captures: [] }, black: { forward: null, captures: [] } },
      };
    });
  }).flat();
  const byId = new Map(nodes.map((node) => [node.id, node]));
  const rook = ringRays(nodes, [[1,0,0], [0,1,0], [0,0,1]]);
  const bishop = ringRays(nodes, [[1,1,0], [1,-1,0], [1,0,1], [1,0,-1], [0,1,1], [0,1,-1]]);
  for (const node of nodes) {
    node.rookContinuations = rook.get(node.id)!;
    node.bishopContinuations = bishop.get(node.id)!;
    node.neighbors = [...new Set(node.rookContinuations.map((ray) => ray[0]))];
  }
  for (const node of nodes) {
    const jumps = new Set<DividendId>();
    for (const ray of node.rookContinuations) {
      const second = byId.get(ray[1])!;
      // Two straight steps, then a branch away from that ring.
      for (const branch of second.neighbors) if (!ray.includes(branch) && branch !== node.id) jumps.add(branch);
    }
    node.knightJumps = [...jumps].sort();
    for (const side of ["white", "black"] as const) {
      const direction = side === "white" ? -1 : 1;
      const forward = node.neighbors.filter((id) => direction * (byId.get(id)!.logical[0] - node.logical[0]) > 0);
      // Stable local meridian: prefer preserving z, with an antipodal tie break.
      forward.sort((a, b) => {
        const pa = byId.get(a)!.logical, pb = byId.get(b)!.logical;
        return Math.abs(pa[2] - node.logical[2]) - Math.abs(pb[2] - node.logical[2]) || direction * (pa[1] - pb[1]);
      });
      const captures = [...new Set(node.bishopContinuations.map((ray) => ray[0]))]
        .filter((id) => id !== forward[0] && direction * (byId.get(id)!.logical[0] - node.logical[0]) > 0)
        .sort((a, b) => {
          const distance = (id: DividendId) => byId.get(id)!.logical.reduce((sum, value, axis) => sum + (value - node.logical[axis]) ** 2, 0);
          return distance(a) - distance(b) || direction * (byId.get(a)!.logical[1] - byId.get(b)!.logical[1]) || direction * (byId.get(a)!.logical[2] - byId.get(b)!.logical[2]);
        }).slice(0, 2);
      node.pawn[side] = { forward: forward[0] ?? null, captures };
    }
  }
  // A jump is reversible across every seam, including the octahedron's corners.
  for (const node of nodes) for (const id of [...node.knightJumps]) {
    const target = byId.get(id)!;
    if (!target.knightJumps.includes(node.id)) target.knightJumps.push(node.id);
  }
  return nodes;
}

export const TOPOLOGY = createTopology();
export const NODES = Object.fromEntries(TOPOLOGY.map((node) => [node.id, node])) as Record<DividendId, DividendNode>;
