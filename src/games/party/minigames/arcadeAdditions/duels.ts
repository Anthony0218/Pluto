import type { MinigameDefinition } from '../types.ts';
import { applyControl, blocked, control, createBase, distance, parseControl, publicBase, random, rankScores, scores, step, toward, walk, BOT_REACTION, type ArcadeInput, type ArcadeState, type Pawn, type Wall } from './common.ts';

export const DISC_WALLS: Wall[] = [{ x: 31, y: 34, w: 8, h: 32 }, { x: 61, y: 34, w: 8, h: 32 }];
interface Fighter extends Pawn { hp: number; protectedUntil: number; dashUntil: number; nextShotAt: number; facingX: number; facingY: number }
export interface Disc { id: number; owner: string; x: number; y: number; vx: number; vy: number; bounced: boolean; expiresAt: number }
export interface RicochetState extends ArcadeState<Fighter> { discs: Disc[]; nextDiscId: number; winner: string | null }
export const ricochetRivals: MinigameDefinition<RicochetState, ArcadeInput> = {
  id: 'ricochet-rivals', name: 'Ricochet Rivals', description: 'Bounce energy discs around cover in a three-hit duel. Your own rebound can hurt you!',
  instructions: ['Three hits defeat your opponent. Highest remaining health wins at 60 seconds.', 'Discs bounce off a wall once. Rebounds can hit their owner.', 'Space dashes with a three-second cooldown. A hit grants one second of protection.'],
  controls: 'WASD / arrows · mouse to aim · click / F to fire · Space dash · touch movement, aim pad, Fire and Dash', durationSeconds: 60, gameType: 'duel', supportsBots: true, snapshotIntervalMs: 80,
  create(c) { const b = createBase(c); return { ...b, players: Object.fromEntries(Object.entries(b.players).map(([id, p], i) => [id, { ...p, x: i ? 85 : 15, y: 50, hp: 3, protectedUntil: 0, dashUntil: 0, nextShotAt: 0, facingX: i ? -1 : 1, facingY: 0 }])), discs: [], nextDiscId: 0, winner: null }; },
  parseInput: parseControl, applyInput: applyControl,
  tick(s, now) { return step(s, now, (at, dt) => {
    for (const [id, p] of Object.entries(s.players)) {
      const i = control(s, id, at); if (i && Math.hypot(i.aimX, i.aimY) > .1) { const len = Math.hypot(i.aimX, i.aimY); p.facingX = i.aimX / len; p.facingY = i.aimY / len; }
      if (i?.action && !p.actionHeld && at >= p.nextActionAt) { p.dashUntil = at + 200; p.nextActionAt = at + 3000; } p.actionHeld = i?.action ?? false;
      walk(p, i, at < p.dashUntil ? 65 : 25, dt, DISC_WALLS);
      if (i?.fire && at >= p.nextShotAt) { p.nextShotAt = at + 650; s.discs.push({ id: s.nextDiscId++, owner: id, x: p.x + p.facingX * 3, y: p.y + p.facingY * 3, vx: p.facingX * 48, vy: p.facingY * 48, bounced: false, expiresAt: at + 4000 }); }
    }
    for (const d of s.discs) {
      if (s.winner) break;
      if (d.expiresAt <= at) continue;
      const nx = d.x + d.vx * dt, ny = d.y + d.vy * dt;
      const hitX = nx < 1 || nx > 99 || blocked({ x: nx, y: d.y }, DISC_WALLS, .7);
      const hitY = ny < 1 || ny > 99 || blocked({ x: d.x, y: ny }, DISC_WALLS, .7);
      if (hitX || hitY || blocked({ x: nx, y: ny }, DISC_WALLS, .7)) {
        if (d.bounced) { d.expiresAt = at; continue; } d.bounced = true;
        if (hitX) d.vx *= -1; if (hitY || !hitX) d.vy *= -1;
      } else { d.x = nx; d.y = ny; }
      for (const [id, p] of Object.entries(s.players)) if ((id !== d.owner || d.bounced) && at >= p.protectedUntil && distance(p, d) < 2.8) {
        p.hp--; p.protectedUntil = at + 1000; d.expiresAt = at;
        if (p.hp <= 0) s.winner = Object.keys(s.players).find((other) => other !== id)!;
        break;
      }
    }
    s.discs = s.discs.filter((d) => d.expiresAt > at); for (const p of Object.values(s.players)) p.score = p.hp;
  }, () => s.winner !== null); },
  botInputs(s, bot, now) {
    const p = s.players[bot.id], enemy = Object.entries(s.players).find(([id]) => id !== bot.id)?.[1]; if (!p || !enemy || now < (s.bots[bot.id] ?? s.startedAt)) return [];
    s.bots[bot.id] = now + BOT_REACTION[bot.difficulty];
    // Cross the central cover via either open corridor, then aim at the rival.
    const target = Math.abs(p.x - enemy.x) > 30 && p.y > 28 && p.y < 72 ? { x: p.x, y: p.y < 50 ? 23 : 77 } : enemy;
    const input = toward(p, target, bot.difficulty, !p.actionHeld && s.discs.some((d) => (d.owner !== bot.id || d.bounced) && distance(p, d) < 15), true);
    const aim = toward(p, enemy, bot.difficulty); input.aimX = aim.aimX; input.aimY = aim.aimY;
    if (distance(p, enemy) < 18) { input.x *= -1; input.y *= -1; }
    return [{ at: now, input }];
  }, scores, rank: rankScores, isFinished: (s) => s.winner !== null,
  publicView: (s) => ({ ...publicBase(s), discs: structuredClone(s.discs), winner: s.winner }),
};

