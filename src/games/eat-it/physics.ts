import { FOOD } from './config.ts';
import type { FoodObject, Vec } from './types.ts';
const CELL = 128;
const MAX_RADIUS = Math.max(...Object.values(FOOD).map(info => info.radius));
/** Circle against the rotated footprint; the diagonal radius is broad-phase only.
 * The returned normal points from the player into the prop. */
export function objectContact(p: Vec, radius: number, f: FoodObject, footprint = FOOD[f.kind].physicalFootprint) {
  const cos = Math.cos(f.rotation), sin = Math.sin(f.rotation);
  const dx = p.x - f.x, dy = p.y - f.y;
  const x = dx * cos + dy * sin, y = -dx * sin + dy * cos;
  const hw = footprint.width / 2, hh = footprint.height / 2;
  const cx = Math.max(-hw, Math.min(hw, x)), cy = Math.max(-hh, Math.min(hh, y));
  const distance = Math.hypot(cx - x, cy - y);
  if (distance >= radius) return null;
  let nx: number, ny: number, overlap: number;
  if (distance > 1e-6) {
    nx = (cx - x) / distance; ny = (cy - y) / distance; overlap = radius - distance;
  } else if (hw - Math.abs(x) < hh - Math.abs(y)) {
    nx = x >= 0 ? -1 : 1; ny = 0; overlap = radius + hw - Math.abs(x);
  } else {
    nx = 0; ny = y >= 0 ? -1 : 1; overlap = radius + hh - Math.abs(y);
  }
  return { nx: nx * cos - ny * sin, ny: nx * sin + ny * cos, overlap };
}
/** Capped props use circular broad-phase colliders, never per-pixel meshes.
 * Only awake props query the grid; buildings and settled props remain asleep. */
export function collideObjects(food: FoodObject[]) {
  const grid = new Map<string, FoodObject[]>();
  for (const f of food) {
    if (f.citizen || f.driverId || f.leap || f.stuck || f.spit || f.target || f.z > 8) continue;
    const key = `${Math.floor(f.x / CELL)},${Math.floor(f.y / CELL)}`;
    const bucket = grid.get(key); if (bucket) bucket.push(f); else grid.set(key, [f]);
  }
  const seen = new Set<string>();
  for (const a of food) {
    const ai = FOOD[a.kind];
    if (a.citizen || a.driverId || a.leap || a.stuck || a.spit || a.target || a.z > 8 || Math.hypot(a.vx, a.vy) < 1) continue;
    const reach = ai.radius + MAX_RADIUS;
    for (let x = Math.floor((a.x - reach) / CELL); x <= Math.floor((a.x + reach) / CELL); x++) {
      for (let y = Math.floor((a.y - reach) / CELL); y <= Math.floor((a.y + reach) / CELL); y++) {
        for (const b of grid.get(`${x},${y}`) ?? []) {
          if (a === b) continue;
          const key = a.id < b.id ? `${a.id}:${b.id}` : `${b.id}:${a.id}`;
          if (seen.has(key)) continue; seen.add(key);
          const bi = FOOD[b.kind], dx = b.x - a.x, dy = b.y - a.y, d = Math.hypot(dx, dy);
          const overlap = ai.radius + bi.radius - d;
          if (overlap <= 0) continue;
          const nx = d > .01 ? dx / d : 1, ny = d > .01 ? dy / d : 0;
          const invA = 1 / ai.mass, invB = 1 / bi.mass, total = invA + invB;
          const correction = Math.max(0, overlap - .05) * .8;
          a.x -= nx * correction * invA / total; a.y -= ny * correction * invA / total;
          b.x += nx * correction * invB / total; b.y += ny * correction * invB / total;
          const approach = (a.vx - b.vx) * nx + (a.vy - b.vy) * ny;
          if (approach <= 0) continue;
          const impulse = approach * (1 + Math.min(ai.bounce, bi.bounce)) / total;
          a.vx -= nx * impulse * invA; a.vy -= ny * impulse * invA;
          b.vx += nx * impulse * invB; b.vy += ny * impulse * invB;
          a.rotation += (a.vx * ny - a.vy * nx) * .001;
          b.rotation += (b.vx * ny - b.vy * nx) * .001;
        }
      }
    }
  }
}
