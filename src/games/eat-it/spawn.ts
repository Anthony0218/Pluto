import { citySlots, cityPropZone } from './cityLayout.ts';
import { EAT, FOOD, isBigProp, playerRadius, FACTORY_TIERS, PLUTO_TIERS, isPluto, type FoodKind, type PowerKind } from './config.ts';
import { distance, validPosition, zoneRadius } from './maps.ts';
import type { GameState, Vec } from './types.ts';
/** Unclaimed sky drops retire after this many seconds (away from players), keeping the rain continuous. */
const SKY_LIFETIME = 45;
export function random(state: GameState): number {
  let x = state.rng | 0; x ^= x << 13; x ^= x >>> 17; x ^= x << 5;
  state.rng = x >>> 0; return state.rng / 4294967296;
}
const tables = (['city', 'nature'] as const).reduce((result, map) => {
  result[map] = (Object.keys(FOOD) as FoodKind[]).flatMap(kind => Array.from({ length: FOOD[kind].rarity[map] }, () => kind));
  return result;
}, {} as Record<GameState['map'], FoodKind[]>);
tables.nature.push('car', 'car', 'taxi');
tables.nature = tables.nature.filter(k => !FOOD[k].building);
tables.candy = [...tables.city.filter(k => !FOOD[k].building && FOOD[k].shape !== 'vehicle'), ...Array<FoodKind>(24).fill('candyMint'), ...Array<FoodKind>(18).fill('chocolate'), ...Array<FoodKind>(14).fill('jelly'), 'car', 'taxi', 'bus', 'giantCandy', 'giantCandy', 'chocolateStack', 'giantCupcake', 'jellyMountain'];
tables.frozen = [...tables.nature.filter(k => FOOD[k].shape !== 'forestLandmark'), ...Array<FoodKind>(22).fill('snowCone'), ...Array<FoodKind>(16).fill('iceCrystal'), 'car', 'taxi', 'iceBlock', 'iceBlock', 'iceberg', 'iceberg', 'glacier'];
export function spawnPosition(state: GameState, radius: number, sector = state.spawnSector++ % 12, kind?: FoodKind, ignoreSmall = false): (Vec & { rotation?: number }) | null {
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
    if (state.food.some(f => (!ignoreSmall || f.target || f.delivery || isBigProp(f.kind) || FOOD[f.kind].shape === 'factory') && distance(p, f) < FOOD[f.kind].radius + radius + 3) || state.powerups.some(f => distance(p, f) < radius + 30)) continue;
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
/** City blocks are filled with houses and towers before loose props, so every frontage row is built up. */
export function spawnCityBuildings(state: GameState): void {
  const kinds = tables.city.filter(kind => FOOD[kind].building);
  for (let attempt = 0, placed = 0; attempt < EAT.food.cityBuildings * 3 && placed < EAT.food.cityBuildings; attempt++) {
    const kind = kinds[Math.floor(random(state) * kinds.length)], p = spawnPosition(state, FOOD[kind].radius, attempt % 12, kind);
    if (!p) continue;
    state.food.push({ ...p, id: state.nextId++, kind, vx: 0, vy: 0, z: 0, vz: 0, rotation: p.rotation ?? 0, target: null, capturedAt: 0 }); placed++;
  }
}
/** Replaces an eaten big prop. Some crash down from the sky; vehicles and city buildings still use their slots. */
export function spawnBig(state: GameState): boolean {
  const kinds = tables[state.map].filter(isBigProp);
  const kind = kinds[Math.floor(random(state) * kinds.length)], p = spawnPosition(state, FOOD[kind].radius, undefined, kind, true);
  if (!p) return false;
  // Small loose props under the new footprint are crushed/cleared rather than blocking the spot.
  const clear = FOOD[kind].radius + 3;
  state.food = state.food.filter(f => f.target || f.delivery || isBigProp(f.kind) || FOOD[f.kind].shape === 'factory' || distance(p, f) >= clear + FOOD[f.kind].radius);
  const sky = random(state) < EAT.food.bigSkyChance;
  state.food.push({ ...p, id: state.nextId++, kind, vx: 0, vy: 0, z: sky ? 520 + random(state) * 240 : 0, vz: 0, rotation: p.rotation ?? (random(state) - 0.5) * Math.PI, target: null, capturedAt: 0 });
  return true;
}
export function updateSpawns(state: GameState): void {
  // Only invalid or escaped bodies retire. Claimed and quest-delivery objects keep their authority lifecycle.
  state.food = state.food.filter(f => f.target || f.delivery || (Number.isFinite(f.x+f.y+f.z+f.vx+f.vy+f.vz) && f.x >= 0 && f.y >= 0 && f.x <= EAT.match.width && f.y <= EAT.match.height));
  state.food = state.food.filter(f => f.target || f.delivery || f.expiresAt !== undefined || f.spawnedAt === undefined || state.time-f.spawnedAt < SKY_LIFETIME || state.players.some(p=>p.alive && distance(p,f)<playerRadius(p,state.time)+180));
  if (state.nextFactory !== undefined && state.time >= state.nextFactory) { state.nextFactory = state.time + EAT.factories.interval; spawnFactory(state); }
  if (state.time >= state.nextFood) { state.nextFood = state.time + EAT.food.respawnInterval; // Ordinary sky rain leaves headroom under the cap so eaten big props can always come back.
    for (let i = 0; i < EAT.food.skyDropsPerTick && state.food.length < EAT.food.maxObjects - (state.bigTarget === undefined ? 0 : EAT.food.bigReserve); i++) spawnFood(state); }
  if (state.bigTarget !== undefined && state.time >= (state.nextBig ?? 0)) {
    state.nextBig = state.time + EAT.food.bigRespawnInterval;
    // Up to two replacements per interval (four attempts) while below the starting count.
    const missing = state.bigTarget - state.food.filter(f => isBigProp(f.kind)).length;
    for (let attempt = 0, placed = 0; attempt < 4 && placed < Math.min(2, missing) && state.food.length < EAT.food.maxObjects; attempt++) if (spawnBig(state)) placed++;
  }
  if (state.time >= state.nextPower) {
    state.nextPower = state.time + EAT.powerups.spawnInterval;
    if (state.powerups.length >= EAT.powerups.maxObjects) return;
    const p = spawnPosition(state, EAT.powerups.radius);
    if (p) {
      // Weighted per attempt: rare growth items, frequent Strike, a rare Shield, otherwise Speed/Magnet.
      let roll = random(state) * 100, kind: PowerKind = 'speed';
      for (const rare of ['shock', 'divider', 'multiplier', 'strike', 'shield'] as const) { roll -= EAT.powerups[rare].weight; if (roll < 0) { kind = rare; break; } }
      if (roll >= 0) kind = random(state) < .5 ? 'speed' : 'magnet';
      if (kind === 'shock' || kind === 'multiplier' || kind === 'divider' || kind === 'strike' || kind === 'shield') {
        const config = EAT.powerups[kind]; state.nextRare ??= {};
        if (state.time < (state.nextRare[kind] ?? (kind === 'shock' ? 30 : config.cooldown)) || state.powerups.filter(p => p.kind === kind).length >= config.maxActive) return;
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
  if (state.settings?.plutoEnabled === false || state.phase !== 'normal' || state.food.length >= EAT.food.maxObjects || state.food.filter(f => isPluto(f.kind)).length >= EAT.pluto.maxActive) return false;
  const kind = choosePluto(state), radius = FOOD[kind].radius;
  const at = spawnPosition(state, radius + 20);
  if (!at || state.spawnLocations?.some(p => distance(at, p) < radius + 110)) return false;
  state.food.push({ ...at, kind, id: state.nextId++, vx: 0, vy: 0, z: 0, vz: 0, rotation: 0, target: null, capturedAt: 0 }); return true;
}

/** Four footprint tiers make the next generous meal visible throughout progression. */
export function spawnFactory(state: GameState, tier?: number): boolean {
  if (!['city', 'frozen'].includes(state.map) || state.phase !== 'normal' || state.food.length >= EAT.food.maxObjects || state.food.filter(f => FOOD[f.kind].shape === 'factory').length >= EAT.factories.maxActive) return false;
  // Smaller factories are more common; the skyscraper remains a rare jackpot.
  const roll = tier === undefined ? random(state) : 0;
  const kind = FACTORY_TIERS[tier ?? (roll < .45 ? 0 : roll < .75 ? 1 : roll < .93 ? 2 : 3)];
  const at = spawnPosition(state, FOOD[kind].radius, undefined, kind, true);
  if (!at) return false;
  state.food = state.food.filter(f => f.target || f.delivery || FOOD[f.kind].shape === 'factory' || isBigProp(f.kind) || distance(at, f) >= FOOD[kind].radius + FOOD[f.kind].radius + 8);
  state.food.push({ ...at, kind, id: state.nextId++, vx: 0, vy: 0, z: 0, vz: 0, rotation: at.rotation ?? 0, target: null, capturedAt: 0 });
  return true;
}
