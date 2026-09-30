import { citySlots, cityPropZone } from './cityLayout.ts';
import { EAT, FOOD, playerRadius, PLUTO_TIERS, isPluto, type FoodKind } from './config.ts';
import { distance, validPosition, zoneRadius } from './maps.ts';
import type { GameState, Vec } from './types.ts';
export function random(state: GameState): number {
  let x = state.rng | 0; x ^= x << 13; x ^= x >>> 17; x ^= x << 5;
  state.rng = x >>> 0; return state.rng / 4294967296;
}
const tables = (['city', 'nature'] as const).reduce((result, map) => {
  result[map] = (Object.keys(FOOD) as FoodKind[]).flatMap(kind => Array.from({ length: FOOD[kind].rarity[map] }, () => kind));
  return result;
}, {} as Record<GameState['map'], FoodKind[]>);
export function spawnPosition(state: GameState, radius: number, sector = state.spawnSector++ % 12, kind?: FoodKind): (Vec & { rotation?: number }) | null {
  if (state.phase && state.phase !== 'normal') return null;
  const slots = state.map === 'city' && kind && (FOOD[kind].building || FOOD[kind].shape === 'vehicle') ? citySlots(kind) : null;
  for (let attempt = 0; attempt < 80; attempt++) {
    // Cycle twelve regions so valuable objects are distributed across the whole map.
    const cell = attempt < 35 ? sector : Math.floor(random(state) * 12);
    const p = slots ? slots[Math.floor(random(state)*slots.length)] : { x: (cell % 4 + random(state)) * EAT.match.width / 4, y: (Math.floor(cell / 4) + random(state)) * EAT.match.height / 3 };
    if (!p || (state.map === 'city' && kind && !slots && !cityPropZone(kind,p))) continue;
    if (state.encounter && !['gone', 'leaving', 'devoured', 'swallowing'].includes(state.encounter.npc.phase) && distance(p, state.encounter.npc) < radius + Math.max(50, (state.encounter.npc.kind === 'pigeon' ? 16 : 22) * (state.encounter.npc.scale ?? 1))) continue;
    if (state.encounter?.shrine && distance(p, state.encounter.shrine) < radius + 135) continue;
    if (state.encounter && distance(p, state.encounter.item.home) < radius + 40) continue;
    if (!validPosition(state.map, p, radius + 6)) continue;
    if (!state.settings?.matchDuration && !state.settings?.hellEnabled && distance(p, { x: EAT.match.width / 2, y: EAT.match.height / 2 }) > zoneRadius(state.time) - radius) continue;
    if (state.players.some(player => player.alive && distance(p, player) < playerRadius(player, state.time) + radius + (state.time === 0 && radius > 45 ? 110 : 28))) continue;
    if (state.food.some(f => distance(p, f) < FOOD[f.kind].radius + radius + 3) || state.powerups.some(f => distance(p, f) < radius + 30)) continue;
    return p;
  }
  return null;
}
export function spawnFood(state: GameState, initial = false): boolean {
  if (state.food.length >= EAT.food.maxObjects) return false;
  const sector = state.spawnSector++ % 12, zone = sector % 4;
  // Four interleaved districts: market/meadow, park/forest, residential/cabins, street/rocks.
  const preferred = state.map === 'city'
    ? [['tiny', 'small'], ['medium'], ['huge', 'very-large'], ['large', 'medium']][zone]
    : [['tiny', 'small'], ['medium', 'large'], ['huge', 'very-large'], ['small', 'medium']][zone];
  const base = tables[state.map].filter(k => initial || FOOD[k].skyDrop);
  if (!initial) {
    // Sky rain: 60% tiny/small, 32% medium, 8% large; no structures or vehicles.
    const roll = random(state), tiers = roll < .6 ? ['tiny','small'] : roll < .92 ? ['medium'] : ['large'];
    preferred.splice(0, preferred.length, ...tiers);
  }
  const table = random(state) < (initial ? .65 : 1) ? base.filter(k => preferred.includes(FOOD[k].category)) : base;
  const kind = table[Math.floor(random(state) * table.length)];
  const p = spawnPosition(state, FOOD[kind].radius, sector, kind);
  if (!p) return false;
  const settled = FOOD[kind].mass >= 70;
  state.food.push({ ...p, id: state.nextId++, kind, vx: settled ? 0 : (random(state) - 0.5) * 35, vy: settled ? 0 : (random(state) - 0.5) * 35,
    ...(initial ? {} : { spawnedAt: state.time }), z: initial ? 0 : 280 + random(state) * 180, vz: 0, rotation: p.rotation ?? (random(state) - 0.5) * Math.PI, target: null, capturedAt: 0 });
  return true;
}
export function updateSpawns(state: GameState): void {
  // Only invalid or escaped bodies retire. Claimed and quest-delivery objects keep their authority lifecycle.
  state.food = state.food.filter(f => f.target || f.delivery || (Number.isFinite(f.x+f.y+f.z+f.vx+f.vy+f.vz) && f.x >= 0 && f.y >= 0 && f.x <= EAT.match.width && f.y <= EAT.match.height));
  state.food = state.food.filter(f => f.target || f.delivery || f.spawnedAt === undefined || state.time-f.spawnedAt < 90 || state.players.some(p=>p.alive && distance(p,f)<playerRadius(p,state.time)+180));
  if (state.settings?.plutoEnabled && state.time >= (state.nextPluto ?? 0)) { state.nextPluto = state.time + EAT.pluto.interval; spawnPluto(state); }
  if (state.time >= state.nextFood) { state.nextFood = state.time + EAT.food.respawnInterval; if (state.food.length < EAT.food.maxObjects) spawnFood(state); }
  if (state.time >= state.nextPower) {
    state.nextPower = state.time + EAT.powerups.spawnInterval;
    if (state.powerups.length >= EAT.powerups.maxObjects) return;
    const p = spawnPosition(state, EAT.powerups.radius);
    if (p) {
      const roll = random(state) * 100;
      const kind = roll < EAT.powerups.divider.weight ? 'divider' : roll < EAT.powerups.divider.weight + EAT.powerups.multiplier.weight ? 'multiplier' : roll < EAT.powerups.divider.weight + EAT.powerups.multiplier.weight + EAT.powerups.strike.weight ? 'strike' : (['speed', 'shield', 'magnet'] as const)[Math.floor(random(state) * 3)];
      if (kind === 'multiplier' || kind === 'divider' || kind === 'strike') {
        const config = EAT.powerups[kind]; state.nextRare ??= {};
        if (state.time < (state.nextRare[kind] ?? config.cooldown) || state.powerups.filter(p => p.kind === kind).length >= config.maxActive) return;
        state.nextRare[kind] = state.time + config.cooldown;
      }
      state.powerups.push({ ...p, id: state.nextId++, kind });
    }
  }
}

export function choosePluto(state: GameState): FoodKind {
  let roll = random(state) * 100;
  for (const tier of PLUTO_TIERS) { roll -= tier.weight; if (roll < 0) return tier.kind; }
  return 'plutoGiant';
}
export function spawnPluto(state: GameState): boolean {
  if (!state.settings?.plutoEnabled || state.phase !== 'normal' || state.food.length >= EAT.food.maxObjects || state.food.filter(f => isPluto(f.kind)).length >= EAT.pluto.maxActive) return false;
  const kind = choosePluto(state), radius = FOOD[kind].radius;
  const at = spawnPosition(state, radius + 20);
  if (!at || state.spawnLocations?.some(p => distance(at, p) < radius + 110)) return false;
  state.food.push({ ...at, kind, id: state.nextId++, vx: 0, vy: 0, z: 0, vz: 0, rotation: 0, target: null, capturedAt: 0 }); return true;
}
