import type { District } from "../../../games/MedievalKingdoms/edravane/types.ts";
import { center } from "../../../games/MedievalKingdoms/edravane/world.ts";

// 100% is the responsive fit of the playable world between the map panels.
export const MIN_MAP_ZOOM = 1;
export const MAX_MAP_ZOOM = 4;
export const clampMapZoom = (zoom: number) => Math.max(MIN_MAP_ZOOM, Math.min(MAX_MAP_ZOOM, zoom));

/** Overscan and bucket the view so normal dragging reuses the same SVG fields. */
export function mapViewport(camera: [number, number], origin: number[], scale: number, frame: { width: number; height: number }) {
  const padding = 100, bucket = 100;
  return [
    Math.floor((camera[0] - origin[0] / scale - padding) / bucket) * bucket,
    Math.floor((camera[1] - origin[1] / scale - padding) / bucket) * bucket,
    Math.ceil((camera[0] + (frame.width - origin[0]) / scale + padding) / bucket) * bucket,
    Math.ceil((camera[1] + (frame.height - origin[1]) / scale + padding) / bucket) * bucket,
  ].join(",");
}

export function visibleMapDistricts(districts: District[], viewport: string) {
  if (!viewport) return districts;
  const [minX, minY, maxX, maxY] = viewport.split(",").map(Number);
  return districts.filter((d) => {
    const [x, y] = center(d);
    return x >= minX && x <= maxX && y >= minY && y <= maxY;
  });
}
