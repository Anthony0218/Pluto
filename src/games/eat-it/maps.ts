import { EAT } from './config.ts';
import type { MapId, Obstacle, Vec } from './types.ts';
// Water is terrain. All ordinary raised scenery lives in the physical food catalog.
const nature: Obstacle[] = [
  { x: 2560, y: 0, w: 190, h: 1040, kind: 'water' },
  { x: 2560, y: 1760, w: 190, h: 1280, kind: 'water' },
];
export const obstaclesFor = (map: MapId): readonly Obstacle[] => map === 'nature' ? nature : [];
export const clamp = (v: number, min: number, max: number) => Math.max(min, Math.min(max, v));
export const distance = (a: Vec, b: Vec) => Math.hypot(a.x - b.x, a.y - b.y);
export function circleHitsRect(p: Vec, radius: number, rect: Obstacle): boolean {
  return Math.hypot(p.x - clamp(p.x, rect.x, rect.x + rect.w), p.y - clamp(p.y, rect.y, rect.y + rect.h)) < radius;
}
export function validPosition(map: MapId, p: Vec, radius: number): boolean {
  return p.x >= radius && p.y >= radius && p.x <= EAT.match.width - radius && p.y <= EAT.match.height - radius && !obstaclesFor(map).some(o => circleHitsRect(p, radius + 4, o));
}
export function resolveWalls(map: MapId, p: Vec, radius: number, passWater = false): void {
  for (const o of obstaclesFor(map)) {
    if (passWater && o.kind === "water") continue;
    const x = clamp(p.x, o.x, o.x + o.w), y = clamp(p.y, o.y, o.y + o.h);
    const dx = p.x - x, dy = p.y - y, d = Math.hypot(dx, dy);
    if (d >= radius) continue;
    if (d > 0) { p.x += dx / d * (radius - d); p.y += dy / d * (radius - d); }
    else {
      const sides = [{ d: p.x - o.x, x: o.x - radius, y: p.y }, { d: o.x + o.w - p.x, x: o.x + o.w + radius, y: p.y }, { d: p.y - o.y, x: p.x, y: o.y - radius }, { d: o.y + o.h - p.y, x: p.x, y: o.y + o.h + radius }];
      sides.sort((a, b) => a.d - b.d); p.x = sides[0].x; p.y = sides[0].y;
    }
  }
  p.x = clamp(p.x, radius, EAT.match.width - radius); p.y = clamp(p.y, radius, EAT.match.height - radius);
}
/** Local line-of-sight is shared by mouth sensors and bots; food never crosses scenery. */
export function clearPath(map: MapId, a: Vec, b: Vec, radius = 2): boolean {
  const steps = Math.max(1, Math.ceil(distance(a, b) / 20));
  for (let i = 1; i <= steps; i++) {
    const t = i / steps;
    if (!validPosition(map, { x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t }, radius)) return false;
  }
  return true;
}
export function zoneRadius(time: number): number {
  return Math.max(0, Math.hypot(EAT.match.width, EAT.match.height) / 2 * (1 - Math.max(0, time - EAT.match.zoneStart) / (EAT.match.zoneEnd - EAT.match.zoneStart)));
}
