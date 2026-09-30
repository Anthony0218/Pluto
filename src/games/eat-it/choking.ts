import { FOOD, playerRadius } from './config.ts';
import { distance, resolveWalls, validPosition } from './maps.ts';
import { mouthPosition } from './rules.ts';
import { resolveShrine } from './quests.ts';
import { objectHeight } from './falling.ts';
import type { FoodObject, GameState } from './types.ts';
export const SPIT_DURATION = .85;
export function spitPose(f: FoodObject,time: number) {
  const spit=f.spit!,t=Math.min(1,Math.max(0,(time-spit.since)/SPIT_DURATION)),out=Math.min(1,t/.32),travel=Math.max(0,(t-.32)/.68),ease=1-(1-travel)**2;
  return {x:spit.origin.x+(spit.destination.x-spit.origin.x)*ease,y:spit.origin.y+(spit.destination.y-spit.origin.y)*ease,
    z:(spit.fromZ??0)*(1-out)+Math.sin(travel*Math.PI)*35,rotation:spit.rotation+travel*Math.PI*2,tilt:Math.sin(travel*Math.PI)*.8,done:t>=1};
}
export function stepStuckTree(s: GameState, f: FoodObject): boolean {
  if (f.spit) {
    const pose=spitPose(f,s.time); f.x=pose.x; f.y=pose.y; f.z=pose.z; f.rotation=pose.rotation;
    if (pose.done) { delete f.spit; f.z = 0; f.vx = f.vy = f.vz = 0; }
    return true;
  }
  if (!f.stuck) return false;
  const p = s.players.find(p => p.id === f.stuck!.playerId), info = FOOD[f.kind];
  if (p?.alive && s.time < f.stuck.until) {
    Object.assign(f, mouthPosition(p, playerRadius(p, s.time)));
    // Trunk is inside the hole, while the full canopy rests above its rim.
    f.z = -(f.treeEntryDepth??objectHeight(f.kind)*.44); return true;
  }
  const origin = { x: f.x, y: f.y }, r = p ? playerRadius(p,s.time) : 24;
  let destination = { ...origin }, best = -Infinity;
  for (let ring=0; ring<3; ring++) for (let i=0; i<16; i++) {
    const a = (p?.facing ?? 0) + i*Math.PI/8, d = r + info.radius + 24 + ring*35;
    const at = { x: origin.x+Math.cos(a)*d, y: origin.y+Math.sin(a)*d };
    resolveWalls(s.map,at,info.radius+4); resolveShrine(s,at,info.radius+4);
    if (!validPosition(s.map,at,info.radius+4)) continue;
    const clearance = Math.min(...s.players.filter(o=>o.alive).map(o=>distance(at,o)-playerRadius(o,s.time)-info.radius), ...s.food.filter(o=>o!==f&&!o.target&&!o.stuck).map(o=>distance(at,o)-FOOD[o.kind].radius-info.radius));
    if (clearance > best) { best=clearance; destination=at; }
    if (clearance >= 4) break;
  }
  if (best === -Infinity) return true;
  f.spit = { since:s.time, origin, destination, rotation:f.rotation, fromZ:f.z }; delete f.stuck;
  f.availableAt=s.time+SPIT_DURATION+.7;
  return true;
}
