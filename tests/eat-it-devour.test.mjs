import test from 'node:test';
import assert from 'node:assert/strict';
import { EAT, FOOD, isBigProp, playerRadius } from '../src/games/eat-it/config.ts';
import { createGame, stepGame } from '../src/games/eat-it/engine.ts';
import { canEatPlayer, isChoking, mouthOpening, mouthPosition, MOUTH } from '../src/games/eat-it/rules.ts';
import { beginFall, fallOffset, fallPose, jamAge, jamsInMouth, objectHeight, tooLongToSwallow } from '../src/games/eat-it/falling.ts';
import { SPIT_DURATION } from '../src/games/eat-it/choking.ts';
import { consumptionDuration } from '../src/games/eat-it/rules.ts';
import { updateSpawns } from '../src/games/eat-it/spawn.ts';
import { startHell, stepHell, blackHoles, allBlackHoles, devourBlackHoles, cellPhase } from '../src/games/eat-it/hell.ts';
const F = EAT.hell.fireball, H = EAT.hell;
const duel = () => {
  const s = createGame('city', [{ id: 'a', name: 'A' }, { id: 'b', name: 'B' }], 3, 'duel', { mode: 'solo' });
  s.food = []; s.powerups = []; delete s.encounter; s.nextFood = s.nextPower = s.nextPluto = s.nextBig = 1e9;
  Object.assign(s.players[0], { x: 1000, y: 1000, facing: 0, vx: 0, vy: 0 }); Object.assign(s.players[1], { x: 2600, y: 2000 });
  return s;
};
function hell(seed = 11) {
  const s = createGame('city', [{ id: 'a', name: 'A' }, { id: 'b', name: 'B' }], seed, 'hell', { mode: 'solo' });
  startHell(s); s.time = s.hell.readyAt; s.hell.nextFireball = 1e9;
  for (const b of blackHoles(s)) b.warnUntil = 1e9;
  return s;
}

test('115% radius is enough to devour, and an edible rival is never pushed away', () => {
  const s = duel(), [a, b] = s.players;
  a.mass = 36 * 1.15 ** 2; Object.assign(b, { x: a.x + playerRadius(a) * .55, y: a.y + playerRadius(a) * .3, vx: 0, vy: 0, input: { x: 0, y: 0 } });
  // Facing away first: overlapping bodies stay put (no separation push), and nobody is eaten.
  a.facing = Math.PI; const before = { ax: a.x, bx: b.x };
  stepGame(s); assert.equal(b.alive, true); assert.equal(a.x, before.ax); assert.equal(b.x, before.bx);
  a.facing = 0; assert.equal(canEatPlayer(a, b, s.time, s.map), true);
  stepGame(s); assert.equal(b.alive, false); assert.equal(a.playersEaten, 1);
});

test('captured props drop where they entered instead of sliding to the center, and sink deep into the pit', () => {
  const s = duel(), p = s.players[0]; p.mass = 4000;
  const r = playerRadius(p), m = mouthPosition(p, r);
  const f = { id: 900, kind: 'apple', x: m.x, y: m.y + r * MOUTH.radius * .8, vx: 0, vy: 0, z: 0, vz: 0, rotation: 0, target: null, capturedAt: 0 };
  beginFall(f, p, 0);
  const end = fallOffset(f, consumptionDuration(f));
  assert.ok(Math.hypot(end.x, end.y) > r * MOUTH.radius * .7, 'stays near its entry point');
  assert.ok(fallPose(f, consumptionDuration(f)).z < -300, 'falls deep below the rim');
  // A house entering at the lip only slides in far enough to clear it.
  const house = { ...f, id: 901, kind: 'house', y: m.y + r * MOUTH.radius + FOOD.house.height * .2 };
  beginFall(house, p, 0); const rest = fallOffset(house, consumptionDuration(house));
  assert.ok(Math.hypot(rest.x, rest.y) > 1 && Math.hypot(rest.x, rest.y) < Math.hypot(house.fallOffsetX, house.fallOffsetY));
});

