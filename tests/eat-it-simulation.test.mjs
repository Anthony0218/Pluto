import test from 'node:test';
import assert from 'node:assert/strict';
import { createGame, fillBots, stepGame } from '../src/games/eat-it/engine.ts';
import { EAT } from '../src/games/eat-it/config.ts';

for (const map of ['city', 'nature']) test(`eight bots finish a stable ${map} match with the two-minute normal phase and enlarged Hell`, t => {
  const state = createGame(map, fillBots([], 8), 42, `simulation-${map}`, { matchDuration: 120 });
  const travel = state.players.map(() => 0), times = [];
  let maxFood = 0, maxPowers = 0;
  for (let tick = 0; tick < 900 * EAT.network.tickRate && state.status === 'playing'; tick++) {
    const before = state.players.map(p => ({ x: p.x, y: p.y }));
    const started = performance.now();
    stepGame(state);
    times.push(performance.now() - started);
    for (const [i, p] of state.players.entries()) {
      travel[i] += Math.hypot(p.x - before[i].x, p.y - before[i].y);
      assert.ok([p.x, p.y, p.vx, p.vy, p.facing, p.mass, p.score].every(Number.isFinite));
      assert.ok(p.mass >= EAT.player.minMass);
    }
    for (const f of state.food) assert.ok([f.x, f.y, f.vx, f.vy, f.z, f.vz, f.rotation].every(Number.isFinite));
    maxFood = Math.max(maxFood, state.food.length);
    maxPowers = Math.max(maxPowers, state.powerups.length);
    assert.ok(state.food.length <= EAT.food.maxObjects);
    assert.ok(state.powerups.length <= EAT.powerups.maxObjects);
    assert.ok(state.events.length <= 80);
  }
  assert.equal(state.status, 'finished');
  assert.ok(state.result === 'winner' || state.result === 'tie');
  if (state.result === 'winner') assert.equal(state.players.filter(p => p.alive).length, 1);
  else { assert.ok(state.tiedIds.length > 1); assert.ok(state.tiedIds.every(id => state.players.find(p => p.id === id).placement === 1)); }
  assert.ok(travel.every(d => d > 500), 'no bot remains at its initial position');
  assert.ok(state.players.reduce((n, p) => n + p.foodEaten, 0) >= 20);
  times.sort((a, b) => a - b);
  // Report timing without a machine-dependent/flaky performance assertion.
  t.diagnostic(JSON.stringify({ map, ticks: times.length, seconds: state.time, maxFood, maxPowers,
    meanMs: times.reduce((a, b) => a + b) / times.length,
    p99Ms: times[Math.floor(times.length * .99)], maxMs: times.at(-1), travel }));
});
