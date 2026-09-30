import { activateAbility, canStorePower, stepJump } from './abilities.ts';
import { botPolicy } from './bots.ts';
import { EAT, playerRadius } from './config.ts';
import { clamp, distance } from './maps.ts';
import { random } from './spawn.ts';
import { clearTemporary, newStats, recordEvent } from './progression.ts';
import { checkWinner, eliminate, movePlayer, collectPower } from './engine.ts';
import { canEatPlayer, inMouth } from './rules.ts';
import { activateEscape, stepEscape } from './escape.ts';
import type { BlackHole, GameState, Player, Vec } from './types.ts';
const H = EAT.hell;
/** Primary field keeps old snapshots readable; new matches carry three independent paths. */
export const blackHoles = (s: GameState): BlackHole[] => s.hell ? [s.hell.blackHole, ...(s.hell.blackHoles?.slice(1) ?? [])] : [];
export function crackTile(s: GameState, index: number, collapseNow = false) {
  if (!s.hell || index < 0 || s.hell.cells[index] !== 0) return false;
  s.hell.cells[index] = Math.max(.000001, s.time - (collapseNow ? H.warningDuration : 0));
  return true;
}
const eruptionAt = (s: GameState, at: Vec) => (s.hell?.eruptions ?? []).some(e => s.time < e.endsAt && distance(at,e) < H.eruptionRadius);

