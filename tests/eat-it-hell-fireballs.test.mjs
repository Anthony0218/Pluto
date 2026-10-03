import test from 'node:test';
import assert from 'node:assert/strict';
import { EAT, FOOD, playerRadius } from '../src/games/eat-it/config.ts';
import { createGame, fillBots, stepGame } from '../src/games/eat-it/engine.ts';
import { canEatPlayer } from '../src/games/eat-it/rules.ts';
import { startHell, stepHell, blackHoles, holeRadius, collectFireballs, spawnFireballs, cellCenter, safeGround } from '../src/games/eat-it/hell.ts';
import { updateSpawns } from '../src/games/eat-it/spawn.ts';
import { matchSettings } from '../src/games/eat-it/progression.ts';
const F = EAT.hell.fireball;
function hell(seed = 5) {
  const s = createGame('city', [{ id: 'a', name: 'A' }, { id: 'b', name: 'B' }], seed, 'fire', { mode: 'solo' });
  startHell(s); s.time = s.hell.readyAt; for (const b of blackHoles(s)) { b.warnUntil = 1e9; b.x = b.y = 0; }
  return s;
}

test('one fireball multiplies mass enough for a front bite on an equal rival', () => {
  const s = hell(), [a, b] = s.players;
  assert.ok(F.growth > EAT.eating.playerEatRadiusRatio ** 2);
  s.hell.fireballs = [{ id: 900, x: a.x, y: a.y, spawnedAt: s.time }];
  collectFireballs(s, a);
  assert.equal(s.hell.fireballs.length, 0); assert.ok(Math.abs(a.mass - EAT.player.startingMass * F.growth) < 1e-9);
  assert.equal(a.stats.fireballs, 1); assert.equal(a.stats.collected.fireball, 1);
  // Rival directly in front of the open mouth, standing still.
  Object.assign(b, { x: a.x + playerRadius(a, s.time) * .5, y: a.y, vx: 0, vy: 0 }); a.facing = 0;
  assert.equal(canEatPlayer(a, b, s.time), true); assert.equal(canEatPlayer(b, a, s.time), false);
});

test('fireball growth slows past the soft cap but never stops', () => {
  const s = hell(), [a] = s.players; a.mass = F.softMass * 2;
  s.hell.fireballs = [{ id: 901, x: a.x, y: a.y, spawnedAt: s.time }]; collectFireballs(s, a);
  assert.ok(Math.abs(a.mass - (F.softMass * 2 + F.softMass * (F.growth - 1))) < 1e-6);
  // Starting from scratch, every one of 20 fireballs still makes the player bigger.
  const b = s.players[1]; b.mass = EAT.player.startingMass;
  for (let i = 0; i < 20; i++) { const before = b.mass; s.hell.fireballs = [{ id: 950 + i, x: b.x, y: b.y, spawnedAt: s.time }]; collectFireballs(s, b); assert.ok(b.mass > before, `fireball ${i + 1}`); }
});

test('black holes swallow fireballs and grow only slightly, up to a cap', () => {
  const s = hell(), b = blackHoles(s)[0];
  Object.assign(b, { x: 1500, y: 1200, warnUntil: 0, progress: 0, speed: 0, from: { x: 1500, y: 1200 }, destination: { x: 2000, y: 1200 } }); delete b.control;
  s.hell.nextFireball = 1e9; s.hell.fireballs = [{ id: 902, x: 1500, y: 1200, spawnedAt: s.time }];
  stepHell(s, 1 / 30);
  assert.equal(s.hell.fireballs.length, 0); assert.equal(holeRadius(b), EAT.hell.radius + F.holeGrowth);
  b.size = F.holeMaxRadius - 1; s.hell.fireballs = [{ id: 903, x: b.x, y: b.y, spawnedAt: s.time }]; stepHell(s, 1 / 30);
  assert.equal(holeRadius(b), F.holeMaxRadius);
});

test('fireballs spawn on reachable safe floor, start with a batch and respect the cap', () => {
  const s = hell(); s.hell.nextFireball = s.hell.readyAt;
  spawnFireballs(s); assert.equal(s.hell.fireballs.length, F.initialCount);
  for (const f of s.hell.fireballs) assert.ok(safeGround(s, f, F.radius));
  for (let i = 0; i < 20; i++) { s.time += F.interval; spawnFireballs(s); }
  assert.equal(s.hell.fireballs.length, F.maxActive);
  assert.ok(s.hell.fireballs.every(f => Number.isInteger((f.x - cellCenter(0).x) / EAT.hell.cellSize)));
});

test('Hell bots go after fireballs and full matches stay valid', () => {
  const s = createGame('nature', fillBots([], 6), 77, 'bots', { mode: 'solo', matchDuration: 120 });
  startHell(s);
  for (let i = 0; i < 30 * 45 && s.status === 'playing'; i++) stepGame(s);
  const collected = s.players.reduce((n, p) => n + (p.stats.fireballs ?? 0), 0);
  assert.ok(collected > 0, 'bots collected fireballs');
  for (const p of s.players) assert.ok(Number.isFinite(p.mass + p.x + p.y));
});

test('normal map: denser city, rare Shield, frequent Strike, heavier sky rain', () => {
  const s = createGame('city', [{ id: 'a', name: 'A' }], 42, 'density', { mode: 'solo', botsEnabled: false });
  assert.ok(s.food.filter(f => FOOD[f.kind].building).length >= 45);
  assert.ok(!s.powerups.some(p => p.kind === 'shield'));
  const spawned = {}; let drops = 0; const seen = new Set(s.food.map(f => f.id));
  s.players[0].x = s.players[0].y = 20;
  for (let i = 0; i < 30 * 180; i++) {
    s.time += 1 / 30; updateSpawns(s);
    for (const p of s.powerups) spawned[p.id] = p.kind;
    for (const f of s.food) if (!seen.has(f.id)) { seen.add(f.id); drops++; }
  }
  const kinds = Object.values(spawned), count = k => kinds.filter(x => x === k).length;
  assert.ok(count('shield') <= 4, `shields ${count('shield')}`); assert.ok(count('strike') > count('shield'));
  assert.ok(s.powerups.length <= EAT.powerups.maxObjects);
  // Even with nobody eating (food at its cap), drops keep coming as old ones retire.
  assert.ok(drops > 600, `sky drops ${drops}`);
});

test('Pluto is always on with the fixed strong multiplier', () => {
  const settings = matchSettings({ plutoEnabled: false, plutoMultiplier: 1.25 });
  assert.equal(settings.plutoEnabled, true); assert.equal(settings.plutoMultiplier, EAT.pluto.multiplier);
  assert.ok(EAT.pluto.multiplier >= 4);
});