test('eaten houses, towers and vehicles respawn, some of them from the sky over cleared ground', () => {
  const s = createGame('city', [{ id: 'a', name: 'A' }], 21, 'big', { mode: 'solo', botsEnabled: false });
  assert.ok(s.bigTarget > 40);
  s.food = s.food.filter((f, i) => !isBigProp(f.kind) || i % 3); const missing = s.bigTarget - s.food.filter(f => isBigProp(f.kind)).length;
  assert.ok(missing > 10);
  let sky = 0; const seen = new Set(s.food.map(f => f.id)); s.nextFood = 1e9;
  for (let i = 0; i < 30 * 30; i++) {
    s.time += 1 / 30; updateSpawns(s);
    for (const f of s.food) if (!seen.has(f.id)) { seen.add(f.id); if (isBigProp(f.kind) && f.z > 0) sky++; }
  }
  assert.equal(s.food.filter(f => isBigProp(f.kind)).length, s.bigTarget);
  assert.ok(sky > 0, 'some big props crash down from the sky');
  for (const f of s.food.filter(f => isBigProp(f.kind))) for (const o of s.food) if (o !== f && !isBigProp(o.kind)) assert.ok(Math.hypot(o.x - f.x, o.y - f.y) >= FOOD[f.kind].radius + FOOD[o.kind].radius);
});

test('a sky-dropped building falls, lands and settles', () => {
  const s = duel(); const f = { id: 902, kind: 'house', x: 2000, y: 1500, vx: 0, vy: 0, z: 600, vz: 0, rotation: 0, target: null, capturedAt: 0 };
  s.food = [f];
  for (let i = 0; i < 30 * 4; i++) stepGame(s);
  assert.equal(f.z, 0); assert.equal(f.vz, 0); assert.ok(s.food.includes(f));
});

test('about half of the black-hole sweeps break the floor; harmless ones leave it intact', () => {
  let harmless = 0, total = 0;
  for (let seed = 1; seed < 30; seed++) { const s = hell(seed); for (const b of blackHoles(s)) { total++; if (b.harmless) harmless++; } }
  assert.ok(harmless / total > .25 && harmless / total < .75, `${harmless}/${total}`);
  const s = hell(), b = blackHoles(s)[0];
  Object.assign(b, { x: 1800, y: 1500, warnUntil: 0, speed: 0, progress: 0, from: { x: 1800, y: 1500 }, destination: { x: 2600, y: 1500 }, harmless: true }); delete b.control;
  s.players.forEach((p, i) => Object.assign(p, { x: 600 + i * 200, y: 600 }));
  stepHell(s, 1 / 30); assert.ok(s.hell.cells.every(v => v === 0));
  b.harmless = false; stepHell(s, 1 / 30); assert.ok(s.hell.cells.some(v => v !== 0));
});

test(`${F.holeEatCount} fireballs let a player devour a black hole`, () => {
  const s = hell(), p = s.players[0], b = blackHoles(s)[0];
  p.mass = F.softMass; const m = mouthPosition(p, playerRadius(p, s.time)); Object.assign(b, { x: m.x, y: m.y });
  p.stats.fireballs = F.holeEatCount - 1; devourBlackHoles(s, p); assert.equal(b.eatenAt, undefined);
  p.stats.fireballs = F.holeEatCount; const mass = p.mass; devourBlackHoles(s, p);
  assert.equal(b.eatenAt, s.time); assert.equal(b.eatenBy, p.id); assert.ok(!blackHoles(s).includes(b)); assert.ok(allBlackHoles(s).includes(b));
  assert.ok(p.mass > mass); assert.equal(p.stats.blackHoles, 1); assert.ok(s.events.some(e => e.type === 'blackHoleEaten'));
});

test('late Hell collapses the floor from the edges inward', () => {
  const s = hell(); for (const b of blackHoles(s)) b.harmless = true;
  s.players.forEach((p, i) => Object.assign(p, { x: H.left + H.columns * H.cellSize / 2 + i * 100, y: H.top + H.rows * H.cellSize / 2 }));
  s.time = s.hell.readyAt + H.collapseAfter + H.collapseInterval + .01; stepHell(s, 1 / 30);
  assert.notEqual(cellPhase(s, 0), 'intact'); assert.notEqual(cellPhase(s, H.columns + 1), 'intact');
  assert.equal(cellPhase(s, 2 * H.columns + 2), 'intact');
});

