import { EAT, FOOD, POWER_KINDS, massToRadius, type FoodKind } from './config.ts';
import { distance, validPosition, zoneRadius } from './maps.ts';
import type { GameState, Vec } from './types.ts';
export function random(state: GameState): number {
  let x = state.rng | 0; x ^= x << 13; x ^= x >>> 17; x ^= x << 5;
  state.rng = x >>> 0; return state.rng / 4294967296;
}
const tables: Record<GameState['map'], FoodKind[]> = {
  city: ['berry', 'berry', 'apple', 'apple', 'donut', 'soda', 'fries', 'cupcake', 'burger', 'pizza'],
  nature: ['berry', 'berry', 'berry', 'mushroom', 'mushroom', 'apple', 'apple', 'donut', 'burger', 'melon'],
};
export function spawnPosition(state: GameState, radius: number, sector = state.spawnSector++ % 12): Vec | null {
  for (let attempt = 0; attempt < 80; attempt++) {
    // Cycle twelve regions so valuable objects are distributed across the whole map.
    const cell = attempt < 35 ? sector : Math.floor(random(state) * 12);
    const p = { x: (cell % 4 + random(state)) * EAT.match.width / 4, y: (Math.floor(cell / 4) + random(state)) * EAT.match.height / 3 };
    if (!validPosition(state.map, p, radius + 6)) continue;
    if (distance(p, { x: EAT.match.width / 2, y: EAT.match.height / 2 }) > zoneRadius(state.time) - radius) continue;
    if (state.players.some(player => player.alive && distance(p, player) < massToRadius(player.mass) + radius + 28)) continue;
    if (state.food.some(f => distance(p, f) < FOOD[f.kind].radius + radius + 3) || state.powerups.some(f => distance(p, f) < radius + 30)) continue;
    return p;
  }
  return null;
}
export function spawnFood(state: GameState, initial = false): boolean {
  if (state.food.length >= EAT.food.maxObjects) return false;
  const table = tables[state.map], kind = table[Math.floor(random(state) * table.length)];
  const p = spawnPosition(state, FOOD[kind].radius);
  if (!p) return false;
  state.food.push({ ...p, id: state.nextId++, kind, vx: (random(state) - 0.5) * 35, vy: (random(state) - 0.5) * 35,
    z: initial ? 0 : 50 + random(state) * 35, vz: 0, rotation: (random(state) - 0.5) * 0.7, target: null, capturedAt: 0 });
  return true;
}
export function updateSpawns(state: GameState): void {
  if (state.time >= state.nextFood) { state.nextFood = state.time + EAT.food.respawnInterval; if (state.food.length < EAT.food.spawnCount) spawnFood(state); }
  if (state.time >= state.nextPower) {
    state.nextPower = state.time + EAT.powerups.spawnInterval;
    if (state.powerups.length >= EAT.powerups.maxObjects) return;
    const p = spawnPosition(state, EAT.powerups.radius);
    if (p) state.powerups.push({ ...p, id: state.nextId++, kind: POWER_KINDS[Math.floor(random(state) * POWER_KINDS.length)] });
  }
}
