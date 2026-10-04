import { beginFall } from './falling.ts';
import { EAT, FOOD, playerRadius, type FoodKind } from './config.ts';
import { objectContact } from './physics.ts';
import { clearPath, distance, validPosition } from './maps.ts';
import { random, spawnPosition } from './spawn.ts';
import type { FoodObject, GameState, MapId, Vec } from './types.ts';

/** Visible surfaces and public food cycles use the same coordinates on every client. */
export { MAPS } from './mapCatalog.ts';
export type SurfacePatch = { x: number; y: number; w: number; h: number; kind: 'belt' | 'ice' | 'snow'; dx?: number; dy?: number };
export const SURFACES: Partial<Record<MapId, SurfacePatch[]>> = {
  candy: [
    { x: 600, y: 700, w: 1100, h: 150, kind: 'belt', dx: 75, dy: 0 },
    { x: 2300, y: 2190, w: 1100, h: 150, kind: 'belt', dx: -75, dy: 0 },
    { x: 1710, y: 1000, w: 150, h: 1000, kind: 'belt', dx: 0, dy: 75 },
    { x: 2140, y: 1000, w: 150, h: 1000, kind: 'belt', dx: 0, dy: -75 },
  ],
  frozen: [
    { x: 525, y: 500, w: 1200, h: 400, kind: 'ice' },
    { x: 2275, y: 2170, w: 1200, h: 400, kind: 'ice' },
    { x: 1700, y: 950, w: 600, h: 1120, kind: 'ice' },
    { x: 525, y: 920, w: 1200, h: 160, kind: 'snow' },
    { x: 2275, y: 1990, w: 1200, h: 160, kind: 'snow' },
    { x: 1480, y: 950, w: 180, h: 1120, kind: 'snow' },
    { x: 2330, y: 950, w: 180, h: 1120, kind: 'snow' },
  ],
};
export const CANDY_MACHINES: Vec[] = [{ x: 520, y: 775 }, { x: 3480, y: 2265 }];
export const FISH_POOLS: Vec[] = [{ x: 2655, y: 560 }, { x: 2655, y: 2400 }];
export function surfaceAt(map: MapId, p: Vec) {
  const patch = SURFACES[map]?.find(s => p.x >= s.x && p.x <= s.x + s.w && p.y >= s.y && p.y <= s.y + s.h);
  return { drag: patch?.kind === 'ice' ? .16 : patch?.kind === 'snow' ? 1.8 : 1,
    speed: patch?.kind === 'ice' ? 1.32 : patch?.kind === 'snow' ? .94 : 1, x: patch?.dx ?? 0, y: patch?.dy ?? 0 };
}
function body(s: GameState, kind: FoodKind, at: Vec): FoodObject {
  return { ...at, kind, id: s.nextId++, vx: 0, vy: 0, z: 0, vz: 0, rotation: 0, target: null, capturedAt: 0, spawnedAt: s.time };
}
/** An encounter is atomic: a failed placement never creates a partial crowd. */
export function spawnHumans(s: GameState): boolean {
  const city = s.map === 'city', count = city ? EAT.humans.cityBatch : EAT.humans.batch;
  const humans = s.food.filter(f => f.kind === 'human');
  if (s.phase !== 'normal' || s.food.length + count > EAT.food.maxObjects || humans.length + count > (city ? EAT.humans.cityMaxActive : EAT.humans.maxActive)) return false;
  const crowdId = city ? [0, 1].find(id => !humans.some(f => f.citizen?.crowdId === id)) : undefined;
  if (city && crowdId === undefined) return false;
  const sector = city ? crowdId === 0 ? 1 : 10 : s.spawnSector++ % 12;
  const center = city ? spawnPosition(s, 180, sector) : null;
  if (city && !center) return false;
  const added: FoodObject[] = [];
  for (let i = 0; i < count; i++) {
    const at = center ? {x:center.x+(i%6-2.5)*32,y:center.y+(Math.floor(i/6)-2)*32} : spawnPosition(s, FOOD.human.radius, sector, 'human');
    if (!at || !validPosition(s.map, at, FOOD.human.radius + 4)) { s.food = s.food.filter(f => !added.includes(f)); return false; }
    const f = body(s, 'human', at); f.citizen = { nextTurn: 0, direction: random(s) * Math.PI * 2, ...(city ? {crowdId} : {}) }; f.expiresAt = s.time + 90;
    added.push(f); s.food.push(f);
  }
  return true;
}
function steer(s: GameState, f: FoodObject, away: number, speed: number, radius: number, car = false) {
  const angles = car && s.map === 'city' ? [f.rotation, f.rotation + Math.PI] : [away, away + .5, away - .5, away + 1, away - 1, away + Math.PI];
  const blockers = s.food.filter(other => other.id !== f.id && !other.target && !other.citizen && other.z < 8 && distance(other,f) < radius + FOOD[other.kind].radius + 175);
  let heading = away, best = -Infinity;
  for (const a of angles) {
    const to = { x: f.x + Math.cos(a) * 160, y: f.y + Math.sin(a) * 160 };
    if (!clearPath(s.map, f, to, radius + 6)) continue;
    const blocked=blockers.some(other=>[.3,.65,1].some(t=>objectContact({x:f.x+(to.x-f.x)*t,y:f.y+(to.y-f.y)*t},radius,other)));
    const score = Math.cos(a - away) - (blocked ? 4 : 0);
    if (score > best) { best = score; heading = a; }
  }
  if (best < -2) { f.vx = f.vy = 0; return; }
  f.vx = Math.cos(heading) * speed; f.vy = Math.sin(heading) * speed; f.rotation = heading;
}
function stepCitizens(s: GameState) {
  const threats = s.players.filter(p => p.alive && !p.escape && p.fallingAt === undefined);
  const alarmedCrowds = new Set<number>();
  if (s.map === 'city') for (const f of s.food) {
    if (f.citizen?.crowdId !== undefined && !f.target && threats.some(p => distance(p, f) < playerRadius(p, s.time) + 500)) alarmedCrowds.add(f.citizen.crowdId);
  }
  for (const f of s.food) {
    if (!f.citizen || f.target || f.z !== 0) continue;
    const threat = threats.slice().sort((a, b) => distance(a, f) - distance(b, f))[0];
    const alarm = threat && (f.citizen.crowdId !== undefined ? alarmedCrowds.has(f.citizen.crowdId) : distance(threat, f) < playerRadius(threat, s.time) + 500);
    const away = alarm ? Math.atan2(f.y - threat.y, f.x - threat.x) : f.citizen.direction;
    const decide = s.time >= f.citizen.nextTurn;
    if (f.citizen.crowdId !== undefined && !alarm && !f.citizen.carId) { f.vx = f.vy = 0; continue; }
    let car = s.food.find(c => c.id === f.citizen!.carId);
    if (car?.target) continue; // Reservation is transferred in ridingCar after mouth contact.
    if (!car && alarm && decide) {
      car = s.food.filter(c => ['car', 'taxi'].includes(c.kind) && !c.target && !c.driverId && c.z === 0 && distance(c, f) < 100).sort((a, b) => distance(a, f) - distance(b, f))[0];
      if (car) { f.citizen.carId = car.id; car.driverId = f.id; }
    }
    if (car) {
      if(decide)steer(s, car, away, EAT.humans.driveSpeed, FOOD[car.kind].radius, true);
      else if(Math.hypot(car.vx,car.vy)>1){car.vx=Math.cos(car.rotation)*EAT.humans.driveSpeed;car.vy=Math.sin(car.rotation)*EAT.humans.driveSpeed;}
      f.x = car.x; f.y = car.y; f.rotation = car.rotation; f.vx = f.vy = 0;
    } else {
      delete f.citizen.carId;
      if(decide){
        if(!alarm)f.citizen.direction+=(random(s)-.5)*.8;
        steer(s,f,alarm?away:f.citizen.direction,alarm?EAT.humans.runSpeed:30,FOOD.human.radius);
      } else if(Math.hypot(f.vx,f.vy)>1){const speed=alarm?EAT.humans.runSpeed:30;f.vx=Math.cos(f.rotation)*speed;f.vy=Math.sin(f.rotation)*speed;}
    }
    if(decide)f.citizen.nextTurn=s.time+.35;
  }
}
/** Passengers share their car's reservation and reward owner; never award a passenger twice. */
export function ridingCar(s: GameState, f: FoodObject): boolean {
  if (!f.citizen?.carId || f.target) return false;
  const car = s.food.find(c => c.id === f.citizen!.carId);
  if (!car) { delete f.citizen.carId; return false; }
  f.x = car.x; f.y = car.y; f.vx = f.vy = 0;
  if (car.target) { const owner=s.players.find(p=>p.id===car.target);if(owner)beginFall(f,owner,s.time);f.target = car.target; f.capturedAt = s.time; f.z = -16; return false; }
  return true;
}
export function stepLeap(s: GameState, f: FoodObject): boolean {
  if (!f.leap) return false;
  const t = Math.min(1, (s.time - f.leap.startedAt) / f.leap.duration);
  f.x = f.leap.from.x + (f.leap.to.x - f.leap.from.x) * t; f.y = f.leap.from.y + (f.leap.to.y - f.leap.from.y) * t;
  f.z = Math.sin(t * Math.PI) * 100; f.rotation = Math.atan2(f.leap.to.y - f.leap.from.y, f.leap.to.x - f.leap.from.x);
  if (t < 1) return true;
  delete f.leap; f.z = 0; f.vz = 0; return false;
}
function feast(s: GameState) {
  const cycle = s.feast;
  if (!cycle || !['nature', 'candy'].includes(s.map) || s.time < cycle.nextAt) return;
  const wave = cycle.wave++;
  cycle.nextAt += s.map === 'nature' ? 18 : 20;
  const sources = s.map === 'nature' ? FISH_POOLS : CANDY_MACHINES;
  for (const [pool, source] of sources.entries()) for (let i = 0; i < (s.map === 'nature' ? 5 : 4) && s.food.length < EAT.food.maxObjects; i++) {
    const kind = s.map === 'nature' ? 'fish' : (['candyMint', 'chocolate', 'jelly', 'candyMint'] as const)[i];
    // Opposite pool parity gives exactly five fish on each river bank per wave.
    const at = s.map === 'nature' ? { x: (wave + pool + i) % 2 ? 2810 : 2490, y: source.y + (i - 2) * 60 } : { x: source.x + (source.x < 2000 ? 120 : -120) + (i % 2) * 60, y: source.y + (i - 1.5) * 42 };
    if (!validPosition(s.map, at, FOOD[kind].radius + 4)) continue;
    const f = body(s, kind, at); f.expiresAt = s.time + 16;
    if (s.map === 'nature') {
      f.rewardGrowth = fishGrowth(s); f.golden = f.rewardGrowth >= 1000;
      f.leap = { from: source, to: at, startedAt: s.time, duration: 1.2 }; f.x = source.x; f.y = source.y;
    }
    s.food.push(f);
  }
}
/** Reward is rolled once by the authority and stored on the fish snapshot. */
export function fishGrowth(s: GameState): number {
  const roll = random(s);
  if (roll < .8) return 20 + Math.floor(random(s) * 31);
  if (roll < .9) return 100;
  if (roll < .95) return 200;
  if (roll < .98) return 500;
  return roll < .99 ? 1000 : 10000;
}
function coinCycle(s: GameState, startAt: number) {
  const count = EAT.candyCoins.minCount + Math.floor(random(s) * (EAT.candyCoins.maxCount - EAT.candyCoins.minCount + 1));
  return { startAt, count, emitted: 0, nextAt: startAt + random(s) * EAT.candyCoins.interval / count };
}
function conveyorCoins(s: GameState) {
  if (s.map !== 'candy') return;
  // One randomized slot per coin spreads the whole quota across each interval.
  let cycle = s.candyCoins ??= coinCycle(s, 0);
  if (s.time >= cycle.startAt + EAT.candyCoins.interval) {
    cycle = s.candyCoins = coinCycle(s, Math.floor(s.time / EAT.candyCoins.interval) * EAT.candyCoins.interval);
  }
  if (s.time < cycle.nextAt || cycle.emitted >= cycle.count) return;
  if (s.food.length >= EAT.food.maxObjects) return;
  const belts = SURFACES.candy!;
  const belt = belts[Math.floor(random(s) * belts.length)];
  const at = { x: belt.x + 20 + random(s) * (belt.w - 40), y: belt.y + 20 + random(s) * (belt.h - 40) };
  const coin = body(s, 'coin', at);
  coin.rewardGrowth = EAT.candyCoins.minGrowth + Math.floor(random(s) * (EAT.candyCoins.maxGrowth - EAT.candyCoins.minGrowth + 1));
  coin.expiresAt = s.time + EAT.candyCoins.lifetime;
  s.food.push(coin); cycle.emitted++;
  cycle.nextAt = cycle.startAt + (cycle.emitted + random(s)) * EAT.candyCoins.interval / cycle.count;
}
export function stepWorld(s: GameState, _dt: number) {
  if (s.phase !== 'normal') return;
  s.food = s.food.filter(f => f.target || f.expiresAt === undefined || s.time < f.expiresAt || f.kind === 'human' && s.players.some(p=>p.alive&&distance(p,f)<playerRadius(p,s.time)+500));
  // Releasing a retired driver also releases its car, keeping parking spaces reusable.
  for (const car of s.food) if (car.driverId && !s.food.some(f => f.id === car.driverId && f.citizen?.carId === car.id)) { delete car.driverId; car.vx = car.vy = 0; }
  if (s.nextHumans !== undefined && s.time >= s.nextHumans) {
    s.nextHumans = s.time + (s.map === 'city' ? EAT.humans.cityInterval : EAT.humans.interval);
    for (let i = 0; i < (s.map === 'city' ? EAT.humans.cityCrowds : 1); i++) spawnHumans(s);
  }
  feast(s); conveyorCoins(s); stepCitizens(s);
}
