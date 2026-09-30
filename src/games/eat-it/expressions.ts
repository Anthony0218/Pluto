import { recordEvent } from './progression.ts';
import { isChoking } from './rules.ts';
import type { GameState, Player } from './types.ts';
export const BURP_DURATION = .85;
export function burpAllowed(s: GameState, p: Player) {
  return s.status === 'playing' && s.phase === 'normal' && p.alive && p.respawnAt === undefined && !isChoking(p,s.time) && !p.escape && !p.ability && p.fallingAt === undefined &&
    !s.food.some(f=>f.target===p.id || f.stuck?.playerId===p.id || !!f.spit && s.time-f.spit.since<.6) &&
    !(s.encounter?.npc.targetId===p.id && ['swallowing','devoured','emerging'].includes(s.encounter.npc.phase)) &&
    !s.events.some(e=>e.type==='eat' && e.playerId===p.id && s.time-e.at<.6);
}
export function stepBurp(s: GameState,p: Player) {
  p.nextBurp ??= s.time+27+s.players.indexOf(p)*.73;
  if (!burpAllowed(s,p)) { delete p.burpAt; if (s.time>=p.nextBurp) p.nextBurp=s.time+1; return; }
  if (s.time<p.nextBurp) return;
  p.burpAt=s.time;
  // Independent deterministic timer: cosmetics never consume the gameplay RNG.
  const phase=(s.players.indexOf(p)*1.618+s.time*.37)%1;
  p.nextBurp=s.time+27+phase*6;
  recordEvent(s,{type:'burp',playerId:p.id,x:p.x,y:p.y},false);
}
export function burpAmount(s: GameState,p: Player) {
  const age=s.time-(p.burpAt??-100);
  return burpAllowed(s,p) && age>=0 && age<BURP_DURATION ? Math.sin(age/BURP_DURATION*Math.PI) : 0;
}
