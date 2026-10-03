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

/** Closest point of segment a–b to the pin, measured in a local equirectangular frame around the pin. */
function nearestOnSegment(point: Coordinates, a: Coordinates, b: Coordinates): Coordinates {
  const wrap = (longitude: number) => longitude - 360 * Math.round((longitude - point[0]) / 360);
  const k = Math.cos(point[1] * Math.PI / 180);
  const ax = wrap(a[0]) * k, ay = a[1], bx = wrap(b[0]) * k, by = b[1], px = point[0] * k, py = point[1];
  const length = (bx - ax) ** 2 + (by - ay) ** 2;
  const t = length ? Math.max(0, Math.min(1, ((px - ax) * (bx - ax) + (py - ay) * (by - ay)) / length)) : 0;
  const longitude = (ax + t * (bx - ax)) / (k || 1);
  return [((longitude + 540) % 360) - 180, ay + t * (by - ay)];
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
    const centerDistance = haversineKm(pin, target.point), radius = target.radiusKm ?? 0;
    if (centerDistance <= radius) return { distanceKm: 0, nearest: pin };
    if (!radius) return { distanceKm: centerDistance, nearest: target.point };
    // The displayed distance line ends at the city target's edge, not its center.
    const share = radius / centerDistance;
    const wrappedLongitude = ((pin[0] - target.point[0] + 540) % 360) - 180;
    const nearest: Coordinates = [((target.point[0] + wrappedLongitude * share + 540) % 360) - 180, target.point[1] + (pin[1] - target.point[1]) * share];
    return { distanceKm: Math.max(0, haversineKm(pin, nearest)), nearest };
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
