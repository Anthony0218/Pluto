import { camouflageMatches } from './wildModes.ts';
import { PERCH } from './naturaData.ts';
import type { NaturaWorld } from './world.ts';

export type Observation = { progress: number; health: number; cooldown: number; special: number; oxygen?: number; exposure?: number; x: number; y: number; z?: number; grounded?: boolean; checkpoint?: number; hidden?: boolean };
export type RunTelemetry = { actions: number; gains: number; injuries: number; falls: number; lowestBreath: number };
export const freshTelemetry = (): RunTelemetry => ({ actions: 0, gains: 0, injuries: 0, falls: 0, lowestBreath: 90 });
export function observe(w: NaturaWorld, seat = 0): Observation {
  if (w.kind === 'meadow') {
    const g = w.game, vole = seat === 1, p = vole ? g.mouse : g.falcon;
    return { ...p, progress: vole ? g.t : g.catches, health: vole ? g.lives : 3, cooldown: vole ? g.burrowCooldown : g.diveCooldown, special: g.attacks, hidden: vole && (g.coverTime > 0 || g.burrowTravel > 0) };
  }
  if (w.kind === 'archerfish') { const p = w.game.fish[seat]; return { x:p.x,y:0,progress:p.catches,health:3,cooldown:p.shotCooldown,special:p.dashCooldown }; }
  if (w.kind === 'abyssduel') { const p=w.players[seat]; return { ...p,progress:seat === 0?w.bites:w.elapsed,health:p.lives,cooldown:p.cooldown,special:p.specialCooldown,oxygen:seat===0?p.oxygen:undefined }; }
  if (w.kind === 'flyingfish') { const p=w.players[seat]; return { x:p.x,y:0,progress:p.score,health:p.lives,cooldown:0,special:w.phaseTime }; }
  if (w.kind === 'trapjaw') { const p=w.players[seat]; return { ...p,progress:p.checkpoint,health:p.lives,cooldown:p.cooldown,special:0,checkpoint:p.checkpoint }; }
  if (w.kind === 'cuttlefish') { const p=w.players[seat]; return { ...p,progress:p.food,health:p.lives,cooldown:0,special:0,exposure:p.exposure,hidden:camouflageMatches(p,w.patches) }; }
  if (w.kind === 'jumpingspider' || w.kind === 'spermwhale') { const p=w.players[seat]; return { ...p,progress:w.kind==='jumpingspider'?p.progress:p.food,health:p.lives,cooldown:p.cooldown,special:w.kind==='jumpingspider'?p.silk:p.sonarCooldown,oxygen:w.kind==='spermwhale'?p.oxygen:undefined,checkpoint:w.kind==='jumpingspider'?p.checkpoint:undefined }; }
  if(w.kind==='bolas'||w.kind==='coconut'){const p=w.players[seat];return { ...p,progress:p.food,health:p.lives,cooldown:p.cooldown,special:p.lureCooldown };}
  throw new Error('Unknown Natura habitat');
}
export type GameCue = 'action' | 'catch' | 'hurt' | 'checkpoint' | 'sonar';
export function observeChanges(before: Observation, after: Observation, telemetry?: RunTelemetry): GameCue[] {
  const cues: GameCue[] = [];
  if (after.cooldown > before.cooldown + 0.1) { cues.push('action'); if (telemetry) telemetry.actions++; }
  if (after.progress > before.progress && after.progress-before.progress >= 0.4) { cues.push(after.checkpoint!==undefined?'checkpoint':'catch'); if (telemetry) telemetry.gains += after.progress-before.progress; }
  if (after.health < before.health) { cues.push('hurt'); if (telemetry) telemetry.injuries += before.health-after.health; }
  if (after.special > before.special + 1 && after.oxygen !== undefined) cues.push('sonar');
  if (telemetry && after.oxygen !== undefined) telemetry.lowestBreath = Math.min(telemetry.lowestBreath, after.oxygen);
  return cues;
}
export function practicePrompt(w: NaturaWorld, seat: number) {
  switch(w.kind) {
    case 'meadow': return seat===1?'Move into grass, then use Tunnel near a burrow.':'Move onto the perch and rest until all five dives refill.';
    case 'archerfish': return 'Spit at an insect, then swim to its landing ring and catch it.';
    case 'flyingfish': return 'Tap left or right, release, and dodge one approaching predator wave.';
    case 'bolas': return 'Aim your silk at a moth. Use Lure and time a swing to catch it.';
    case 'coconut': return 'Move to your numbered shell, pick it up, and use Cover to hide.';
    case 'cuttlefish': return 'Move onto a different patch, then match both its pattern and texture.';
    case 'trapjaw': return 'Watch the cycling arc and time Snap to land on the next ledge.';
    case 'jumpingspider': return 'Move toward the next leaf and jump onto it. Silk brings you back safely.';
    case 'spermwhale': return 'Dive below 5 metres, send sonar, then rise above 3 metres to breathe.';
    case 'abyssduel': return seat===1?'Swim and use Burst, then release an ink cloud.':'Dive below 5 metres, send sonar, then rise above 3 metres to breathe.';
  }
}
export function practiceComplete(w: NaturaWorld, seat: number, seen: Set<string>) {
  const p = observe(w,seat);
  if (w.kind === 'meadow') return seat===1?w.game.burrowTravel>0:w.game.attacks===5&&Math.abs(w.game.falcon.x-(PERCH.x+PERCH.width/2))<70;
  if (w.kind === 'coconut') return w.players[seat].hidden;
  if (w.kind === 'cuttlefish') {
    const nearest=(x:number,y:number)=>w.patches.reduce((best,patch)=>Math.hypot(patch.x-x,patch.y-y)<Math.hypot(best.x-x,best.y-y)?patch:best);
    if(nearest(p.x,p.y)!==nearest(90,seat?360:180))seen.add('moved');
    return seen.has('moved')&&p.hidden===true;
  }
  if (w.kind === 'spermwhale' || w.kind==='abyssduel'&&seat===0) {
    if (p.y < -5) seen.add('dived');
    if (p.special > 0 && seen.has('dived')) seen.add('sonar');
    return seen.has('sonar') && p.y > -3;
  }
  if (w.kind==='abyssduel') { if(w.players[seat].burst>0) seen.add('burst');return seen.has('burst')&&w.ink.length>0; }
  return p.progress>0;
}
export function reviewRun(w: NaturaWorld, seat: number, t: RunTelemetry) {
  const p = observe(w,seat), feedback = [`${w.kind==='meadow'&&seat===1?p.progress.toFixed(1):p.progress % 1 ? p.progress.toFixed(1) : p.progress} ${w.kind==='jumpingspider'||w.kind==='trapjaw'?'ledges advanced':w.kind==='flyingfish'?'clean dodges':w.kind==='meadow'&&seat===1?'seconds survived':'catches'}`];
  if(!['archerfish','bolas'].includes(w.kind)&&!(w.kind==='meadow'&&seat===0))feedback.push(`${t.injuries} hearts lost`);
  if(t.actions>0)feedback.push(`${t.actions} actions timed`);
  let tip = 'Watch the next opening before committing to an action.';
  if(w.kind==='meadow')tip=seat===1?'Move between grass shelters and save the tunnel for an incoming dive.':'Rest on the perch between hunts, then dive when the vole leaves cover.';
  if(w.kind==='archerfish')tip='Start moving toward the landing ring as soon as your shot hits.';
  if(w.kind==='bolas')tip='Lure moths closer and swing when they reach the silk tip.';
  if(w.kind==='coconut')tip='Place your shell near food before the patrol warning begins.';
  if(w.kind==='cuttlefish')tip='Match both texture and pattern before crossing a patrol’s search area.';
  if(w.kind==='trapjaw')tip='Launch from the edge and watch where the arc meets the next ledge.';
  if(w.kind==='jumpingspider'){feedback.push(`${w.players[seat].falls} falls`);tip='Prepare your next jump at a checkpoint; keep silk for an uncertain landing.';}
  if(w.kind==='spermwhale'||w.kind==='abyssduel'&&seat===0){feedback.push(`Lowest breath: ${Math.ceil(t.lowestBreath)}s`);tip=t.lowestBreath<20?'Begin your return sooner; leave enough breath to reach the surface.':'Send a new sonar pulse after an echo fades, and sidestep warned strikes.';}
  if(w.kind==='abyssduel'&&seat===1)tip='Change depth after releasing ink, and save your burst for close approaches.';
  if(w.kind==='flyingfish')tip='Release the lane button between taps, and look ahead for a predator’s lane change.';
  return { facts:feedback, tip };
}
