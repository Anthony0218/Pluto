import type { Vec } from './naturaData';
export type FoodSite = Vec & { id: number; cooldown: number };
export const createFoodSites = (points: Vec[]): FoodSite[] => points.map((point, id) => ({ ...point, id, cooldown: 0 }));
export function nearestFood(sites: FoodSite[], point: Vec): FoodSite | undefined {
  return sites.filter(site => site.cooldown <= 0).reduce<FoodSite | undefined>((best, site) => !best || Math.hypot(site.x - point.x, site.y - point.y) < Math.hypot(best.x - point.x, best.y - point.y) ? site : best, undefined);
}
/** Both participants are resolved together. A tie splits ONE meal; order never wins. */
export function collectSharedFood(sites: FoodSite[], players: [Vec & { food: number }, Vec & { food: number }], eligible: [boolean, boolean], radius: number, dt: number): boolean {
  let collected = false;
  sites.forEach(site => {
    if (site.cooldown > 0) { site.cooldown = Math.max(0, site.cooldown - dt); return; }
    const distances = players.map((player, i) => eligible[i] ? Math.hypot(player.x - site.x, player.y - site.y) : Infinity);
    const nearest = Math.min(...distances);
    if (nearest > radius) return;
    const tied = Math.abs(distances[0] - distances[1]) < 0.5;
    players.forEach((player, i) => { if (tied || distances[i] === nearest) player.food += tied ? 0.5 : 1; });
    site.cooldown = 5;
    collected = true;
  });
  return collected;
}
