import { stepWorld, type NaturaWorld } from './world.ts';
import { IDLE_INTENT, type PlayerIntent } from './input.ts';

/** A rehearsal advances real mechanics with no rival, no running clock and restored hearts. */
export function stepPractice(world: NaturaWorld, inputs: [PlayerIntent,PlayerIntent], dt: number) {
  const g='game' in world?world.game:world;
  const time='timer' in g?g.timer:g.time;
  let actual: [PlayerIntent,PlayerIntent]=[inputs[0],IDLE_INTENT()];
  if(world.kind==='abyssduel'&&world.controlled===1)actual=[IDLE_INTENT(),inputs[1]];
  if(world.kind==='meadow') {
    const original=world.game.mode;
    world.game.mode='duo';
    if(world.game.role==='mouse')actual=[IDLE_INTENT(),inputs[0]];
    stepWorld(world,actual,dt,false,'easy');world.game.mode=original;
    world.game.lives=3;if(world.game.phase==='end')world.game.phase='hunt';
  } else {
    stepWorld(world,actual,dt,false,'easy');
    if(world.kind!=='archerfish'){world.players.forEach(p=>p.lives=3);if(world.phase==='finished')world.phase='playing';}
    else if(world.game.phase==='finished')world.game.phase='playing';
  }
  if('timer' in g)g.timer=time;else g.time=time;
}