export const FUSE_WALLS: Wall[] = [{ x: 43, y: 25, w: 14, h: 20 }, { x: 43, y: 55, w: 14, h: 20 }];
export interface FuseState extends ArcadeState { carrier: string; explodesAt: number; passAfter: number; round: number; breakUntil: number; winner: string | null; lastLoser: string | null }
export const fuseFaceoff: MinigameDefinition<FuseState, ArcadeInput> = {
  id: 'fuse-faceoff', name: 'Fuse Faceoff', description: 'Pass a ticking comet by touching your rival. Survive three explosions to win.',
  instructions: ['Touch your opponent to pass the comet. It explodes after a random 8–12 seconds.', 'A pass pushes players apart and locks passing for 0.9 seconds.', 'First to three round wins takes the duel. There are up to five rounds with short breaks.'], controls: 'WASD / arrows · touch direction pad', durationSeconds: 75, gameType: 'duel', supportsBots: true, snapshotIntervalMs: 80,
  create(c) { const b = createBase(c), ids = Object.keys(b.players), carrier = ids[Math.floor(random(b) * ids.length)]; for (const [i, p] of Object.values(b.players).entries()) { p.x = i ? 78 : 22; p.y = 50; } return { ...b, carrier, explodesAt: c.startedAt + 8000 + random(b) * 4000, passAfter: c.startedAt + 500, round: 1, breakUntil: 0, winner: null, lastLoser: null }; },
  parseInput: parseControl, applyInput: applyControl,
  tick(s, now) { return step(s, now, (at, dt) => {
    if (at < s.breakUntil) return;
    const ids = Object.keys(s.players);
    for (const [id, p] of Object.entries(s.players)) walk(p, control(s, id, at), id === s.carrier ? 29 : 27, dt, FUSE_WALLS);
    if (at >= s.explodesAt) {
      const winner = ids.find((id) => id !== s.carrier)!; s.players[winner].score++; s.lastLoser = s.carrier;
      if (s.players[winner].score >= 3) { s.winner = winner; return; }
      s.round++; s.breakUntil = at + 1400; s.carrier = s.lastLoser; s.passAfter = s.breakUntil + 500; s.explodesAt = s.breakUntil + 8000 + random(s) * 4000;
      for (const [i, p] of Object.values(s.players).entries()) { p.x = i ? 78 : 22; p.y = 50; } s.controls = {}; return;
    }
    const p = s.players[s.carrier], other = ids.find((id) => id !== s.carrier)!, q = s.players[other];
    if (at >= s.passAfter && distance(p, q) < 4.5) {
      s.carrier = other; s.passAfter = at + 900;
      const dx = q.x - p.x, dy = q.y - p.y, len = Math.max(.001, Math.hypot(dx, dy));
      walk(p, { x: len === .001 ? -1 : -dx / len, y: -dy / len }, 5, 1, FUSE_WALLS); walk(q, { x: len === .001 ? 1 : dx / len, y: dy / len }, 5, 1, FUSE_WALLS);
    }
  }, () => s.winner !== null); },
  botInputs(s, bot, now) {
    const p = s.players[bot.id], q = Object.entries(s.players).find(([id]) => id !== bot.id)?.[1]; if (!p || !q || now < (s.bots[bot.id] ?? s.startedAt)) return []; s.bots[bot.id] = now + BOT_REACTION[bot.difficulty];
    const chase = s.carrier === bot.id, across = (p.x < 43 && q.x > 57) || (p.x > 57 && q.x < 43);
    let target = chase ? q : { x: p.x < q.x ? 8 : 92, y: p.y < q.y ? 8 : 92 };
    if (across && (p.y < 48 || p.y > 52)) target = { x: p.x, y: 50 };
    if (!chase && distance(p, target) < 5) target = { x: p.x < 50 ? 20 : 80, y: p.y < 50 ? 90 : 10 };
    return [{ at: now, input: toward(p, target, bot.difficulty) }];
  }, scores, rank: rankScores, isFinished: (s) => s.winner !== null,
  publicView: (s) => ({ ...publicBase(s), carrier: s.carrier, explodesAt: s.explodesAt, passAfter: s.passAfter, round: s.round, breakUntil: s.breakUntil, winner: s.winner, lastLoser: s.lastLoser }),
};

