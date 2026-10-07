import { animalScale } from './scaling.ts';
import { EAT, FOOD, playerRadius } from './config.ts';
import { clamp, distance, validPosition, resolveWalls } from './maps.ts';
import { isChoking } from './rules.ts';
import { random, spawnPosition } from './spawn.ts';
import { objectContact } from './physics.ts';
import { newStats, recordEvent, safePosition } from './progression.ts';
import { movePlayer } from './engine.ts';
import { nearbyLanding, supported } from './hell.ts';
import type { GameState, Player, Vec } from './types.ts';

export function escapeAvailable(s: GameState, p: Player) {
  if (s.settings?.animalsEnabled === false || s.status !== 'playing' || !p.alive || p.escape || p.ability || p.fallingAt !== undefined || isChoking(p, s.time) || (p.stunnedUntil ?? 0) > s.time || s.phase === 'transition') return false;
  if (s.phase === 'hell') return !!p.helper?.hell && !p.helper.used;
  const e = s.encounter;
  return !!e && e.npc.phase === 'friendly' && e.completedBy === p.id && e.npc.targetId === p.id && e.npc.until > s.time && !p.helper?.used;
}
function groundClear(s: GameState, p: Player, at: Vec) {
  const r = Math.max(60, playerRadius(p, s.time) * 1.7);
  return validPosition(s.map, at, r + 8) && (!s.encounter?.shrine || distance(at, s.encounter.shrine) > r + 90) &&
    !s.food.some(f => !f.target && FOOD[f.kind].mass >= 70 && objectContact(at, r + 6, f));
}
function clearSegment(s: GameState, p: Player, a: Vec, b: Vec) {
  const steps = Math.max(1, Math.ceil(distance(a, b) / 18));
  for (let i = 1; i <= steps; i++) if (!groundClear(s, p, { x: a.x + (b.x - a.x) * i / steps, y: a.y + (b.y - a.y) * i / steps })) return false;
  return true;
}
/** Bounded grid search across current geometry. Only reachable endpoints enter the draw. */
export function catRoute(s: GameState, p: Player): Vec[] | null {
  const size = 80, cols = EAT.match.width / size, rows = EAT.match.height / size;
  const center = (i: number) => ({ x: (i % cols + .5) * size, y: (Math.floor(i / cols) + .5) * size });
  const start = Math.floor(p.y / size) * cols + Math.floor(p.x / size), queue = [start], parents = new Map<number, number>([[start, -1]]), candidates: number[] = [];
  for (let head = 0; head < queue.length; head++) {
    const i = queue[head], at = i === start ? p : center(i);
    if (distance(at, p) > 400 && distance(at, p) < 1400 && safePosition(s, at, playerRadius(p, s.time), p.id)) candidates.push(i);
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const x = i % cols + dx, y = Math.floor(i / cols) + dy, n = y * cols + x;
      if (x < 0 || x >= cols || y < 0 || y >= rows || parents.has(n) || !clearSegment(s, p, at, center(n))) continue;
      parents.set(n, i); queue.push(n);
    }
  }
  if (!candidates.length) return null;
  let end = candidates[Math.floor(random(s) * candidates.length)]; const path: Vec[] = [];
  while (end !== start) { path.push(center(end)); end = parents.get(end)!; }
  return path.reverse();
}
export function activateEscape(s: GameState, p: Player): boolean {
  if (!escapeAvailable(s, p)) return false;
  const hell = s.phase === 'hell', kind = hell ? p.helper!.kind : s.encounter!.npc.kind;
  let path: Vec[] = [], destination: Vec = { x: p.x, y: p.y };
  if (!hell) {
    if (kind === 'cat') { const route = catRoute(s, p); if (!route) return false; path = route; destination = path[path.length - 1]; }
    else { const at = spawnPosition(s, playerRadius(p, s.time) + 45); if (!at || !safePosition(s, at, playerRadius(p, s.time), p.id)) return false; destination = at; path = [at]; }
  }
  const duration = hell ? (kind === 'pigeon' ? EAT.escape.pigeonHellDuration : EAT.escape.hellDuration) : EAT.escape.approachDuration + Math.max(EAT.escape.travelDuration, kind === 'cat' ? path.length * 80 / 700 : 0);
  p.helper = { kind, used: true, hell, until: hell ? 0 : s.encounter!.npc.until };
  p.escape = { kind, hell, startedAt: s.time, endsAt: s.time + duration, origin: { x: p.x, y: p.y }, animalOrigin: hell ? { x: p.x, y: p.y } : { x: s.encounter!.npc.x, y: s.encounter!.npc.y }, destination, path, pathIndex: 0, gapDistance: 0 };
  p.vx = 0; p.vy = 0;
  for (const f of s.food) if (f.target === p.id) { f.target = null; f.z = 0; f.vz = 0; f.availableAt = s.time + duration; }
  const stats = p.stats ??= newStats(); if (hell) stats.hellAssists++; else stats.escapes++;
  recordEvent(s, { type: hell ? 'hellAssist' : 'escape', playerId: p.id, x: p.x, y: p.y }); return true;
}
export function ridePose(s: GameState, p: Player) {
  const e = p.escape;
  if (!e) return { altitude: 0, scale: 1, mounted: false, animal: p };
  const age = s.time - e.startedAt, approach = e.hell ? 0 : EAT.escape.approachDuration;
  const mounted = age >= approach;
  const t = clamp(age / Math.max(.01, approach), 0, 1), lift = e.hell ? Math.min(1, age / .18, (e.endsAt - s.time) / .18) : Math.min(1, (age - approach) / .4, (e.endsAt - s.time) / .4);
  return { altitude: mounted ? e.kind === 'pigeon' ? Math.max(0, lift) * 115 : e.hell && e.gapDistance > 0 ? Math.sin(Math.min(1, e.gapDistance / 96) * Math.PI) * 35 : 0 : 0,
    scale: 1 + (animalScale(playerRadius(p, s.time), 'escape') - 1) * (e.hell ? clamp(age / .18, 0, 1) : t), mounted,
    animal: mounted ? p : { x: e.animalOrigin.x + (p.x - e.animalOrigin.x) * t, y: e.animalOrigin.y + (p.y - e.animalOrigin.y) * t } };
}
export function stepEscape(s: GameState, p: Player, dt: number) {
  const e = p.escape!;
  if (e.hell) {
    const before = { x: p.x, y: p.y }; movePlayer(s, p, e.kind === 'cat' && Math.hypot(p.input.x, p.input.y) < .1 ? { x: Math.cos(p.facing), y: Math.sin(p.facing) } : p.input, dt, e.kind === 'cat' ? 2.4 : 1.8);
    e.gapDistance = supported(s, p) ? 0 : e.gapDistance + distance(before, p);
    if (supported(s, p)) delete e.gapSince; else e.gapSince ??= s.time;
  } else if (s.time - e.startedAt >= EAT.escape.approachDuration) {
    if (e.kind === 'pigeon' && !e.landing) {
      const t = clamp((s.time - e.startedAt - EAT.escape.approachDuration) / (e.endsAt - e.startedAt - EAT.escape.approachDuration), 0, 1), eased = t * t * (3 - 2 * t);
      p.x = e.origin.x + (e.destination.x - e.origin.x) * eased; p.y = e.origin.y + (e.destination.y - e.origin.y) * eased;
      p.facing = Math.atan2(e.destination.y - e.origin.y, e.destination.x - e.origin.x);
    } else if (e.kind === 'cat') {
      const at = e.path[e.pathIndex];
      if (at) {
        const d = distance(p, at), step = Math.min(d, 700 * dt), next = { x: p.x + (at.x - p.x) / Math.max(1, d) * step, y: p.y + (at.y - p.y) / Math.max(1, d) * step };
        if (groundClear(s, p, next)) { p.facing = Math.atan2(at.y - p.y, at.x - p.x); p.x = next.x; p.y = next.y; if (d <= step + 1) e.pathIndex++; }
        else e.endsAt = s.time; // Moving geometry can interrupt a grounded ride safely.
      }
    }
  }
  if (s.time + 1e-6 >= e.endsAt) {
    if (e.hell) {
      const at = nearbyLanding(s, p, e.kind === 'pigeon' ? 120 : 80); if (at) Object.assign(p, at);
    } else if (!e.hell && !safePosition(s, p, playerRadius(p, s.time), p.id)) {
      // Revalidate the landing against players/props that moved during travel.
      let landed = false;
      for (let ring = 1; ring <= 3 && !landed; ring++) for (let i = 0; i < 16; i++) {
        const a = i * Math.PI / 8, at = { x: p.x + Math.cos(a) * ring * 35, y: p.y + Math.sin(a) * ring * 35 };
        if (safePosition(s, at, playerRadius(p, s.time), p.id) && (e.kind === 'pigeon' || clearSegment(s, p, p, at))) { Object.assign(p, at); landed = true; break; }
      }
      if (!landed) {
        e.landingSince ??= s.time;
        if (s.time - e.landingSince < 2) { e.landing = true; e.endsAt = s.time + .2; return; }
        // Try safe public spawn sectors once, then release on valid terrain. Ordinary
        // collision resolution handles dense props; immunity must always expire.
        for(let attempt=0;attempt<12&&!landed;attempt++){
          const at=spawnPosition(s,playerRadius(p,s.time)+20);
          if(at&&safePosition(s,at,playerRadius(p,s.time),p.id)){Object.assign(p,at);landed=true;}
        }
        if(!landed)resolveWalls(s.map,p,playerRadius(p,s.time),true);
      }
    }
    delete p.escape; p.vx = 0; p.vy = 0;
  }
}
