import type { Player } from './naturaData';
import { worldRandom } from './random.ts';
export type Lane = 0 | 1 | 2;
export type OceanPlayer = { lane: Lane; x: number; lives: number; score: number; invincible: number; held: number };
export type OceanWave = { id: number; z: number; lanes: Lane[]; kind: 'gull' | 'tuna'; resolved: [boolean, boolean]; switchLanes?: Lane[]; switched?: boolean };
export type LaneOcean = { kind: 'flyingfish'; manual?: boolean; glide?: number; actionHeld?: boolean; randomState: number; phase: 'ready' | 'playing' | 'paused' | 'finished'; zone: 'sky' | 'water'; time: number; elapsed: number; phaseTime: number; transition: number; spawn: number; nextId: number; waves: OceanWave[]; players: [OceanPlayer, OceanPlayer]; winner: Player | null; notice: string };
export function createLaneOcean(seed = 1): LaneOcean {
  const player = (): OceanPlayer => ({lane: 1, x: 0, lives: 3, score: 0, invincible: 0, held: 0});
  return { kind: 'flyingfish', randomState: seed >>> 0, phase: 'ready', zone: 'sky', time: 54, elapsed: 0, phaseTime: 9, transition: 0, spawn: 0.6, nextId: 0, waves: [], players: [player(), player()], winner: null, notice: 'Three lanes. Watch the horizon and move into the open lane.' };
}
/** Waves never block all three lanes; spacing leaves time to cross two lanes. */
export function makeOceanWave(id: number, zone: LaneOcean['zone'], random = Math.random): OceanWave {
  const safe = Math.min(2, Math.floor(random() * 3));
  const blocked = ([0, 1, 2] as Lane[]).filter(l => l !== safe);
  return { id, z: -70, lanes: id < 2 ? [blocked[id % 2]] : blocked, kind: zone === 'sky' ? 'gull' : 'tuna', resolved: [false, false], ...(id >= 4 && id % 3 === 0 ? { switchLanes: ([0,1,2] as Lane[]).filter(l => l !== (safe + 1) % 3) } : {}) };
}
export function updateLaneOcean(g: LaneOcean, directions: [number, number], seconds: number, ai: boolean, action = false) {
  if (g.phase !== 'playing' || !Number.isFinite(seconds) || seconds <= 0) return;
  let remaining = Math.min(seconds, 0.1);
  while (remaining > 0.000001 && g.phase === 'playing') {
    const dt = Math.min(remaining, 1 / 120); remaining -= dt;
    g.elapsed += dt; g.time = Math.max(0, g.time - dt); g.phaseTime -= dt;
    if(g.manual) {
      g.glide=Math.max(0,Math.min(9,(g.glide??9)+(g.zone==='sky'?-1:1.8)*dt));
      if((action && !g.actionHeld && (g.zone==='sky'||g.glide>=2)) || g.zone==='sky'&&g.glide===0) {
        g.zone=g.zone==='sky'?'water':'sky';g.transition=1;g.notice=g.zone==='sky'?'Gliding. Save energy for the next escape.':'Swimming. Glide energy is refilling.';
      }
      g.actionHeld=action;g.phaseTime=g.glide;
    } g.transition = Math.max(0, g.transition - dt);
    if (!g.manual && g.phaseTime <= 0) { g.zone = g.zone === 'sky' ? 'water' : 'sky'; g.phaseTime += 9; g.transition = 1; g.waves = []; g.spawn = 0.5; g.notice = g.zone === 'sky' ? 'Above the waves. Gulls approach head-on.' : 'Below the surface. Tuna approach head-on.'; }
    g.spawn -= dt;
    if (g.spawn <= 0) { g.waves.push(makeOceanWave(g.nextId++, g.manual ? g.nextId%2 ? 'sky' : 'water' : g.zone, () => worldRandom(g))); g.spawn = Math.max(1.65, 2.4 - g.elapsed / 100); }
    g.players.forEach((p, i) => {
      if (ai && i === 1 || p.lives === 0) return;
      const dir = Math.sign(directions[i]);
      if (dir !== 0 && dir !== p.held) p.lane = Math.max(0, Math.min(2, p.lane + dir)) as Lane;
      p.held = dir;
      const target = (p.lane - 1) * 5, delta = target - p.x;
      p.x += Math.sign(delta) * Math.min(Math.abs(delta), 24 * dt);
      p.invincible = Math.max(0, p.invincible - dt);
    });
    g.waves.forEach(w => {
      if (w.switchLanes && !w.switched && w.z > -17) { w.lanes = w.switchLanes; w.switched = true; g.notice = 'The predators changed lanes. Follow the new opening.'; }
      const oldZ = w.z; w.z += (22 + g.elapsed * 0.12) * dt;
      if (oldZ < 0 && w.z >= 0) g.players.forEach((p, i) => {
        if (ai && i === 1 || p.lives === 0 || w.resolved[i]) return;
        w.resolved[i] = true;
        if(g.manual && (w.kind==='gull') !== (g.zone==='sky')) return;
        if (w.lanes.some(l => Math.abs((l - 1) * 5 - p.x) < 1.8)) {
          if (p.invincible <= 0) { p.lives--; p.invincible = 1.2; g.notice = 'Caught in the lane. Watch the next opening.'; }
        } else { p.score++; g.notice = 'Clean dodge. Keep watching the horizon.'; }
      });
    });
    g.waves = g.waves.filter(w => w.z < 15);
    const active = ai ? [g.players[0]] : g.players;
    if (g.time <= 0 || active.every(p => p.lives === 0)) {
      g.phase = 'finished';
      if (ai) g.winner = g.players[0].lives > 0 ? 0 : 1;
      else { const [a,b] = g.players; const delta = a.score - b.score || a.lives - b.lives; g.winner = delta === 0 ? null : delta > 0 ? 0 : 1; }
    }
  }
}
