import { DEFAULT_OUTER_RADIUS_M, SNUB_CUBE_STRETCH, type DividendId, type Vec3 } from "./config.ts";
import { getDividendBarycentricPosition, getSectorOrientation, NODES } from "./topology.ts";

type Point2 = [number, number];
const SIDE = 4;
const HEIGHT = SIDE * Math.sqrt(3) / 2;
const CANONICAL: Point2[] = [[0, HEIGHT], [-SIDE / 2, 0], [SIDE / 2, 0]];
const mix = (a: number, b: number, t: number) => a + (b - a) * t;
export const interpolate = (a: Vec3, b: Vec3, t: number): Vec3 => a.map((value, axis) => mix(value, b[axis], t)) as Vec3;
export const stretchAt = (progress: number) => mix(1, SNUB_CUBE_STRETCH, progress);

function toPlane(bary: Vec3): Point2 {
  return [bary.reduce((sum, weight, i) => sum + weight * CANONICAL[i][0], 0), bary[0] * HEIGHT];
}
function toBary([x, y]: Point2): Vec3 {
  const a = y / HEIGHT;
  return [a, (1 - a) / 2 - x / SIDE, (1 - a) / 2 + x / SIDE];
}

/** Voronoi cells tile the entire canonical sector, leaving no artificial seams. */
export function getDividendPolygon(index: number): Vec3[] {
  const origin = toPlane(getDividendBarycentricPosition(index));
  let polygon = CANONICAL.map((p) => [...p] as Point2);
  for (let other = 0; other < 10; other++) {
    if (other === index) continue;
    const target = toPlane(getDividendBarycentricPosition(other));
    const normal = [target[0] - origin[0], target[1] - origin[1]];
    const offset = (target[0] ** 2 + target[1] ** 2 - origin[0] ** 2 - origin[1] ** 2) / 2;
    const distance = (p: Point2) => p[0] * normal[0] + p[1] * normal[1] - offset;
    const clipped: Point2[] = [];
    polygon.forEach((a, i) => {
      const b = polygon[(i + 1) % polygon.length];
      const da = distance(a), db = distance(b);
      if (da <= 1e-9) clipped.push(a);
      if ((da < 0 && db > 0) || (da > 0 && db < 0)) {
        const t = da / (da - db);
        clipped.push([mix(a[0], b[0], t), mix(a[1], b[1], t)]);
      }
    });
    polygon = clipped;
  }
  return polygon.map(toBary);
}

/** Two reflected congruent triangles per side, rotated about the central square. */
export function getFlatSectorTransform(sector: number): Vec3[] {
  let points: Point2[] = [[0, -SIDE / 2 - HEIGHT], [-SIDE / 2, -SIDE / 2], [SIDE / 2, -SIDE / 2]];
  if (sector % 2) {
    const [a, b, c] = points;
    const dx = c[0] - a[0], dy = c[1] - a[1];
    const t = ((b[0] - a[0]) * dx + (b[1] - a[1]) * dy) / (dx*dx + dy*dy);
    const reflection: Point2 = [2 * (a[0] + t * dx) - b[0], 2 * (a[1] + t * dy) - b[1]];
    points = [reflection, c, a];
  }
  const angle = Math.floor(sector / 2) * Math.PI / 2;
  return points.map(([x, z]) => [x * Math.cos(angle) - z * Math.sin(angle), 0, x * Math.sin(angle) + z * Math.cos(angle)]);
}

export function getSphereSectorTransform(sector: number): Vec3[] {
  const signs = getSectorOrientation(sector);
  return [[signs[0], 0, 0], [0, signs[1], 0], [0, 0, signs[2]]];
}

export function projectSectorPointToSphere(sector: number, bary: Vec3, radius = DEFAULT_OUTER_RADIUS_M): Vec3 {
  const signs = getSectorOrientation(sector);
  const length = Math.hypot(...bary);
  return bary.map((value, axis) => signs[axis] * value / length * radius) as Vec3;
}

export function flatPosition(sector: number, bary: Vec3): Vec3 {
  const vertices = getFlatSectorTransform(sector);
  return [0, 1, 2].map((axis) => bary.reduce((sum, weight, i) => sum + weight * vertices[i][axis], 0)) as Vec3;
}

export function dividendPosition(id: DividendId, progress: number): Vec3 {
  const node = NODES[id];
  return interpolate(flatPosition(node.sectorId, node.barycentric), projectSectorPointToSphere(node.sectorId, node.barycentric), progress);
}

export function assemblyPhase(progress: number) {
  if (progress === 0) return "Planar";
  if (progress < .12) return "Identify";
  if (progress < .25) return "Copy";
  if (progress < .4) return "Align";
  if (progress < .65) return "Rotate";
  if (progress < 1) return "Project";
  return "Locked";
}

/** 24 vertices of one chiral snub cube. t³ − t² − t − 1 = 0. */
export function snubCubeVertices(): Vec3[] {
  const t = (1 + Math.cbrt(19 + 3 * Math.sqrt(33)) + Math.cbrt(19 - 3 * Math.sqrt(33))) / 3;
  const base = [1, 1 / t, t];
  const permutations = [[0,1,2], [1,2,0], [2,0,1], [0,2,1], [2,1,0], [1,0,2]];
  return permutations.flatMap((permutation, index) => Array.from({ length: 8 }, (_, bits) => {
    const signs = getSectorOrientation(bits);
    const plusCount = signs.filter((sign) => sign > 0).length;
    return plusCount % 2 === (index < 3 ? 0 : 1) ? permutation.map((axis, i) => base[axis] * signs[i]) as Vec3 : null;
  }).filter((point): point is Vec3 => point !== null));
}
