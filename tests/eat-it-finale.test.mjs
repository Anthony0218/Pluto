import test from 'node:test';
import assert from 'node:assert/strict';
import { EAT, FOOD, playerRadius } from '../src/games/eat-it/config.ts';
import { createGame, eliminate, lastStanding, stepEpilogue, stepGame } from '../src/games/eat-it/engine.ts';
import { beginFall, fallOffset, fallPose, objectHeight } from '../src/games/eat-it/falling.ts';
import { consumptionDuration, foodFits, mouthOpening, mouthPosition, MOUTH } from '../src/games/eat-it/rules.ts';

function tipping(kind, entry = .85, grow = 1, swallowable = false) {
  const p = { id: 'a', x: 0, y: 0, facing: 0, mass: 20 };
  while (!foodFits(p, { kind }) || (swallowable && mouthOpening(p) <= objectHeight(kind))) p.mass *= 1.02;
  p.mass *= grow;
  const r = playerRadius(p), m = mouthPosition(p, r);
  const f = { id: 1, kind, x: m.x + r * MOUTH.radius * entry, y: m.y, vx: 0, vy: 0, z: 0, vz: 0, rotation: .3, target: null, capturedAt: 0 };
  beginFall(f, p, 0);
  return f;
}

test('a tipping skyscraper keeps leaning while it sinks, without pausing mid-fall or jumping', () => {
  for (const grow of [1, 1.3, 2]) {
    const f = tipping('skyscraper', .85, grow, true), duration = consumptionDuration(f);
    assert.ok(!f.fallWedge && f.fallTip > .3, 'tips over the lip');
    let previous = fallPose(f, 0), x = 0, held = 0;
    for (let age = 1 / 60; age <= duration * .7; age += 1 / 60) {
      const pose = fallPose(f, age), offset = fallOffset(f, age), nextX = offset.x + f.fallX * pose.shift;
      // While the roof is still near the surface the lean keeps growing. Only a barely-wide-enough
      // hole may hold it for a moment, while its cut through the ground spans the whole opening.
      held = pose.angle > previous.angle ? 0 : held + 1;
      if (pose.z > -objectHeight(f.kind) * .5 && age > duration * .1) assert.ok(held <= 6, `still leaning at ${(age / duration).toFixed(2)}`);
      assert.ok(Math.abs(pose.angle - previous.angle) < .1, 'no lean jumps');
      if (age > 1 / 60) assert.ok(Math.abs(nextX - x) < 15, 'no slide jumps');
      previous = pose; x = nextX;
    }
    assert.ok(fallPose(f, duration * .7).angle > .9, 'well past the old ~27° stop');
  }
});

test('every tipping prop moves continuously and still ends below the floor', () => {
  for (const kind of Object.keys(FOOD)) for (const entry of [.6, .95]) {
    if (FOOD[kind].shape === 'tree') continue;
    const f = tipping(kind, entry), duration = consumptionDuration(f);
    if (f.fallWedge) continue;
    let previous = fallPose(f, 0);
    for (let age = 1 / 60; age <= duration; age += 1 / 60) {
      const pose = fallPose(f, age);
      assert.ok(Number.isFinite(pose.angle) && Number.isFinite(pose.shift) && Number.isFinite(pose.z), kind);
      assert.ok(Math.abs(pose.angle - previous.angle) < .1 && Math.abs(pose.shift - previous.shift) < 15, `${kind} moves smoothly`);
      previous = pose;
    }
    assert.ok(fallPose(f, duration).z < -objectHeight(kind), `${kind} sinks below the floor`);
  }
});

test('after the last rival is eaten the world keeps running, but the result never changes', () => {
  const s = createGame('city', [{ id: 'a', name: 'A' }, { id: 'b', name: 'B' }], 5, 'lap', { mode: 'solo', livesEnabled: false });
  const [a, b] = s.players; a.mass = 400; a.input = { x: 1, y: 0 };
  eliminate(s, b, a); stepGame(s);
  assert.equal(s.status, 'finished'); assert.equal(s.winnerId, 'a'); assert.ok(lastStanding(s));
  const { time, x } = { time: s.time, x: a.x }, mass = a.mass, events = s.events.length;
  for (let i = 0; i < EAT.network.tickRate * EAT.match.victoryLap; i++) stepEpilogue(s);
  assert.equal(s.status, 'finished'); assert.equal(s.winnerId, 'a'); assert.equal(s.result, 'winner');
  assert.ok(s.time >= time + EAT.match.victoryLap - 1e-6, 'game time advances through the lap');
  assert.notEqual(a.x, x, 'the winner can still move');
  assert.equal(b.alive, false); assert.equal(eliminate(s, a, null), false, 'nobody can be eliminated during the lap');
  assert.ok(a.mass >= mass); assert.ok(!s.events.slice(events).some(e => e.type === 'win'), 'no second win');
  // A ranking finish with several survivors gets no lap.
  const ranked = createGame('city', [{ id: 'a', name: 'A' }, { id: 'b', name: 'B' }], 5, 'rank', { mode: 'solo', hellEnabled: false, matchDuration: 120 });
  ranked.time = 120; stepGame(ranked);
  assert.equal(ranked.status, 'finished'); assert.equal(lastStanding(ranked), false);
});
