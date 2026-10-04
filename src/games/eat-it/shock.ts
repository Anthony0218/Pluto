import { EAT, playerRadius } from './config.ts';
import { clamp, validPosition } from './maps.ts';
import { recordEvent, unavailable } from './progression.ts';
import type { GameState, Player } from './types.ts';

/** Swept-circle hits prevent fast bolts from skipping players between server ticks. */
export function stepShockShots(s: GameState, dt: number) {
  if (!s.shockShots?.length) return;
  const c = EAT.powerups.shock;
  s.shockShots = s.shockShots.filter(shot => {
    const owner = s.players.find(p => p.id === shot.ownerId);
    if (!owner?.alive || s.phase !== 'normal') return false;
    const travel = Math.min(c.speed * dt, c.range - shot.distance), dx = shot.dx * travel, dy = shot.dy * travel;
    let first = Infinity, victim: Player | null = null;
    for (const p of s.players) {
      if (p.id === shot.ownerId || unavailable(p)) continue;
      const vx = p.x - shot.x, vy = p.y - shot.y, along = vx * shot.dx + vy * shot.dy;
      const side = vx * shot.dy - vy * shot.dx, radius = playerRadius(p, s.time) + c.radius;
      if (Math.abs(side) > radius) continue;
      const half = Math.sqrt(radius * radius - side * side), entry = along - half;
      if (along + half < 0 || entry > travel) continue;
      const t = clamp(entry / Math.max(.001, travel), 0, 1);
      if (t < first) { first = t; victim = p; }
    }
    const end = first < Infinity ? first : 1;
    // Projectiles cross raised props, but remain inside traversable map terrain.
    for (let i = 1, steps = Math.max(1, Math.ceil(travel * end / 8)); i <= steps; i++) {
      if (!validPosition(s.map, {x:shot.x+dx*end*i/steps,y:shot.y+dy*end*i/steps},c.radius)) return false;
    }
    shot.x += dx * end; shot.y += dy * end; shot.distance += travel * end;
    if (victim) {
      const before = victim.mass; victim.mass = Math.max(EAT.player.minMass, victim.mass * (1 - c.loss));
      victim.shockedAt = s.time;
      recordEvent(s,{type:'shockHit',playerId:victim.id,x:victim.x,y:victim.y,amount:before-victim.mass});
      return false;
    }
    return shot.distance < c.range;
  });
}
