import type { Player } from './naturaData.ts';
import type { NaturaWorld } from './world.ts';
import { voleConcealed } from './naturafunctions.ts';
import { duelOpponentVisible } from './abyssDuel.ts';
import { distance3 } from './expeditions.ts';
/** Projection happens in the host BEFORE encryption/serialization. Render-only masking would leak state. */
export function privateWorld(source:NaturaWorld,seat:Player) {
  const world=structuredClone(source),hidden={vole:false,duelOpponent:false};
  if(world.kind==='meadow'&&source.kind==='meadow') {
    const g=world.game;
    g.randomState=0;g.visualRandomState=0;g.lastSeenPrey={x:0,y:0};g.captureMouse={x:0,y:0};
    if(seat===0&&voleConcealed(source.game)) {
      hidden.vole=true;g.mouse={x:0,y:0};g.boss={x:0,y:0};g.mouseFacing=0;g.coverPatch=-1;g.burrowExit=-1;g.particles=[];
      g.coverTime=1;g.burrowTravel=0;g.burrowCooldown=0;g.coverReset=0;
    }
  }
  if(world.kind==='abyssduel'&&source.kind==='abyssduel') {
    const opponent=seat===0?1:0;hidden.duelOpponent=!duelOpponentVisible(source,seat);
    world.lastSeen={x:0,y:0,z:0};world.aiInput={x:0,y:0,vertical:0,action:false,secondary:false};
    world.players[opponent].echoes=[];
    if(hidden.duelOpponent)Object.assign(world.players[opponent],{x:0,y:0,z:0,heading:0,velocity:{x:0,y:0,z:0},burst:0});
    world.ink=world.ink.filter(c=>distance3(c,source.players[seat])<24);
  }
  if(world.kind==='spermwhale'&&source.kind==='spermwhale') {
    world.squids=world.squids.filter(s=>s.owner===seat&&s.health>0&&distance3(s,source.players[seat])<13);
    world.players[seat===0?1:0].echoes=[];
  }
  if(world.kind==='flyingfish')world.randomState=0;
  if('aiInput' in world)world.aiInput={x:0,y:0,action:false,secondary:false,...(world.kind==='abyssduel'?{vertical:0}:{})};
  return {world,hidden};
}
