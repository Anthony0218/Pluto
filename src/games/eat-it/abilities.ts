import { EAT, type PowerKind } from './config.ts';
import { clamp } from './maps.ts';
import { isChoking } from './rules.ts';
import { supported } from './hell.ts';
import { newStats, recordEvent } from './progression.ts';
import type { GameState, Player } from './types.ts';
export type HeldAbility = 'jump' | 'strike' | 'shock';
export const ABILITY_KEYS = { shock: 'KeyK', strike: 'Space', jump: 'KeyJ' } as const;
export function canStorePower(s: GameState, p: Player, kind: PowerKind) {
  return kind === 'shock' ? s.phase === 'normal' && !(p.shockAmmo ?? 0) : kind === 'jump' ? s.phase === 'hell' && !p.storedJump : kind === 'strike' ? !p.storedStrike : kind === 'multiplier' ? !p.storedGrowth : true;
}
export function abilityAvailable(s: Pick<GameState,'status'|'phase'|'time'|'hell'>, p: Player, kind: HeldAbility) {
  if (s.status !== 'playing' || !p.alive || p.respawnAt !== undefined || p.fallingAt !== undefined || p.escape || p.ability || isChoking(p,s.time) || (p.stunnedUntil??0)>s.time || s.phase==='transition') return false;
  if (s.phase==='hell' && !supported(s as GameState,p)) return false;
  return kind === 'shock' ? s.phase === 'normal' && (p.shockAmmo ?? 0) > 0 && s.time + 1e-6 >= (p.nextShockAt ?? 0) : kind === 'jump' ? s.phase==='hell' && !!p.storedJump : !!p.storedStrike;
}
/** Inputs carry activation intent only. Direction, duration and charge use are server-owned. */
export function activateAbility(s: GameState, p: Player, kind: HeldAbility) {
  if (!abilityAvailable(s,p,kind)) return false;
  const length=Math.hypot(p.input.x,p.input.y), direction=length>.1 ? {x:p.input.x/length,y:p.input.y/length} : {x:Math.cos(p.facing),y:Math.sin(p.facing)};
  if (kind === 'shock') {
    p.shockAmmo = (p.shockAmmo ?? 0) - 1; p.nextShockAt = s.time + EAT.powerups.shock.shotCooldown;
    (s.shockShots ??= []).push({id:s.nextId++,ownerId:p.id,x:p.x,y:p.y,dx:direction.x,dy:direction.y,distance:0});
    p.facing=Math.atan2(direction.y,direction.x);recordEvent(s,{type:'shock',playerId:p.id,x:p.x,y:p.y});return true;
  }
  const duration=kind==='jump'?EAT.powerups.jump.flightDuration:EAT.powerups.strike.burstDuration;
  p.ability={kind,startedAt:s.time,endsAt:s.time+duration,origin:{x:p.x,y:p.y},direction};
  p.facing=Math.atan2(direction.y,direction.x);p.vx=p.vy=0;
  const stats=p.stats??=newStats();
  if(kind==='jump'){p.storedJump=false;stats.jumpUses=(stats.jumpUses??0)+1;}else{p.storedStrike=false;stats.strikeUses=(stats.strikeUses??0)+1;}
  recordEvent(s,{type:kind,playerId:p.id,x:p.x,y:p.y});return true;
}
/** Ground lunge feeds the existing movement/collision pipeline, never changes mouth size. */
export function abilityVelocity(p: Player,time:number) {
  const a=p.ability;if(a?.kind!=='strike')return null;
  if((p.stunnedUntil??0)>time || isChoking(p,time)){delete p.ability;p.vx=p.vy=0;return null;}
  if(time>=a.endsAt){delete p.ability;p.vx=p.vy=0;return null;}
  const c=EAT.powerups.strike,t=clamp((time-a.startedAt-c.windup)/(c.burstDuration-c.windup),0,1);
  const speed=time-a.startedAt<c.windup?0:2*c.distance/(c.burstDuration-c.windup)*(1-t);
  p.lastStrikeAt=time;return {x:a.direction.x*speed,y:a.direction.y*speed};
}
export function jumpHeight(p: Player,time:number) {
  const a=p.ability;if(a?.kind!=='jump')return 0;
  return Math.sin(clamp((time-a.startedAt)/(a.endsAt-a.startedAt),0,1)*Math.PI)*EAT.powerups.jump.height;
}
export function stepJump(s: GameState,p: Player) {
  const a=p.ability;if(a?.kind!=='jump')return;
  const t=clamp((s.time-a.startedAt)/(a.endsAt-a.startedAt),0,1);
  p.x=a.origin.x+a.direction.x*EAT.powerups.jump.distance*t;p.y=a.origin.y+a.direction.y*EAT.powerups.jump.distance*t;
  p.vx=p.vy=0;
  if(!supported(s,p))a.crossedGap=true;
  if(t>=1){
    if(a.crossedGap && supported(s,p)){const stats=p.stats??=newStats();stats.gapJumps=(stats.gapJumps??0)+1;}
    delete p.ability; // The normal Hell support check decides landing/falling at this exact endpoint.
  }
}
