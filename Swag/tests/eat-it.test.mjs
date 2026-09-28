import test from 'node:test';
import assert from 'node:assert/strict';
import { EAT, FOOD, massToRadius, massToSpeed } from '../src/games/eat-it/config.ts';
import { createGame, fillBots, stepGame, eliminate, checkWinner, collectPower, sanitizeInput } from '../src/games/eat-it/engine.ts';
import { canEatPlayer, foodFits, inMouth } from '../src/games/eat-it/rules.ts';
import { validPosition, distance } from '../src/games/eat-it/maps.ts';
import { spawnPosition, spawnFood } from '../src/games/eat-it/spawn.ts';
import { botInput } from '../src/games/eat-it/bots.ts';
import { advanceRoom, applyRoomAction, parseSettings } from '../src/games/eat-it/authority.ts';

function arena(count = 2, map = 'city') {
  const s = createGame(map, Array.from({ length: count }, (_, i) => ({ id: `p${i}`, name: `P${i}` })), 5721);
  s.food = []; s.powerups = []; s.nextFood = 1000; s.nextPower = 1000;
  s.players.forEach((p, i) => { p.x = 1000 + i * 150; p.y = 800; p.facing = 0; }); return s;
}
function steps(s, seconds) { for (let i = 0; i < seconds * EAT.network.tickRate; i++) stepGame(s); }
function food(s, kind = 'apple', x = 1034, y = 800) { const f = { id: s.nextId++, kind, x, y, vx: 0, vy: 0, z: 0, vz: 0, rotation: 0, target: null, capturedAt: 0 }; s.food.push(f); return f; }
test('mass/radius is square-root based, capped, and distinct from radius threshold', () => {
  assert.equal(massToRadius(36), 24); assert.equal(massToRadius(144), 48);
  assert.equal(massToRadius(-100), EAT.player.minRadius); assert.equal(massToRadius(1e9), EAT.player.maxRadius);
  for (const ratio of [1.15, 1.20, 1.25, 1.30]) assert.ok(Math.abs(massToRadius(36 * ratio ** 2) / massToRadius(36) - ratio) < 1e-10);
  assert.ok(massToRadius(36 * 1.2) < 24 * EAT.eating.playerEatRadiusRatio);
});
test('speed decreases smoothly with mass and stays above the configured floor', () => {
  assert.ok(massToSpeed(100) < massToSpeed(36)); assert.ok(massToSpeed(300) < massToSpeed(100));
  assert.ok(massToSpeed(1e9) >= EAT.player.baseSpeed * EAT.player.minSpeedFactor);
});
test('movement accelerates, decelerates, limits diagonal speed and turns smoothly', () => {
  const s = arena(), p = s.players[0]; p.input = { x: 1, y: 1 }; stepGame(s);
  assert.ok(p.vx > 0 && p.vx < EAT.player.baseSpeed); assert.ok(p.facing > 0 && p.facing < Math.PI / 4);
  steps(s, 1); assert.ok(Math.hypot(p.vx, p.vy) <= EAT.player.baseSpeed + 1e-8);
  p.input = { x: 0, y: 0 }; const before = Math.hypot(p.vx, p.vy); steps(s, 1); assert.ok(Math.hypot(p.vx, p.vy) < before / 10);
});
test('food is pulled into the mouth, rewards growth once, and cannot be eaten twice', () => {
  const s = arena(), p = s.players[0], f = food(s), initialX = f.x;
  stepGame(s); assert.equal(p.foodEaten, 0); assert.ok(f.x < initialX); assert.equal(f.target, p.id);
  steps(s, 1); assert.equal(p.foodEaten, 1); assert.equal(p.mass, 36 + FOOD.apple.mass); assert.equal(p.score, FOOD.apple.score); assert.equal(s.food.length, 0);
  steps(s, 1); assert.equal(p.foodEaten, 1); assert.equal(p.mass, 41);
});
test('only one player can claim a shared food object', () => {
  const s = arena(), [a, b] = s.players; b.x = a.x; b.y = a.y; food(s); steps(s, 2);
  assert.equal(a.foodEaten + b.foodEaten, 1); assert.equal(a.mass + b.mass, 77);
});
test('large food needs sufficient mouth capacity; burger and pizza are real consumables', () => {
  for (const kind of ['burger', 'pizza', 'apple']) {
    const s = arena(), p = s.players[0], f = food(s, kind, 1045);
    if (kind !== 'apple') assert.equal(foodFits(p, f), false);
    p.mass = 120; assert.equal(foodFits(p, f), true); steps(s, 1);
    assert.equal(p.mass, 120 + FOOD[kind].mass); assert.equal(p.foodEaten, 1);
  }
});
test('smaller and similar-sized attackers cannot eat a target', () => {
  const s = arena(), [a, b] = s.players; b.x = 1040;
  for (const mass of [20, 36, 36 * 1.2, 36 * 1.2 ** 2 - 0.01]) { a.mass = mass; assert.equal(canEatPlayer(a, b, 0, s.map), false); }
  a.mass = 36 * 1.2 ** 2; assert.equal(canEatPlayer(a, b, 0, s.map), true);
});
test('mouth direction matters; rear/body overlap does not kill', () => {
  const s = arena(), [a, b] = s.players; a.mass = 144; b.x = a.x - 35;
  assert.equal(canEatPlayer(a, b, 0, s.map), false); stepGame(s); assert.equal(b.alive, true);
  b.x = a.x; b.y = a.y + 35; assert.equal(canEatPlayer(a, b, 0, s.map), false);
  b.y = a.y; b.x = a.x + 50; assert.equal(canEatPlayer(a, b, 0, s.map), true);
});
test('shield prevents consumption and expires on authoritative time', () => {
  const s = arena(), [a, b] = s.players; a.mass = 100; b.x = a.x + 50; b.effects.shield = 5;
  assert.equal(canEatPlayer(a, b, 4.99, s.map), false); assert.equal(canEatPlayer(a, b, 5, s.map), true);
});
test('a successful bite transfers 70% mass once, eliminates and ends last-player-standing', () => {
  const s = arena(), [a, b] = s.players; a.mass = 100; b.x = a.x + 50; stepGame(s);
  assert.equal(b.alive, false); assert.equal(b.placement, 2); assert.equal(a.mass, 100 + 36 * 0.7);
  assert.equal(a.playersEaten, 1); assert.equal(s.winnerId, a.id); assert.equal(a.placement, 1); assert.equal(s.status, 'finished');
  assert.equal(eliminate(s, b, a), false); steps(s, 2); assert.equal(a.mass, 125.2);
});
test('victim is unavailable during its cosmetic consumption animation', () => {
  const s = arena(3), [a, b, c] = s.players; a.mass = 100; c.mass = 200; b.x = 1045; c.x = 1050; c.facing = Math.PI;
  eliminate(s, b, a); assert.equal(canEatPlayer(c, b, s.time, s.map), false); assert.equal(b.alive, false);
});
test('all power-ups collect exactly once; growth is permanent and timers expire', () => {
  for (const kind of ['speed', 'shield', 'magnet', 'growth']) {
    const s = arena(), p = s.players[0], power = { id: 1000, x: 1010, y: 800, kind }; s.powerups = [power];
    collectPower(s, p, power); collectPower(s, p, power); assert.equal(p.powerupsCollected, 1); assert.equal(p.score, 40);
    if (kind === 'growth') { assert.equal(p.mass, 66); steps(s, 8); assert.equal(p.mass, 66); }
    else { assert.equal(p.effects[kind], EAT.powerups[kind].duration); steps(s, 8); assert.ok(p.effects[kind] < s.time); }
  }
});
test('magnet attracts edible neutral food but not enemies or oversized food', () => {
  const s = arena(), [p, enemy] = s.players; p.effects.magnet = 7; enemy.x = 1170;
  const apple = food(s, 'apple', 1150, 810), burger = food(s, 'burger', 1150, 790); const x = apple.x;
  steps(s, .4); assert.ok(apple.x < x); assert.equal(burger.x, 1150); assert.equal(enemy.x, 1170);
});
test('bots flee larger visible enemies and hunt edible targets', () => {
  const s = arena(), [bot, other] = s.players; bot.bot = true; other.x = 1140; other.mass = 150; other.facing = Math.PI;
  const fleeing = botInput(s, bot); assert.equal(bot.botState, 'FLEE'); assert.ok(fleeing.x < 0);
  bot.mass = 150; other.mass = 36; const hunting = botInput(s, bot); assert.equal(bot.botState, 'HUNT'); assert.ok(hunting.x > 0);
});
test('bots forage food and seek power-ups, without map-wide food vision', () => {
  const s = arena(), p = s.players[0]; s.players[1].x = 2000;
  food(s, 'apple', 1100); botInput(s, p); assert.equal(p.botState, 'FORAGE');
  s.powerups.push({ id: 4000, kind: 'growth', x: 1060, y: 800 }); botInput(s, p); assert.equal(p.botState, 'POWERUP');
  s.powerups = []; s.food[0].x = 2000; botInput(s, p); assert.equal(p.botState, 'REPOSITION');
});
for (const map of ['city', 'nature']) test(`${map} spawning avoids walls, players, boundaries and accumulation`, () => {
  const s = createGame(map, fillBots([{ id: 'me', name: 'Me' }], 8), 9812);
  for (const f of s.food) { assert.ok(validPosition(map, f, FOOD[f.kind].radius)); assert.ok(s.players.every(p => distance(p, f) > massToRadius(p.mass) + FOOD[f.kind].radius)); }
  for (const p of s.players) assert.ok(validPosition(map, p, massToRadius(p.mass)));
  for (let i = 0; i < 100; i++) spawnFood(s);
  assert.ok(s.food.length <= EAT.food.maxObjects);
  for (let i = 0; i < 30; i++) { const p = spawnPosition(s, 30); if (p) assert.ok(validPosition(map, p, 30)); }
});
test('simulation is deterministic for identical seeds and input streams', () => {
  const a = createGame('nature', fillBots([], 4), 99), b = createGame('nature', fillBots([], 4), 99);
  steps(a, 15); steps(b, 15); assert.deepEqual(a, b);
});
test('closing boundary ends a stalled match with one survivor', () => {
  const s = arena(4); s.time = 299; s.players.forEach((p, i) => { p.mass = 20 + i * 10; });
  steps(s, 10); assert.equal(s.status, 'finished'); assert.equal(s.players.filter(p => p.alive).length, 1);
  assert.deepEqual(s.players.map(p => p.placement).sort(), [1, 2, 3, 4]);
});
function room() { return { id: 'r', room_code: 'ABC123', host_id: 'p0', players: [{ id: 'p0', name: 'P0', ready: true, lastSeen: 1000 }], settings: { map: 'city', count: 4 }, game_state: null, status: 'waiting', version: 0, last_tick: 1000 }; }
test('room starts with humans plus bots and host/ready checks are enforced', () => {
  const r = room(); applyRoomAction(r, 'p1', 'P1', { op: 'join' }, 1000, 44, 'game');
  assert.throws(() => applyRoomAction(r, 'p1', 'P1', { op: 'start' }, 1000, 44, 'game'), /host/);
  assert.throws(() => applyRoomAction(r, 'p0', 'P0', { op: 'start' }, 1000, 44, 'game'), /ready/);
  applyRoomAction(r, 'p1', 'P1', { op: 'ready' }, 1000, 44, 'game'); applyRoomAction(r, 'p0', 'P0', { op: 'start' }, 1000, 44, 'game');
  assert.equal(r.game_state.players.length, 4); assert.equal(r.game_state.players.filter(p => p.bot).length, 2);
  assert.throws(() => applyRoomAction(r, 'intruder', 'X', { op: 'input', input: { x: 1, y: 0 } }, 1000, 1, 'x'), /Join/);
  assert.throws(() => applyRoomAction(r, 'late', 'X', { op: 'join' }, 1000, 1, 'x'), /already/);
});
test('server ignores client mass, kills, time and scores; huge/invalid input is normalized', () => {
  const r = room(); applyRoomAction(r, 'p0', 'P0', { op: 'start' }, 1000, 44, 'game');
  const payload = { op: 'input', input: { x: 1e30, y: 1e30 }, mass: 99999, score: 10000, ate: 'bot-1', dt: 1000000 };
  for (let i = 0; i < 50; i++) applyRoomAction(r, 'p0', 'P0', payload, 1000, 44, 'game');
  const p = r.game_state.players[0]; assert.equal(p.mass, 36); assert.equal(p.score, 0); assert.equal(r.game_state.time, 0); assert.equal(p.playersEaten, 0);
  assert.ok(Math.hypot(p.input.x, p.input.y) <= 1.0000001); assert.deepEqual(sanitizeInput({ x: NaN, y: 9 }), { x: 0, y: 0 });
});
test('clock advancement does not replay elapsed ticks; abandoned players forfeit', () => {
  const r = room(); applyRoomAction(r, 'p0', 'P0', { op: 'start' }, 1000, 44, 'game');
  advanceRoom(r, 1200); const time = r.game_state.time; assert.ok(time > 0); advanceRoom(r, 1200); assert.equal(r.game_state.time, time);
  advanceRoom(r, 25000); assert.equal(r.game_state.players[0].alive, false);
});
test('room settings and total participants are bounded', () => {
  assert.throws(() => parseSettings({ map: 'city', count: 9 })); assert.throws(() => parseSettings({ map: 'x', count: 4 }));
  assert.throws(() => createGame('city', [{ id: 'a', name: 'A' }]));
  assert.equal(fillBots([{ id: 'a', name: 'A' }], 99).length, 8);
});
test('host transfer, leave, and rematch use existing participants safely', () => {
  const r = room(); applyRoomAction(r, 'p1', 'P1', { op: 'join' }, 1000, 44, 'game');
  applyRoomAction(r, 'p0', 'P0', { op: 'leave' }, 1000, 44, 'game'); assert.equal(r.host_id, 'p1'); assert.equal(r.players.length, 1);
  r.settings.count = 2; applyRoomAction(r, 'p1', 'P1', { op: 'ready' }, 1000, 44, 'game'); applyRoomAction(r, 'p1', 'P1', { op: 'start' }, 1000, 44, 'game');
  eliminate(r.game_state, r.game_state.players[1]); checkWinner(r.game_state); r.status = 'finished';
  applyRoomAction(r, 'p1', 'P1', { op: 'rematch' }, 1000, 44, 'next'); assert.equal(r.game_state, null); assert.equal(r.status, 'waiting'); assert.equal(r.players[0].ready, false);
});
test('food and player sensors cannot bite through scenery', () => {
  const s = arena(), [a, b] = s.players; a.x = 185; a.y = 265; b.x = 235; b.y = 265; a.mass = 144;
  assert.equal(inMouth(a, b, massToRadius(b.mass)), true); assert.equal(canEatPlayer(a, b, 0, s.map), false);
});

for (const map of ['city', 'nature']) for (const count of [2, 4, 8]) test(`${map}: a complete ${count}-bot match reaches results without invalid state`, () => {
  const s = createGame(map, fillBots([], count), 2700 + count);
  for (let tick = 0; tick < 30 * 480 && s.status === 'playing'; tick++) {
    stepGame(s);
    if (tick % 300 === 0) {
      assert.ok(s.food.length <= EAT.food.maxObjects); assert.ok(s.powerups.length <= EAT.powerups.maxObjects);
      assert.ok(s.players.every(p => Number.isFinite(p.mass) && Number.isFinite(p.x) && Number.isFinite(p.y)));
    }
  }
  assert.equal(s.status, 'finished'); assert.equal(s.players.filter(p => p.alive).length, 1);
  assert.equal(new Set(s.players.map(p => p.placement)).size, count);
  assert.ok(s.players.reduce((n, p) => n + p.foodEaten, 0) > 0);
});