export function cellCenter(index: number): Vec { return { x: H.left + (index % H.columns + .5) * H.cellSize, y: H.top + (Math.floor(index / H.columns) + .5) * H.cellSize }; }
export function cellIndex(p: Vec): number {
  const x = Math.floor((p.x - H.left) / H.cellSize), y = Math.floor((p.y - H.top) / H.cellSize);
  return x < 0 || y < 0 || x >= H.columns || y >= H.rows ? -1 : y * H.columns + x;
}
export function cellPhase(s: GameState, index: number) {
  const value = s.hell?.cells[index];
  return value === undefined || value < 0 ? 'destroyed' : value === 0 ? 'intact' : s.time - value < H.warningDuration ? 'warning' : 'destroying';
}
export function supported(s: GameState, at: Vec) { const i = cellIndex(at); return i >= 0 && cellPhase(s, i) !== 'destroyed'; }
export function safeGround(s: GameState, at: Vec, radius = 24) {
  for (const [x, y] of [[0, 0], [radius, 0], [-radius, 0], [0, radius], [0, -radius]]) if (cellPhase(s, cellIndex({ x: at.x + x, y: at.y + y })) !== 'intact') return false;
  return !eruptionAt(s,at);
}
export function nearbyLanding(s: GameState, p: Player, limit = H.cellSize * 1.5): Vec | null {
  return s.hell!.cells.map((_, i) => cellCenter(i)).filter(at => distance(at, p) <= limit && safeGround(s, at, playerRadius(p, s.time)) &&
    s.players.every(other => other === p || !other.alive || distance(at, other) > 55)).sort((a, b) => landingDanger(s,a)-landingDanger(s,b) || distance(a, p) - distance(b, p))[0] ?? null;
}
function landingDanger(s: GameState, at: Vec) {
  return blackHoles(s).reduce((n,b)=>n+(visiblePathDistance(s,at,true,b)<H.radius+55?1:0),0);
}
export function startHell(s: GameState) {
  if (s.settings?.hellEnabled === false) return;
  if (s.phase !== 'normal' || s.status !== 'playing') return;
  // A waiting respawn still owns a life; it must not lose eligibility at a clock boundary.
  const contenders = s.players.filter(p => p.alive || (s.settings?.livesEnabled !== false && (p.lives ?? 0) > 0));
  const e = s.encounter;
  const helperOwner = s.settings?.animalsEnabled !== false && e?.npc.phase === 'friendly' && e.completedBy === e.npc.targetId && e.npc.until > s.time ? e.completedBy : null;
  s.phase = 'transition';
  s.nextPower = s.time + H.transitionDuration + H.speedInterval;
  s.hell = { nextEruption: s.time + H.transitionDuration + H.eruptionInterval, eruptions: [], startedAt: s.time, readyAt: s.time + H.transitionDuration, participants: contenders.map(p => p.id), cells: Array(H.columns * H.rows).fill(0),
    blackHole: { x: H.left, y: H.top, from: { x: H.left, y: H.top }, destination: cellCenter(0), warnUntil: s.time + H.transitionDuration + H.sweepWarning, sweep: 0 } };
  for (const p of s.players) {
    const stats = p.stats ??= newStats(); stats.normalFinalMass = p.mass; stats.maxMass = Math.max(stats.maxMass, p.mass);
    const helper = p.id === helperOwner && e ? { kind: e.npc.kind, until: Infinity, used: false, hell: true } : undefined;
    clearTemporary(s, p); if (helper) p.helper = { ...helper, until: 0 };
  }
  // Normal props and encounter state never participate in the final arena.
  s.food = []; s.powerups = []; delete s.encounter;
  contenders.forEach((p, i) => {
    const angle = i / contenders.length * Math.PI * 2;
    delete p.respawnAt; Object.assign(p, { x: H.left + H.columns * H.cellSize / 2 + Math.cos(angle) * H.spawnRadius, y: H.top + H.rows * H.cellSize / 2 + Math.sin(angle) * H.spawnRadius,
      alive: true, hellScale: H.characterScale, mass: EAT.player.startingMass, eliminatedAt: null, eliminatedBy: null, placement: null });
  });
  const primary = s.hell.blackHole;
  s.hell.blackHoles = [primary, ...[1,2].map(i => ({ ...primary, x:H.left+H.columns*H.cellSize*(i===1?1:.5), y:H.top+H.rows*H.cellSize*(i===1?0:1), from:{...primary.from},destination:{...primary.destination} }))];
  blackHoles(s).forEach((b,i) => planSweep(s,b,i*.45)); recordEvent(s, { type: 'hellStart', playerId: '', x: EAT.match.width / 2, y: EAT.match.height / 2 });
}
function planSweep(s: GameState, b = s.hell!.blackHole, stagger = 0) {
  const h = s.hell!;
  const intact = h.cells.flatMap((v, i) => v === 0 ? [i] : []);
  const candidates = intact.length ? intact : h.cells.flatMap((v, i) => v >= 0 ? [i] : []);
  if (!candidates.length) return;
  b.from = { x: b.x, y: b.y }; b.destination = cellCenter(candidates[Math.floor(random(s) * candidates.length)]);
  // Spread endpoints, avoiding repeated convergence on one surviving patch when alternatives exist.
  for (let attempt=0;attempt<12 && blackHoles(s).some(other=>other!==b && distance(other.destination,b.destination)<H.radius*3);attempt++)
    b.destination = cellCenter(candidates[Math.floor(random(s)*candidates.length)]);
  const roll = random(s);
  b.speedCategory = roll < H.slowChance ? 'slow' : roll < H.fastThreshold ? 'normal' : roll < H.extremeThreshold ? 'fast' : 'extreme';
  b.speed = Math.min(H.maxSpeed, H.baseSpeed + Math.max(0, s.time - h.readyAt) * 1.3) * H.speedFactors[b.speedCategory];
  delete b.control;
  if (random(s) < H.curveChance) {
    const dx = b.destination.x - b.from.x, dy = b.destination.y - b.from.y, bend = random(s) < .5 ? -.45 : .45;
    b.control = { x: clamp((b.from.x + b.destination.x)/2 - dy*bend, H.left, H.left+H.columns*H.cellSize), y: clamp((b.from.y + b.destination.y)/2 + dx*bend, H.top, H.top+H.rows*H.cellSize) };
  }
  b.progress = 0; b.pauseUsed = false; b.pausedUntil = 0;
  const points = sweepPath(b); b.pathLength = points.slice(1).reduce((sum, p, i) => sum + distance(p, points[i]), 0);
  b.warningAt = Math.max(s.time, h.readyAt) + stagger;
  b.warnUntil = b.warningAt + (b.speedCategory === 'extreme' ? H.extremeWarning : H.sweepWarning); b.sweep++;
  recordEvent(s, { type: 'sweep', playerId: '', x: b.destination.x, y: b.destination.y });
}
/** The renderer, simulation and bots all use this locked quadratic path. */
export function sweepPoint(b: NonNullable<GameState['hell']>['blackHole'], t: number): Vec {
  const c = b.control ?? { x: (b.from.x+b.destination.x)/2, y: (b.from.y+b.destination.y)/2 }, u = 1-t;
  return { x: u*u*b.from.x+2*u*t*c.x+t*t*b.destination.x, y: u*u*b.from.y+2*u*t*c.y+t*t*b.destination.y };
}
export function sweepPath(b: NonNullable<GameState['hell']>['blackHole'], start = 0) { return Array.from({ length: 25 }, (_, i) => sweepPoint(b, start+(1-start)*i/24)); }
function visiblePathDistance(s: GameState, p: Vec, seesWarning: boolean, b = s.hell!.blackHole) {
  if (!seesWarning) return distance(p, b);
  const points = sweepPath(b, b.progress ?? 0);
  return Math.min(...points.slice(1).map((point, i) => pathDistance(p, points[i], point)));
}
function pathDistance(p: Vec, a: Vec, b: Vec) {
  const dx = b.x - a.x, dy = b.y - a.y, t = clamp(((p.x - a.x) * dx + (p.y - a.y) * dy) / Math.max(1, dx * dx + dy * dy), 0, 1);
  return distance(p, { x: a.x + dx * t, y: a.y + dy * t });
}
export function hellBotInput(s: GameState, p: Player) {
  const holes = blackHoles(s), policy = botPolicy(s);
  const paths = holes.map(b=>s.time >= (b.warningAt ?? b.warnUntil-H.sweepWarning)+policy.warningDelay ? sweepPath(b,b.progress??0) : [b]);
  const pathDanger = (at: Vec) => Math.min(...paths.map(points=>points.length===1 ? distance(at,points[0]) : points.slice(1).reduce((best,p,i)=>Math.min(best,pathDistance(at,points[i],p)),Infinity))); 
  const holeDistance = (at: Vec) => Math.min(...holes.map(b=>distance(at,b)));
  const radius = playerRadius(p, s.time);
  const danger = !safeGround(s, p, radius) || holeDistance(p) < H.radius + 100 || pathDanger(p) < H.radius + 40;
  if (danger && p.helper && !p.helper.used && !p.escape) activateEscape(s, p);
  // Sample reachable directions against the public current/telegraphed arena only.
  let best = -Infinity, input = { x: 0, y: 0 };
  for (let i = 0; i < policy.hellSamples; i++) {
    const a = i * Math.PI * 2 / policy.hellSamples, dir = { x: Math.cos(a), y: Math.sin(a) };
    const at = { x: p.x + dir.x * 95, y: p.y + dir.y * 95 };
    if (![.3, .6, 1].every(t => safeGround(s, { x: p.x + dir.x * 95 * t, y: p.y + dir.y * 95 * t }, 10))) continue;
    const eruptionDanger = (s.hell!.eruptions ?? []).filter(e => s.time >= e.warningAt + policy.warningDelay && s.time < e.endsAt);
    const eruptionPenalty = eruptionDanger.reduce((sum, e) => sum + Math.max(0, H.eruptionRadius + radius + 70 - distance(at, e))*8, 0);
    const speedItem = s.powerups.filter(item => canStorePower(s,p,item.kind)).sort((a,b) => distance(a,p)-distance(b,p))[0];
    const itemReward = speedItem && distance(speedItem,p) < 450 ? Math.max(0, 450-distance(speedItem,at))*.35 : 0;
    const neighbors = [[80, 0], [-80, 0], [0, 80], [0, -80]].filter(([x, y]) => safeGround(s, { x: at.x + x, y: at.y + y })).length;
    const edge = Math.min(at.x - H.left, H.left + H.columns * H.cellSize - at.x, at.y - H.top, H.top + H.rows * H.cellSize - at.y);
    const score = Math.min(400, holeDistance(at)) + Math.min(160, pathDanger(at)) * 2 + neighbors * 55 + Math.min(100, edge) - eruptionPenalty + itemReward;
    if (score > best) { best = score; input = dir; }
  }
  if (p.storedJump && !p.escape && (danger || policy.warningDelay > .5)) {
    let landingScore = -Infinity, leap: Vec | undefined;
    for (let i=0;i<policy.hellSamples;i++) {
      const angle=i*Math.PI*2/policy.hellSamples, dir={x:Math.cos(angle),y:Math.sin(angle)};
      const at={x:p.x+dir.x*EAT.powerups.jump.distance,y:p.y+dir.y*EAT.powerups.jump.distance};
      const gap=[.2,.4,.6,.8].some(t=>!supported(s,{x:p.x+dir.x*EAT.powerups.jump.distance*t,y:p.y+dir.y*EAT.powerups.jump.distance*t}));
      if (!safeGround(s,at,radius) || (!gap && !danger && policy.warningDelay<=.5)) continue;
      const score=holeDistance(at)+pathDanger(at)*2;
      if(score>landingScore){landingScore=score;leap=dir;}
    }
    if(leap && (best===-Infinity || landingScore>holeDistance(p)+pathDanger(p)*2 || policy.warningDelay>.5)) {
      p.input=leap; if(activateAbility(s,p,'jump')) return leap;
    }
  }
  if (p.storedStrike && danger && best>-Infinity && [.15,.3,.45,.6,.75,1].every(t=>safeGround(s,{x:p.x+input.x*EAT.powerups.strike.distance*t,y:p.y+input.y*EAT.powerups.strike.distance*t},radius))) {
    p.input=input;activateAbility(s,p,'strike');
  }
  p.botState = 'FLEE'; return input;
}
export function stepHell(s: GameState, dt: number) {
  const h = s.hell!;
  if (h.blackHoles) h.blackHoles[0] = h.blackHole;
  if (s.time < h.readyAt) return;
  s.phase = 'hell';
  for (const b of blackHoles(s)) {
  if (s.time >= b.warnUntil) {
    const progress = b.progress ?? 0;
    // Pause randomness is sampled only during motion; bots never inspect a future pause.
    if (!b.pauseUsed && progress > .15 && progress < .8 && random(s) < dt * H.pauseChancePerSecond) { b.pauseUsed = true; b.pausedUntil = s.time + H.pauseMin + random(s)*(H.pauseMax-H.pauseMin); }
    if (s.time >= (b.pausedUntil ?? 0)) {
      const c = b.control ?? { x: (b.from.x+b.destination.x)/2, y: (b.from.y+b.destination.y)/2 };
      const derivative = Math.hypot(2*((1-progress)*(c.x-b.from.x)+progress*(b.destination.x-c.x)), 2*((1-progress)*(c.y-b.from.y)+progress*(b.destination.y-c.y)));
      b.progress = Math.min(1, progress + (b.speed ?? H.baseSpeed) * dt / Math.max(1, derivative));
      Object.assign(b, sweepPoint(b, b.progress));
    }
    let cracked = false;
    h.cells.forEach((value, i) => { if (value === 0 && distance(cellCenter(i), b) < H.radius) { cracked = crackTile(s,i) || cracked; } });
    if (cracked && !s.events.some(e => e.type === 'groundWarning' && s.time - e.at < .4)) recordEvent(s, { type: 'groundWarning', playerId: '', x: b.x, y: b.y }, false);
    if ((b.progress ?? 0) >= 1) planSweep(s,b);
  }
  }
  let destroyed = false;
  h.cells.forEach((v, i) => { if (v > 0 && s.time - v >= H.warningDuration + H.destructionDuration) { h.cells[i] = -1; destroyed = true; } });
  if (destroyed && !s.events.some(e => e.type === 'groundDestroyed' && s.time - e.at < 1)) recordEvent(s, { type: 'groundDestroyed', playerId: '', x: h.blackHole.x, y: h.blackHole.y });
  stepEruptions(s); spawnHellSpeed(s);
  const fallen: Player[] = [];
  for (const p of s.players) {
    if (!p.alive) continue;
    if (p.stats) p.stats.hellTime = Math.max(0, s.time - h.readyAt);
    if (p.fallingAt !== undefined) { if (s.time - p.fallingAt >= H.fallDuration) fallen.push(p); continue; }
    if (p.bot && s.time >= p.nextDecision) { p.input = hellBotInput(s, p); p.nextDecision = s.time + botPolicy(s).interval; }
    if (p.ability?.kind === 'jump') stepJump(s,p); else if (p.escape) stepEscape(s, p, dt); else movePlayer(s, p, p.input, dt);
    // Pigeon flies throughout the assist. Cat crosses at most one cell-width gap.
    const protectedFromLava = p.escape && (p.escape.kind === 'pigeon' || (p.escape.gapDistance <= H.cellSize * 1.2 && s.time - (p.escape.gapSince ?? s.time) <= .4));
    if (!supported(s, p) && !protectedFromLava && p.ability?.kind !== 'jump') { p.fallingAt = s.time; delete p.escape; delete p.ability; p.vx = 0; p.vy = 0; recordEvent(s, { type: 'fall', playerId: p.id, x: p.x, y: p.y }); }
  }
  for (const a of s.players) for (const b of s.players) if (canEatPlayer(a,b,s.time)) eliminate(s,b,a);
  const living = s.players.filter(p => p.alive);
  // Preserve the final falling cohort even when its fall animations end on different ticks.
  if (living.length && living.every(p => p.fallingAt !== undefined)) h.finalists ??= living.map(p => p.id);
  const placement = living.length;
  // Commit every elimination in this tick before deciding the outcome.
  for (const p of fallen) {
    eliminate(s, p); p.placement = placement;
    if (p.stats) { p.stats.fellInLava = true; p.stats.hellCause = 'Fell into lava'; }
    recordEvent(s, { type: 'lava', playerId: p.id, x: p.x, y: p.y });
  }
  for (const item of [...s.powerups]) {
    const player = s.players.find(p => p.alive && !p.escape && p.ability?.kind !== 'jump' && p.fallingAt === undefined && canStorePower(s,p,item.kind) && inMouth(p, item, EAT.powerups.radius, 0, s.time));
    if (player) collectPower(s, player, item);
  }
  checkWinner(s);
}

