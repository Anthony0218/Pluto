import type { Player } from './naturaData';
export type Point3 = { x: number; y: number; z: number };
export type ExpeditionInput = { x: number; z: number; vertical: number; action: boolean; special: boolean };
export const idleExpeditionInput = (): ExpeditionInput => ({ x: 0, z: 0, vertical: 0, action: false, special: false });
export const SPIDER_STUDIES = [
  {name:'Dewdrop Garden',theme:'garden',hint:'Learn jumping, checkpoints and the silk safety line.',wind:0,moving:false,slippery:false,gates:false,crumble:false},
  {name:'Bark & Brambles',theme:'bark',hint:'Follow a winding route across branches and stones.',wind:0,moving:false,slippery:false,gates:false,crumble:false},
  {name:'Cloud Canopy',theme:'canopy',hint:'Climb higher through smaller landing windows.',wind:0,moving:false,slippery:false,gates:false,crumble:false},
  {name:'Limestone Cavern',theme:'cave',hint:'Hanging stone gates warn before dropping. Wait for a safe jump.',wind:0,moving:false,slippery:false,gates:true,crumble:false},
  {name:'Waterfall Ledges',theme:'waterfall',hint:'Wet stones carry momentum; rising water shelves move beneath you.',wind:0,moving:true,slippery:true,gates:false,crumble:false},
  {name:'Alpine Ridge',theme:'alpine',hint:'Read the wind arrow and steer against airborne drift.',wind:1.3,moving:false,slippery:false,gates:false,crumble:false},
  {name:'Night Bloom',theme:'night',hint:'Moving flowers wilt after 3.6 seconds. Plan the next leap before landing.',wind:0,moving:true,slippery:false,gates:false,crumble:true},
  {name:'Storm Crown',theme:'storm',hint:'Narrow moving platforms, wind and stone gates combine every learned skill.',wind:1,moving:true,slippery:false,gates:true,crumble:true},
];
export const SPIDER_COURSES = SPIDER_STUDIES.map(c=>c.name);
export type Platform3 = Point3 & { radius: number; checkpoint: boolean; motion?:{amplitude:number;phase:number};crumble?:number };
export function spiderPlatforms(level: number): Platform3[] {
  const course=SPIDER_STUDIES[level]??SPIDER_STUDIES[0];
  return Array.from({ length: 24 }, (_, i) => ({
    x: Math.sin(i * (level === 1 ? 0.7 : 0.5)) * (level === 2 ? 7 : 5),
    y: i * (level === 2 ? 0.65 : 0.4), z: -i * 5.3,
    radius: i === 0 || i % 4 === 0 || i === 23 ? 2.9 : level>=7?1.65:2.2-Math.min(level,2)*0.15,
    checkpoint: i % 4 === 0 || i === 23,
    ...(course.moving&&i%4!==0&&i!==23?{motion:{amplitude:0.75,phase:i*0.7}}:{}),
    ...(course.crumble&&i%4!==0&&i!==23?{crumble:3.6}:{}),
  }));
}
export const platformAt=(p:Platform3,time:number):Platform3=>({...p,x:p.x+(p.motion?Math.sin(time*1.1+p.motion.phase)*p.motion.amplitude:0)});
export const expeditionPlatforms=(g:Expedition,time=g.elapsed)=>g.platforms.map(p=>platformAt(p,time));
export const spiderWind=(g:Expedition,time=g.elapsed)=>SPIDER_STUDIES[g.level].wind*Math.sin(time*0.65);
export function spiderGates(g:Expedition,time=g.elapsed) {
  if(!SPIDER_STUDIES[g.level].gates)return [];
  return g.platforms.flatMap((p,i)=>{
    if(i===0||i%4===0)return [];
    const prev=g.platforms[i-1],phase=(time+i*0.8)%6;
    return [{x:(p.x+prev.x)/2,y:(p.y+prev.y)/2+2.8,z:(p.z+prev.z)/2,radius:0.7,active:phase<1.6,warning:phase>=5,target:i}];
  });
}
export type Explorer = Point3 & { vy: number; heading: number; lives: number; checkpoint: number; progress: number; silk: number; grounded: boolean; oxygen: number; food: number; cooldown: number; flash: number; sonar: number; sonarCooldown: number; velocity: Point3; echoes: SonarEcho[]; groundedTime: number; actionHeld: boolean; specialHeld: boolean; standing:number; broken:number; falls:number };
export type SonarEcho = { bearing: number; range: 'near' | 'mid' | 'far'; depth: 'above' | 'below' | 'level' };
/** A single observation, quantized to 8 sectors. No live target coordinates leave this helper. */
export function sampleSonar(g: Expedition, player: Player): SonarEcho[] {
  const p = g.players[player];
  return g.squids.filter(s => s.owner === player && s.health > 0).map(s => {
    const distance = distance3(p, s);
    return { bearing: Math.round(Math.atan2(s.x - p.x, -(s.z - p.z)) / (Math.PI / 4)) * 45,
      range: distance < 16 ? 'near' : distance < 32 ? 'mid' : 'far',
      depth: Math.abs(s.y - p.y) < 5 ? 'level' : s.y > p.y ? 'above' : 'below' };
  });
}
export const ECHO_BEARINGS = ['ahead', 'ahead-right', 'right', 'back-right', 'behind', 'back-left', 'left', 'ahead-left'];
export function describeEcho(echo: SonarEcho): string {
  return `${ECHO_BEARINGS[((echo.bearing / 45) % 8 + 8) % 8]} · ${echo.depth} · ${echo.range}`;
}
export type Squid = Point3 & { health: number; warning: number; cooldown: number; owner: Player };
export type Expedition = {
  kind: 'jumpingspider' | 'spermwhale'; phase: 'ready' | 'playing' | 'paused' | 'finished';
  time: number; elapsed: number; level: number; players: [Explorer, Explorer];
  platforms: Platform3[]; squids: Squid[]; winner: Player | null; notice: string;
};
const clamp = (x: number, min: number, max: number) => Math.max(min, Math.min(max, x));
export const distance3 = (a: Point3, b: Point3) => Math.hypot(a.x - b.x, a.y - b.y, a.z - b.z);
export function createExpedition(kind: Expedition['kind'], level = 0): Expedition {
  level=clamp(Math.trunc(level),0,SPIDER_COURSES.length-1);
  const player = (i: number): Explorer => ({ x: i ? 0.7 : -0.7, y: kind === 'jumpingspider' ? 0 : -2, z: 0, vy: 0, heading: Math.PI/2, lives: 3, checkpoint: 0, progress: 0, silk: 2, grounded: true, oxygen: 90, food: 0, cooldown: 0, flash: 0, sonar: 0, sonarCooldown: 0, velocity: { x: 0, y: 0, z: 0 }, echoes: [], groundedTime: 0, actionHeld: false, specialHeld: false,standing:0,broken:-1,falls:0 });
  return { kind, phase: 'ready', time: 180, elapsed: 0, level, players: [player(0), player(1)], platforms: spiderPlatforms(level),
    squids: ([0, 1] as const).flatMap(owner => Array.from({length: 3}, (_, i) => ({x: (owner ? 1 : -1) * (8 + i * 3), y: -18 - i * 13, z: -14 + i * 10, health: 3, warning: 0, cooldown: 3, owner}))),
    winner: null, notice: kind === 'jumpingspider' ? SPIDER_STUDIES[level].hint : 'Use sonar to find a direction and depth. Approach your prey, then surface to breathe.' };
}
function rescue(g: Expedition, p: Explorer) {
  p.falls++;
  if (p.silk > 0) { p.silk--; g.notice = 'Your silk catches you. Back to the last checkpoint.'; }
  else { p.lives--; g.notice = 'A fall costs one heart. Reach a checkpoint to refill silk.'; }
  const c = platformAt(g.platforms[p.checkpoint],g.elapsed); Object.assign(p, { x: c.x, y: c.y, z: c.z, vy: 0, grounded: true,standing:p.checkpoint,broken:-1,groundedTime:0,flash:1,velocity:{x:0,y:0,z:0} });
}
export function spiderAI(g: Expedition, difficulty: "easy" | "normal" | "hard" = "normal"): ExpeditionInput {
  const p = g.players[1], target = platformAt(g.platforms[Math.min(23, p.standing + 1)],g.elapsed+1.05);
  const dx = target.x - p.x, dz = target.z - p.z, d = Math.hypot(dx, dz);
  const gateBlocked=[0.2,0.35,0.5,0.65,0.8,0.95].some(t=>spiderGates(g,g.elapsed+t).some(gate=>gate.target===p.standing+1&&gate.active));
  const preparing = p.grounded && (g.elapsed<=(difficulty==='easy'?2.5:difficulty==='hard'?0.5:1.5)||p.groundedTime < (difficulty === "easy" ? 0.6 : difficulty === "hard" ? 0 : 0.28)||gateBlocked);
  const wind=p.grounded?0:spiderWind(g)/6.6;
  return { x: !preparing && d > 0.15 ? dx / d-wind : 0, z: !preparing && d > 0.15 ? dz / d : 0, vertical: 0, action: p.grounded && !p.actionHeld && !preparing && g.elapsed > (difficulty === "easy" ? 2.5 : difficulty === "hard" ? 0.5 : 1.5), special: false };
}
export function updateExpedition(g: Expedition, inputs: [ExpeditionInput, ExpeditionInput], seconds: number, ai: boolean, difficulty: "easy" | "normal" | "hard" = "normal") {
  if (g.phase !== 'playing' || !Number.isFinite(seconds) || seconds <= 0) return;
  let remaining = Math.min(seconds, 0.1);
  while (remaining > 0.000001 && g.phase === 'playing') {
    const dt = Math.min(remaining, 1 / 120); remaining -= dt;
    g.time = Math.max(0, g.time - dt); g.elapsed += dt;
    const rival = ai && g.kind === 'jumpingspider' ? spiderAI(g, difficulty) : inputs[1];
    const pace = difficulty === 'easy' ? 0.65 : 1;
    const actual = [inputs[0], ai && g.kind === 'jumpingspider' ? { ...rival, x: rival.x * pace, z: rival.z * pace, action: rival.action && (difficulty !== 'easy' || g.elapsed % 1.5 > 0.5) } : inputs[1]];
    g.players.forEach((p, i) => {
      if (p.lives <= 0 || ai && g.kind === 'spermwhale' && i === 1) return;
      const input = actual[i], norm = Math.max(1, Math.hypot(input.x, input.z));
      if (Math.hypot(input.x,input.z)>0.01) p.heading=Math.atan2(-input.z,input.x);
      p.groundedTime = p.grounded ? p.groundedTime + dt : 0;
      p.cooldown = Math.max(0, p.cooldown - dt); p.flash = Math.max(0, p.flash - dt);
      if (g.kind === 'jumpingspider') {
        const platforms=expeditionPlatforms(g),course=SPIDER_STUDIES[g.level];
        if(p.grounded) {
          const current=platforms[p.standing],old=platformAt(g.platforms[p.standing],g.elapsed-dt);
          p.x+=current.x-old.x;
          if(current.crumble&&p.groundedTime>current.crumble){p.broken=p.standing;p.grounded=false;g.notice='The flower wilts. Keep moving toward the next leaf.';}
        }
        if (input.special && !p.specialHeld) rescue(g, p);
        if (input.action && !p.actionHeld && p.grounded) { p.vy = 10.8; p.grounded = false; }
        if(course.slippery) {
          (['x','z'] as const).forEach(axis=>{const v=axis==='x'?input.x:input.z;p.velocity[axis]+=(v/norm*6.6-p.velocity[axis])*(1-Math.exp((v===0?-2.5:-7)*dt));p[axis]+=p.velocity[axis]*dt;});
        } else {p.x += input.x / norm * 6.6 * dt;p.z += input.z / norm * 6.6 * dt;}
        if(!p.grounded)p.x+=spiderWind(g)*dt;
        const oldY = p.y;
        if (p.grounded && !platforms.some(t => Math.abs(t.y - p.y) < 0.05 && Math.hypot(t.x - p.x, t.z - p.z) < t.radius)) p.grounded = false;
        if (!p.grounded) {
          p.vy -= 17 * dt; p.y += p.vy * dt;
          if (p.vy <= 0) {
            const index = platforms.findIndex((t,index) => index!==p.broken&&oldY >= t.y && p.y <= t.y && Math.hypot(t.x - p.x, t.z - p.z) < t.radius);
            if (index >= 0) {
              p.y = platforms[index].y; p.vy = 0; p.grounded = true; p.progress = Math.max(index, p.progress);p.standing=index;p.broken=-1;p.groundedTime=0;
              if (g.platforms[index].checkpoint && index > p.checkpoint) { p.checkpoint = index; p.silk = 2; g.notice = `Checkpoint ${index + 1} reached. Silk refilled.`; }
            }
          }
          if (p.y < g.platforms[p.checkpoint].y - 8) rescue(g, p);
          if(p.flash===0&&spiderGates(g).some(gate=>gate.active&&distance3(gate,p)<gate.radius+0.4)){rescue(g,p);g.notice='A stone gate catches the jump. Wait for the clear window.';}
        }
      } else {
        const length = Math.max(1, Math.hypot(input.x, input.z, input.vertical));
        (['x', 'y', 'z'] as const).forEach(axis => {
          const intent = axis === 'x' ? input.x : axis === 'y' ? input.vertical : input.z;
          const blend = 1 - Math.exp(-(intent === 0 ? 9 : 6) * dt);
          p.velocity[axis] += (intent / length * 10 - p.velocity[axis]) * blend;
          p[axis] += p.velocity[axis] * dt;
        });
        p.x = clamp(p.x, -32, 32); p.z = clamp(p.z, -36, 30); p.y = clamp(p.y, -65, -1);
        p.oxygen = p.y > -3 ? Math.min(90, p.oxygen + 25 * dt) : Math.max(0, p.oxygen - dt);
        p.sonar = Math.max(0, p.sonar - dt); p.sonarCooldown = Math.max(0, p.sonarCooldown - dt);
        if (p.sonar === 0) p.echoes = [];
        if (input.special && !p.specialHeld && p.sonarCooldown === 0) { p.sonar = 4; p.sonarCooldown = 6; p.echoes = sampleSonar(g, i as Player); }
        if (input.action && !p.actionHeld && p.cooldown === 0) {
          p.cooldown = 0.8;
          const prey = g.squids.find(s => s.owner === i && s.health > 0 && distance3(s, p) < 7);
          if (prey) { prey.health--; if (prey.health === 0) { p.food++; g.notice = p.food === 3 ? 'Hunt complete. Return to the surface!' : 'Prey caught. Check your breath before the next dive.'; } }
        }
        if (p.oxygen === 0 && p.flash === 0) { p.lives--; p.flash = 3; g.notice = 'Out of breath! Rise to the surface.'; }
      }
      p.actionHeld = input.action; p.specialHeld = input.special;
    });
    if (g.kind === 'spermwhale') g.squids.forEach(s => {
      const p = g.players[s.owner]; if (s.health <= 0 || ai && s.owner === 1 || p.lives <= 0) return;
      s.cooldown = Math.max(0, s.cooldown - dt);
      if (s.warning > 0) {
        s.warning = Math.max(0, s.warning - dt);
        if (s.warning === 0) { if (distance3(s, p) < 8 && p.flash === 0) { p.lives--; p.flash = 2; } s.cooldown = 3; }
      } else if (s.cooldown === 0 && distance3(s, p) < 10) { s.warning = 1.3; g.notice = 'Tentacles preparing to strike. Swim outside the red ring!'; }
    });
    const winners = g.players.map((p, i) => p.lives > 0 && (g.kind === 'jumpingspider' ? p.progress === 23 : p.food >= 3 && p.y > -3) ? i : -1).filter(i => i >= 0);
    const active = ai && g.kind === 'spermwhale' ? [g.players[0]] : g.players;
    if (winners.length || active.some(p => p.lives <= 0) || g.time <= 0) {
      g.phase = 'finished';
      if (winners.length) g.winner = winners.length === 2 ? null : winners[0] as Player;
      else if (ai && g.kind === 'spermwhale') g.winner = 1;
      else { const scores = g.players.map(p => p.lives <= 0 ? -1 : (g.kind === 'jumpingspider' ? p.progress : p.food) * 10 + p.lives); g.winner = scores[0] === scores[1] ? null : scores[0] > scores[1] ? 0 : 1; }
    }
  }
}
