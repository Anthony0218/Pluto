import type { Player } from './naturaData';
export type Point3 = { x: number; y: number; z: number };
export type ExpeditionInput = { x: number; z: number; vertical: number; action: boolean; special: boolean };
export const idleExpeditionInput = (): ExpeditionInput => ({ x: 0, z: 0, vertical: 0, action: false, special: false });
export const SPIDER_COURSES = ['Dewdrop Garden', 'Bark & Brambles', 'Cloud Canopy'];
export type Platform3 = Point3 & { radius: number; checkpoint: boolean };
export function spiderPlatforms(level: number): Platform3[] {
  return Array.from({ length: 24 }, (_, i) => ({
    x: Math.sin(i * (level === 1 ? 0.7 : 0.5)) * (level === 2 ? 7 : 5),
    y: i * (level === 2 ? 0.65 : 0.4), z: -i * 5.3,
    radius: i === 0 || i % 4 === 0 || i === 23 ? 2.9 : 2.2 - level * 0.15,
    checkpoint: i % 4 === 0 || i === 23,
  }));
}
export type Explorer = Point3 & { vy: number; heading: number; lives: number; checkpoint: number; progress: number; silk: number; grounded: boolean; oxygen: number; food: number; cooldown: number; flash: number; sonar: number; sonarCooldown: number; actionHeld: boolean; specialHeld: boolean };
export type Squid = Point3 & { health: number; warning: number; cooldown: number; owner: Player };
export type Expedition = {
  kind: 'jumpingspider' | 'spermwhale'; phase: 'ready' | 'playing' | 'paused' | 'finished';
  time: number; elapsed: number; level: number; players: [Explorer, Explorer];
  platforms: Platform3[]; squids: Squid[]; winner: Player | null; notice: string;
};
const clamp = (x: number, min: number, max: number) => Math.max(min, Math.min(max, x));
export const distance3 = (a: Point3, b: Point3) => Math.hypot(a.x - b.x, a.y - b.y, a.z - b.z);
export function createExpedition(kind: Expedition['kind'], level = 0): Expedition {
  const player = (i: number): Explorer => ({ x: i ? 0.7 : -0.7, y: kind === 'jumpingspider' ? 0 : -2, z: 0, vy: 0, heading: Math.PI/2, lives: 3, checkpoint: 0, progress: 0, silk: 2, grounded: true, oxygen: 90, food: 0, cooldown: 0, flash: 0, sonar: 0, sonarCooldown: 0, actionHeld: false, specialHeld: false });
  return { kind, phase: 'ready', time: 180, elapsed: 0, level, players: [player(0), player(1)], platforms: spiderPlatforms(level),
    squids: ([0, 1] as const).flatMap(owner => Array.from({length: 3}, (_, i) => ({x: (owner ? 1 : -1) * (8 + i * 3), y: -18 - i * 13, z: -14 + i * 10, health: 3, warning: 0, cooldown: 3, owner}))),
    winner: null, notice: kind === 'jumpingspider' ? 'Follow the glowing leaves to the summit. Every fourth leaf saves your progress.' : 'Dive toward the marked depth. Use sonar to find your prey. Surface to breathe.' };
}
function rescue(g: Expedition, p: Explorer) {
  if (p.silk > 0) { p.silk--; g.notice = 'Your silk catches you. Back to the last checkpoint.'; }
  else { p.lives--; g.notice = 'A fall costs one heart. Reach a checkpoint to refill silk.'; }
  const c = g.platforms[p.checkpoint]; Object.assign(p, { x: c.x, y: c.y, z: c.z, vy: 0, grounded: true });
}
export function spiderAI(g: Expedition, difficulty: "easy" | "normal" | "hard" = "normal"): ExpeditionInput {
  const p = g.players[1], target = g.platforms[Math.min(23, p.progress + 1)];
  const dx = target.x - p.x, dz = target.z - p.z, d = Math.hypot(dx, dz);
  return { x: d > 0.15 ? dx / d : 0, z: d > 0.15 ? dz / d : 0, vertical: 0, action: p.grounded && !p.actionHeld && g.elapsed > (difficulty === "easy" ? 2.5 : difficulty === "hard" ? 0.5 : 1.5), special: false };
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
      p.cooldown = Math.max(0, p.cooldown - dt); p.flash = Math.max(0, p.flash - dt);
      if (g.kind === 'jumpingspider') {
        if (input.special && !p.specialHeld) rescue(g, p);
        if (input.action && !p.actionHeld && p.grounded) { p.vy = 10.8; p.grounded = false; }
        p.x += input.x / norm * 6.6 * dt; p.z += input.z / norm * 6.6 * dt;
        const oldY = p.y;
        if (p.grounded && !g.platforms.some(t => Math.abs(t.y - p.y) < 0.05 && Math.hypot(t.x - p.x, t.z - p.z) < t.radius)) p.grounded = false;
        if (!p.grounded) {
          p.vy -= 17 * dt; p.y += p.vy * dt;
          if (p.vy <= 0) {
            const index = g.platforms.findIndex(t => oldY >= t.y && p.y <= t.y && Math.hypot(t.x - p.x, t.z - p.z) < t.radius);
            if (index >= 0) {
              p.y = g.platforms[index].y; p.vy = 0; p.grounded = true; p.progress = Math.max(index, p.progress);
              if (g.platforms[index].checkpoint && index > p.checkpoint) { p.checkpoint = index; p.silk = 2; g.notice = `Checkpoint ${index + 1} reached. Silk refilled.`; }
            }
          }
          if (p.y < g.platforms[p.checkpoint].y - 8) rescue(g, p);
        }
      } else {
        p.x = clamp(p.x + input.x / norm * 10 * dt, -32, 32);
        p.z = clamp(p.z + input.z / norm * 10 * dt, -36, 30);
        p.y = clamp(p.y + input.vertical * 10 * dt, -65, -1);
        p.oxygen = p.y > -3 ? Math.min(90, p.oxygen + 25 * dt) : Math.max(0, p.oxygen - dt);
        p.sonar = Math.max(0, p.sonar - dt); p.sonarCooldown = Math.max(0, p.sonarCooldown - dt);
        if (input.special && !p.specialHeld && p.sonarCooldown === 0) { p.sonar = 4; p.sonarCooldown = 6; }
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