export function spawnHellSpeed(s: GameState) {
  s.powerups = s.powerups.filter(p => safeGround(s, p, EAT.powerups.radius));
  if (s.time < s.nextPower) return;
  s.nextPower = s.time + H.speedInterval;
  if (s.powerups.length >= 3) return;
  // Flood fill intact cells from living players: isolated islands cannot receive items.
  const clearance = Math.min(...s.players.filter(p => p.alive).map(p => playerRadius(p,s.time)), EAT.player.minRadius*H.characterScale);
  const reachable = new Set<number>(), queue = s.players.filter(p => p.alive).map(p => cellIndex(p)).filter(i => i >= 0);
  for (let q = 0; q < queue.length; q++) {
    const i = queue[q]; if (reachable.has(i) || !safeGround(s,cellCenter(i),clearance)) continue;
    reachable.add(i);
    for (const next of [i-H.columns, i+H.columns, ...(i%H.columns ? [i-1] : []), ...(i%H.columns < H.columns-1 ? [i+1] : [])]) if (next >= 0 && next < s.hell!.cells.length && !reachable.has(next)) queue.push(next);
  }
  const candidates = [...reachable].map(cellCenter).filter(at => safeGround(s,at,EAT.powerups.radius) && blackHoles(s).every(b=>distance(at,b)>H.radius+120) && s.players.every(p => !p.alive || distance(at,p)>playerRadius(p,s.time)+EAT.powerups.radius+16) && !(s.hell!.eruptions ?? []).some(e => distance(at,e)<H.eruptionRadius+40));
  if (!candidates.length) return;
  const roll = random(s)*100;
  let kind: 'speed'|'jump'|'strike' = roll < EAT.powerups.jump.weight ? 'jump' : roll < EAT.powerups.jump.weight+EAT.powerups.strike.hellWeight ? 'strike' : 'speed';
  if (kind !== 'speed') {
    const config = EAT.powerups[kind];
    if (s.time < (s.nextRare?.[kind] ?? 0) || s.powerups.filter(p=>p.kind===kind).length >= config.maxActive) kind='speed';
    else { s.nextRare ??= {}; s.nextRare[kind]=s.time+config.cooldown; }
  }
  s.powerups.push({ ...candidates[Math.floor(random(s)*candidates.length)], id:s.nextId++, kind });
}
export function stepEruptions(s: GameState) {
  const h = s.hell!; h.eruptions ??= []; h.nextEruption ??= h.readyAt+H.eruptionInterval;
  for (const e of h.eruptions) if (s.time >= e.endsAt) {
    h.cells.forEach((_,i)=>{ if (distance(cellCenter(i),e)<H.eruptionRadius) crackTile(s,i,true); });
  }
  h.eruptions = h.eruptions.filter(e => s.time < e.endsAt);
  if (s.time >= h.nextEruption) {
    h.nextEruption = s.time + H.eruptionInterval - H.eruptionVariation + random(s)*H.eruptionVariation*2;
    const candidates = h.cells.flatMap((v,i) => v === 0 && safeGround(s,cellCenter(i),H.eruptionRadius) ? [cellCenter(i)] : []);
    for (let i=0, count=1+Math.floor(random(s)*2); i<count && candidates.length; i++) {
      const at = candidates.splice(Math.floor(random(s)*candidates.length),1)[0];
      h.eruptions.push({ ...at, id:s.nextId++, warningAt:s.time, eruptAt:s.time+H.eruptionWarning, endsAt:s.time+H.eruptionWarning+H.eruptionDuration, hit:[] });
      recordEvent(s,{ type:'eruption', playerId:'', ...at },false);
    }
  }
  for (const e of h.eruptions) if (s.time >= e.eruptAt) for (const p of s.players) {
    if (!p.alive || p.escape || p.ability?.kind === 'jump' || p.fallingAt !== undefined || e.hit.includes(p.id) || distance(p,e)>H.eruptionRadius+playerRadius(p,s.time)*.5) continue;
    e.hit.push(p.id); const d = Math.max(1,distance(p,e)), dx = d<=1 ? Math.cos(p.facing) : (p.x-e.x)/d, dy = d<=1 ? Math.sin(p.facing) : (p.y-e.y)/d;
    p.knockback = { x:dx*H.eruptionPush/.4, y:dy*H.eruptionPush/.4, until:s.time+.4 };
    p.stunnedUntil = Math.max(p.stunnedUntil ?? 0,s.time+.4);
  }
}