const tipIn = (s, p, kind) => {
  const m = mouthPosition(p, playerRadius(p, s.time)), extent = FOOD[kind].width / 2;
  const f = { id: s.nextId++, kind, x: m.x + mouthOpening(p) / 2 + extent - 2 * extent * .27, y: m.y, vx: 0, vy: 0, z: 0, vz: 0, rotation: 0, target: null, capturedAt: 0 };
  s.food.push(f); return f;
};
for (const kind of ['skyscraper', 'windmill', 'officeTower']) test(`${kind}: too long to tip in, it wedges across the mouth for the choke and is spat out without reward`, () => {
  const s = duel(), p = s.players[0];
  p.mass = ((objectHeight(kind) * .9) / 2 / MOUTH.radius / 4) ** 2;
  assert.ok(tooLongToSwallow(p, kind, s.time));
  const f = tipIn(s, p, kind); stepGame(s); assert.equal(f.target, p.id); assert.ok(jamsInMouth(p, f, s.time));
  const mass = p.mass, ticks = n => { for (let i = 0; i < n; i++) stepGame(s); };
  ticks(Math.ceil(jamAge(f) * 30) + 1);
  assert.equal(f.target, null); assert.ok(f.stuck); assert.ok(isChoking(p, s.time)); assert.equal(p.stats.chokes, 1);
  assert.ok(fallPose(f, f.stuck.age).angle > .3 && f.z <= 0, 'leaning into the hole while wedged');
  const rim = mouthPosition(p, playerRadius(p, s.time)), back = { x: p.x + f.fallRestX - f.fallX * f.fallPivot, y: p.y + f.fallRestY - f.fallY * f.fallPivot };
  assert.ok(Math.hypot(f.x - rim.x, f.y - rim.y) < mouthOpening(p) / 2, 'wedged across the mouth, not beside it');
  assert.ok(Math.abs(Math.hypot(back.x - rim.x, back.y - rim.y) - mouthOpening(p) / 2) < 1, 'base pivots on the near rim');
  const wedged = { x: f.x - p.x, y: f.y - p.y }; p.input = { x: 1, y: 0 }; ticks(30);
  assert.deepEqual({ x: +(f.x - p.x).toFixed(6), y: +(f.y - p.y).toFixed(6) }, { x: +wedged.x.toFixed(6), y: +wedged.y.toFixed(6) });
  ticks(Math.ceil((EAT.eating.chokeDuration - 1) * 30) + 2); assert.ok(f.spit, 'spat out after the choke'); assert.ok(f.spit.fromTilt > 0);
  ticks(Math.ceil(SPIT_DURATION * 30) + 2);
  assert.equal(f.spit, undefined); assert.equal(f.z, 0); assert.ok(s.food.includes(f)); assert.equal(p.mass, mass); assert.equal(p.foodEaten, 0);
});
test('a mouth wider than the prop is tall swallows it, and a straight drop never wedges', () => {
  const s = duel(), p = s.players[0];
  p.mass = ((objectHeight('skyscraper') * 1.05) / 2 / MOUTH.radius / 4) ** 2; assert.equal(tooLongToSwallow(p, 'skyscraper', s.time), false);
  const f = tipIn(s, p, 'skyscraper'); for (let i = 0; i < 70; i++) stepGame(s);
  assert.equal(p.foodEaten, 1); assert.equal(p.stats.chokes, 0);
  const t = duel(), q = t.players[0]; q.mass = 2500; const g = { id: 990, kind: 'skyscraper', ...mouthPosition(q, playerRadius(q)), vx: 0, vy: 0, z: 0, vz: 0, rotation: 0, target: null, capturedAt: 0 };
  beginFall(g, q, 0); assert.equal(g.fallTip, 0); assert.equal(jamsInMouth(q, g, 0), false);
});
