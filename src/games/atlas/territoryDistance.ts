import { haversineKm } from "./rules.ts";
import type { Coordinates } from "./types.ts";

/** Country outlines keyed by Natural Earth geometry id (zero-padded M49), as polygons of [longitude, latitude] rings. */
export type CountryShapes = Map<string, Coordinates[][][]>;
type TopologyLike = {
  arcs: [number, number][][];
  transform?: { scale: [number, number]; translate: [number, number] };
  objects: { countries: { geometries: { type: string; id?: string | number; arcs?: unknown }[] } };
};

/**
 * Decodes the bundled TopoJSON without topojson-client, so the Edge Function and the browser share one
 * dependency-free implementation. Natural Earth cuts polygons at the antimeridian, so planar rings stay valid.
 */
export function countryShapesFromTopology(topology: unknown): CountryShapes {
  const typed = topology as TopologyLike;
  const [scaleX, scaleY] = typed.transform?.scale ?? [1, 1], [shiftX, shiftY] = typed.transform?.translate ?? [0, 0];
  const arcs = typed.arcs.map((arc) => {
    let x = 0, y = 0;
    return arc.map(([dx, dy]): Coordinates => {
      if (typed.transform) { x += dx; y += dy; } else { x = dx; y = dy; }
      return [x * scaleX + shiftX, y * scaleY + shiftY];
    });
  });
  const ring = (indexes: number[]) => indexes.flatMap((index, position) => {
    const points = index >= 0 ? arcs[index] : [...arcs[~index]].reverse();
    return position === 0 ? points : points.slice(1);
  });
  const shapes: CountryShapes = new Map();
  for (const geometry of typed.objects.countries.geometries) {
    if (geometry.id === undefined) continue;
    const polygons = geometry.type === "Polygon" ? [geometry.arcs as number[][]] : geometry.type === "MultiPolygon" ? geometry.arcs as number[][][] : [];
    if (polygons.length) shapes.set(String(geometry.id).padStart(3, "0"), polygons.map((rings) => rings.map(ring)));
  }
  return shapes;
}

function insideRing(point: Coordinates, ring: Coordinates[]): boolean {
  let inside = false;
  for (let index = 0, previous = ring.length - 1; index < ring.length; previous = index, index += 1) {
    const [x1, y1] = ring[index], [x2, y2] = ring[previous];
    if ((y1 > point[1]) !== (y2 > point[1]) && point[0] < (x2 - x1) * (point[1] - y1) / (y2 - y1) + x1) inside = !inside;
  }
  return inside;
}

const vector = ([lng, lat]: Coordinates) => { const r = Math.PI / 180, c = Math.cos(lat * r); return [c * Math.cos(lng * r), c * Math.sin(lng * r), Math.sin(lat * r)]; };
const dot = (a: number[], b: number[]) => a.reduce((sum, x, i) => sum + x * b[i], 0);
const cross = (a: number[], b: number[]) => [a[1]*b[2]-a[2]*b[1], a[2]*b[0]-a[0]*b[2], a[0]*b[1]-a[1]*b[0]];
const unit = (v: number[]) => { const length = Math.hypot(...v); return length > 1e-12 ? v.map(x => x / length) : null; };
const coordinate = (v: number[]): Coordinates => [Math.atan2(v[1], v[0])*180/Math.PI, Math.atan2(v[2], Math.hypot(v[0], v[1]))*180/Math.PI];
const angle = (a: number[], b: number[]) => Math.acos(Math.max(-1, Math.min(1, dot(a,b))));
/** Project onto the shorter great-circle arc, including polar and dateline segments. */
function nearestOnSegment(point: Coordinates, a: Coordinates, b: Coordinates): Coordinates {
  const p = vector(point), av = vector(a), bv = vector(b), normal = unit(cross(av,bv));
  const endpoints = haversineKm(point,a) <= haversineKm(point,b) ? a : b;
  if (!normal) return endpoints;
  const projected = unit(p.map((x,i) => x - dot(p,normal)*normal[i]));
  if (!projected) return endpoints;
  for (const candidate of [projected, projected.map(x => -x)]) {
    if (Math.abs(angle(av,candidate)+angle(candidate,bv)-angle(av,bv)) < 1e-7) return coordinate(candidate);
  }
  return endpoints;
}
export function pointAlongGreatCircle(a: Coordinates, b: Coordinates, distanceKm: number): Coordinates {
  const av = vector(a), bv = vector(b), arc = angle(av,bv);
  if (arc < 1e-12) return a;
  const t = Math.min(1, Math.max(0, distanceKm / haversineKm(a,b)));
  if (Math.abs(Math.sin(arc)) < 1e-10) return a;
  return coordinate(av.map((x,i) => (x*Math.sin((1-t)*arc)+bv[i]*Math.sin(t*arc))/Math.sin(arc)));
}

/**
 * Distance from a pin to a country's territory: 0 km anywhere inside its borders, otherwise the great-circle
 * distance to the nearest point of its outline. Countries without a mapped outline (microstates) fall back to
 * their reference point. `nearest` is where the measurement lands, for drawing the result line.
 */
export function distanceToTerritory(pin: Coordinates, target: { geometryId: string | null; point: Coordinates | null; radiusKm?: number }, shapes?: CountryShapes): { distanceKm: number; nearest: Coordinates } {
  const polygons = target.geometryId ? shapes?.get(target.geometryId) : undefined;
  if (!polygons?.length) {
    if (!target.point) throw new Error("This round has no point target.");
    const centerDistance = haversineKm(pin, target.point), radius = target.radiusKm ?? 15;
    if (centerDistance <= radius) return { distanceKm: 0, nearest: pin };
    if (!radius) return { distanceKm: centerDistance, nearest: target.point };
    // The displayed distance line ends at the city target's edge, not its center.
    const nearest = pointAlongGreatCircle(target.point, pin, radius);
    return { distanceKm: Math.max(0, centerDistance - radius), nearest };
  }
  // A ring inside the outer ring is a hole (lakes, enclaves such as Lesotho in South Africa).
  if (polygons.some(([outer, ...holes]) => insideRing(pin, outer) && !holes.some((hole) => insideRing(pin, hole)))) return { distanceKm: 0, nearest: pin };
  let best = { distanceKm: Infinity, nearest: pin };
  for (const rings of polygons) for (const ring of rings) for (let index = 1; index < ring.length; index += 1) {
    const nearest = nearestOnSegment(pin, ring[index - 1], ring[index]);
    const distanceKm = haversineKm(pin, nearest);
    if (distanceKm < best.distanceKm) best = { distanceKm, nearest };
  }
  return best;
}
