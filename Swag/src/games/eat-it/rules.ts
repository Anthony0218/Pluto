import { EAT, FOOD, massToRadius } from './config.ts';
import { clearPath, distance } from './maps.ts';
import type { FoodObject, MapId, Player, Vec } from './types.ts';
export const angleDelta = (a: number, b: number) => Math.atan2(Math.sin(b - a), Math.cos(b - a));
export const mouthPosition = (p: Player, radius = massToRadius(p.mass)): Vec => ({ x: p.x + Math.cos(p.facing) * radius * 0.65, y: p.y + Math.sin(p.facing) * radius * 0.65 });
export function inMouth(p: Player, target: Vec, targetRadius: number, extraRange = 0): boolean {
  const r = massToRadius(p.mass), d = distance(p, target);
  // A front-facing sector AND a localized mouth sensor; rear/body overlap is harmless.
  return d > r * 0.18 && Math.abs(angleDelta(p.facing, Math.atan2(target.y - p.y, target.x - p.x))) <= EAT.eating.mouthAngle / 2 &&
    distance(mouthPosition(p), target) <= r * 0.44 + targetRadius * 0.55 + EAT.eating.mouthRange + extraRange;
}
export function canEatPlayer(attacker: Player, victim: Player, time: number, map: MapId): boolean {
  return attacker.id !== victim.id && attacker.alive && victim.alive && victim.effects.shield <= time &&
    massToRadius(attacker.mass) + 1e-6 >= massToRadius(victim.mass) * EAT.eating.playerEatRadiusRatio &&
    inMouth(attacker, victim, massToRadius(victim.mass)) && clearPath(map, attacker, victim);
}
export const foodFits = (p: Player, f: Pick<FoodObject, 'kind'>) => FOOD[f.kind].radius <= massToRadius(p.mass) * EAT.eating.foodCapacity;
