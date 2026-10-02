import { treeGeometry } from './treeGeometry.ts';
import { EAT, FOOD, playerRadius } from './config.ts';
import { clearPath } from './maps.ts';
import type { FoodObject, MapId, Player, Vec } from './types.ts';
export const angleDelta = (a: number, b: number) => Math.atan2(Math.sin(b - a), Math.cos(b - a));
// These constants also draw the inner lip. The mouth occupies most of the body.
export const MOUTH = { offset: .08, radius: .82, threshold: .12 } as const;
export const mouthPosition = (p: Player, radius = playerRadius(p, 0)): Vec => ({ x: p.x + Math.cos(p.facing) * radius * MOUTH.offset, y: p.y + Math.sin(p.facing) * radius * MOUTH.offset });
export const mouthOpening = (p: Player, time = 0) => 2 * MOUTH.radius * playerRadius(p, time);
export function mouthCoordinates(p: Player, target: Vec) {
  const dx = target.x - p.x, dy = target.y - p.y;
  return { forward: dx * Math.cos(p.facing) + dy * Math.sin(p.facing), side: -dx * Math.sin(p.facing) + dy * Math.cos(p.facing) };
}
export const isChoking = (p: Player, time: number) => (p.chokingUntil ?? 0) > time;
/** Tree models use a narrow trunk below a separately sized canopy. */
export const treeParts = (kind: FoodObject['kind']) => FOOD[kind].shape === 'tree'
  ? { trunkArea: Math.PI * treeGeometry(kind).trunkRadius ** 2, canopyArea: Math.PI * treeGeometry(kind).canopyX * treeGeometry(kind).canopyZ }
  : null;
export function canopyFits(p: Player, f: Pick<FoodObject, 'kind'>, time = 0) {
  const info = FOOD[f.kind];
  if (treeParts(f.kind)) return canObjectFitMouth(p, f, time, 'canopy');
  return info.width * info.height <= Math.PI * (mouthOpening(p, time) / 2) ** 2 + 1e-6;
}
/** Circular opening: rotation does not change an ellipsoid's largest horizontal radius. */
export function canObjectFitMouth(p: Player, f: Pick<FoodObject, 'kind'>, time = 0, part: 'trunk' | 'canopy' = 'canopy') {
  const g = treeGeometry(f.kind), radius = mouthOpening(p, time) / 2;
  return (part === 'trunk' ? g.trunkRadius : Math.max(g.canopyX, g.canopyZ)) <= radius + 1e-6;
}
export function eyeProportion(radius: number) {
  return .105 + .10 * Math.exp(-Math.max(0, radius - 14) / 55);
}
/** Compare footprint area with the circular opening, independent of orientation. */
export function foodFits(p: Player, f: Pick<FoodObject, 'kind'>, time = 0) {
  const info = FOOD[f.kind], radius = mouthOpening(p, time) / 2;
  if (treeParts(f.kind)) return canObjectFitMouth(p, f, time, 'trunk');
  return info.devourArea <= Math.PI * radius * radius + 1e-6;
}
export function overFoodMouth(p: Player, target: Vec, time = 0): boolean {
  const r = playerRadius(p, time), mouth = mouthPosition(p, r);
  return Math.hypot(target.x - mouth.x, target.y - mouth.y) <= r * MOUTH.radius * .98;
}
export function inMouth(p: Player, target: Vec, targetRadius: number, extraRange = 0, time = 0): boolean {
  const r = playerRadius(p, time), { forward, side } = mouthCoordinates(p, target);
  // Majority of the object must cross the FRONT lip; no rear or grazing bites.
  return forward >= r * MOUTH.threshold && forward <= r * .68 + extraRange &&
    Math.abs(side) + targetRadius * .8 < r * MOUTH.radius;
}
/** Penetration along the mouth-to-object axis, normalized by the rotated footprint's full span. */
export function mouthEntryProgress(p: Player, f: FoodObject, time = 0) {
  const m = mouthPosition(p, playerRadius(p, time)), dx = m.x-f.x, dy = m.y-f.y, d = Math.hypot(dx,dy);
  if (d < .001) return 1;
  const c = Math.cos(f.rotation), s = Math.sin(f.rotation), info = FOOD[f.kind];
  const extent = Math.abs(dx/d*c+dy/d*s)*info.width/2 + Math.abs(-dx/d*s+dy/d*c)*info.height/2;
  return Math.max(0, Math.min(1, (playerRadius(p,time)*MOUTH.radius + extent-d)/(2*extent)));
}
export const largeSwallow = (f: Pick<FoodObject, 'kind'>) => FOOD[f.kind].building || ['vehicle','tree'].includes(FOOD[f.kind].shape) || FOOD[f.kind].mass >= 180;
export function entersMouth(p: Player, f: FoodObject, time: number): boolean {
  if (f.stuck || f.spit || !p.alive || p.escape || p.ability?.kind === 'jump' || p.fallingAt !== undefined || isChoking(p, time) || (f.availableAt ?? 0) > time || (f.rewardOwner && f.rewardOwner !== p.id) || f.target || !foodFits(p, f, time)) return false;
  // Fitting props fall once their center crosses the visible opening, even
  // during a turn or sideways approach. Airborne props must reach the lip first.
  const m = mouthPosition(p, playerRadius(p,time));
  const inward = (f.vx-p.vx)*(m.x-f.x)+(f.vy-p.vy)*(m.y-f.y);
  const entered = FOOD[f.kind].shape !== 'tree' && largeSwallow(f) && canopyFits(p,f,time)
    ? mouthEntryProgress(p,f,time) >= .25 && inward >= -1e-6
    : overFoodMouth(p, f, time);
  return entered && f.z <= 12 && (f.z <= 1 || f.vz < 0);
}
export function playerFits(attacker: Player, victim: Player, time: number): boolean {
  const a = playerRadius(attacker, time), b = playerRadius(victim, time);
  // Size is radius/diameter, NOT mass: 130% size requires 1.30² = 1.69 times
  // mass without size effects/caps. A victim also has to fit the visible opening.
  return attacker.ability?.kind !== 'jump' && victim.ability?.kind !== 'jump' && !attacker.escape && !victim.escape && attacker.fallingAt === undefined && victim.fallingAt === undefined && !isChoking(attacker, time) && attacker.id !== victim.id && attacker.alive && victim.alive && victim.effects.shield <= time &&
    a + 1e-6 >= b * EAT.eating.playerEatRadiusRatio && b * 2 < mouthOpening(attacker, time);
}
export function playerEntrance(attacker: Player, victim: Player, time: number): boolean {
  const local = mouthCoordinates(attacker, victim);
  return playerFits(attacker, victim, time) && local.forward > 0 &&
    Math.abs(local.side) + playerRadius(victim, time) * .8 < playerRadius(attacker, time) * MOUTH.radius;
}
export function canEatPlayer(attacker: Player, victim: Player, time: number, map?: MapId): boolean {
  const inward = (victim.vx - attacker.vx) * Math.cos(attacker.facing) + (victim.vy - attacker.vy) * Math.sin(attacker.facing);
  return playerFits(attacker, victim, time) && inward <= 1 &&
    inMouth(attacker, victim, playerRadius(victim, time), 0, time) && (!map || clearPath(map, attacker, victim));
}
export const consumptionDuration = (f: Pick<FoodObject, 'kind'>) => FOOD[f.kind].shape === 'tree' ? EAT.eating.treeAnimation : largeSwallow(f) ? 1.15 : EAT.eating.foodAnimation;