export const GRAVITY_WALLS: Wall[] = [{ x: 44, y: 20, w: 12, h: 18 }, { x: 44, y: 62, w: 12, h: 18 }];
export interface GravityState extends ArcadeState<Pawn & { pulling: boolean }> { pluto: { x: number; y: number; vx: number; vy: number }; breakUntil: number; winner: string | null; sides: Record<string, number> }
function clearBeam(a: { x: number; y: number }, b: { x: number; y: number }) { for (let t = 0; t <= 1; t += .05) if (blocked({ x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t }, GRAVITY_WALLS, 0)) return false; return true; }
export const gravityTug: MinigameDefinition<GravityState, ArcadeInput> = {
  id: 'gravity-tug', name: 'Gravity Tug', description: 'Pull a drifting Golden Pluto into your goal. Release the beam to move faster and steal the angle.',
  instructions: ['Hold Pull to attract the Pluto within range and clear sight. Pulling slows you down.', 'The Pluto keeps drifting after you release. Cover blocks beams and bounces the Pluto.', 'First to three goals wins, or highest goals after 45 seconds. Goals are the glowing pockets at the left and right edges.'], controls: 'WASD / arrows · hold Space to pull · touch direction pad and Pull', durationSeconds: 45, gameType: 'duel', supportsBots: true, snapshotIntervalMs: 80,
  create(c) { const b = createBase(c); for (const [i, p] of Object.values(b.players).entries()) { p.x = i ? 78 : 22; p.y = 50; } return { ...b, players: Object.fromEntries(Object.entries(b.players).map(([id, p]) => [id, { ...p, pulling: false }])), pluto: { x: 50, y: 50, vx: (random(b) - .5) * 8, vy: 0 }, breakUntil: 0, winner: null, sides: Object.fromEntries(c.participants.map((p, i) => [p.id, i])) }; }, parseInput: parseControl, applyInput: applyControl,
  tick(s, now) { return step(s, now, (at, dt) => {
    if (at < s.breakUntil) return;
    const orb = s.pluto;
    for (const [id, p] of Object.entries(s.players)) { const i = control(s, id, at); walk(p, i, i?.action ? 16 : 28, dt, GRAVITY_WALLS); const len = distance(p, orb);
      p.pulling = !!i?.action && len < 48 && len > .5 && clearBeam(p, orb);
      if (p.pulling) { const force = 48 * (1 - len / 60); orb.vx += (p.x - orb.x) / len * force * dt; orb.vy += (p.y - orb.y) / len * force * dt; }
    }
    const speed = Math.hypot(orb.vx, orb.vy); if (speed > 35) { orb.vx *= 35 / speed; orb.vy *= 35 / speed; }
    orb.vx *= Math.pow(.7, dt); orb.vy *= Math.pow(.7, dt);
    const nx = orb.x + orb.vx * dt, ny = orb.y + orb.vy * dt;
    if (nx < 2 || nx > 98 || blocked({ x: nx, y: orb.y }, GRAVITY_WALLS, 1.5)) orb.vx *= -.7; else orb.x = nx;
    if (ny < 2 || ny > 98 || blocked({ x: orb.x, y: ny }, GRAVITY_WALLS, 1.5)) orb.vy *= -.7; else orb.y = ny;
    if ((orb.x < 8 || orb.x > 92) && Math.abs(orb.y - 50) < 13) {
      const winner = Object.keys(s.players).find((id) => s.sides[id] === (orb.x < 50 ? 0 : 1))!; s.players[winner].score++;
      if (s.players[winner].score >= 3) s.winner = winner;
      s.breakUntil = at + 1000; Object.assign(orb, { x: 50, y: 50, vx: (random(s) - .5) * 8, vy: 0 });
      for (const [id, p] of Object.entries(s.players)) { p.x = s.sides[id] ? 78 : 22; p.y = 50; } s.controls = {};
    }
  }, () => s.winner !== null); },
  botInputs(s, bot, now) { const p = s.players[bot.id]; if (!p || now < (s.bots[bot.id] ?? s.startedAt)) return []; s.bots[bot.id] = now + BOT_REACTION[bot.difficulty];
    const goal = s.sides[bot.id] ? 96 : 4, orb = s.pluto;
    const offset = 9 + 5 * Math.sin((now - s.startedAt) / 1400 + s.sides[bot.id] * 2.4);
    const target = { x: Math.max(4, Math.min(96, orb.x + (goal < 50 ? -offset : offset))), y: 50 };
    if (blocked(target, GRAVITY_WALLS)) target.y = 50;
    return [{ at: now, input: toward(p, target, bot.difficulty, distance(p, orb) < 46 && clearBeam(p, orb)) }];
  }, scores, rank: rankScores, isFinished: (s) => s.winner !== null,
  publicView: (s) => ({ ...publicBase(s), pluto: { ...s.pluto }, breakUntil: s.breakUntil, winner: s.winner, sides: { ...s.sides } }),
};
