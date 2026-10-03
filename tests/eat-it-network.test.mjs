import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import ts from 'typescript';
import { EAT } from '../src/games/eat-it/config.ts';
import { createGame } from '../src/games/eat-it/engine.ts';
import { SnapshotBuffer } from '../src/games/eat-it/presentation.ts';

function snapshot(time = 0) {
  const s = createGame('city', [{ id: 'me', name: 'Me' }, { id: 'remote', name: 'Remote' }], 42, 'network-game');
  s.time = time; s.players.forEach((p, i) => { p.x = 1000 + i * 100; p.y = 800; p.facing = 0; }); return s;
}
test('remote transforms interpolate between snapshots while mass/score remain authoritative', () => {
  const buffer = new SnapshotBuffer(), a = snapshot(0), b = snapshot(.1); b.players[1].x = 1200; b.players[1].mass = 100; b.players[1].score = 50;
  buffer.push(a, 1000); buffer.push(b, 1100);
  const rendered = buffer.sample(1050 + EAT.network.interpolationMs, 'me', { x: 0, y: 0 });
  assert.equal(rendered.players[1].x, 1150); assert.equal(rendered.players[1].mass, 100); assert.equal(rendered.players[1].score, 50);
  assert.equal(b.players[1].x, 1200); assert.equal(a.players[1].x, 1100);
});
test('network facing interpolates over the shortest arc across the angle seam', () => {
  const buffer = new SnapshotBuffer(), a = snapshot(0), b = snapshot(.1);
  a.players[1].facing = Math.PI - .1; b.players[1].facing = -Math.PI + .1;
  buffer.push(a, 1000); buffer.push(b, 1100);
  const p = buffer.sample(1050 + EAT.network.interpolationMs, 'me', { x: 0, y: 0 }).players[1];
  assert.ok(Math.abs(p.facing - Math.PI) < 1e-8);
});
test('local direction changes predict movement without predicting rewards or kills', () => {
  const buffer = new SnapshotBuffer(), state = snapshot(); buffer.push(state, 1000);
  const original = structuredClone(state), rendered = buffer.sample(1030, 'me', { x: 1, y: 0 });
  assert.ok(rendered.players[0].x > state.players[0].x); assert.equal(rendered.players[0].mass, 36);
  assert.equal(rendered.players[0].score, 0); assert.deepEqual(state, original); assert.equal(rendered.status, 'playing');
});
test('prediction is bounded during a network outage and respects solid scenery', () => {
  const buffer = new SnapshotBuffer(), state = snapshot();
  const p = state.players[1]; p.input = { x: 1, y: 0 }; p.vx = EAT.player.baseSpeed;
  buffer.push(state, 1000);
  const early = buffer.sample(1300, 'me', { x: 1, y: 0 }), late = buffer.sample(20000, 'me', { x: 1, y: 0 });
  assert.equal(early.players[1].x, late.players[1].x); assert.equal(early.players[0].x, late.players[0].x);
  assert.ok(late.players[1].x - p.x <= EAT.player.baseSpeed * EAT.network.maxExtrapolationMs / 1000 + 1e-8);
  const wall = snapshot(1); wall.encounter.shrine = { x: 1620, y: 350 }; Object.assign(wall.players[0], { x: 1620 - 66 - 25, y: 350, vx: EAT.player.baseSpeed }); buffer.push(wall, 21000);
  assert.ok(buffer.sample(22000, 'me', { x: 1, y: 0 }).players[0].x <= 1620 - 66 - 24);
});
test('elimination and completion immediately override buffered living-player transforms', () => {
  const buffer = new SnapshotBuffer(), a = snapshot(0), b = snapshot(.1); b.players[1].alive = false; b.players[1].placement = 2;
  buffer.push(a, 1000); buffer.push(b, 1100);
  assert.equal(buffer.sample(1120, 'me', { x: 1, y: 0 }).players[1].alive, false);
  b.status = 'finished'; b.winnerId = 'me'; assert.equal(buffer.sample(3000, 'me', { x: 1, y: 0 }), b);
});
test('buffer ignores time regressions, coalesces same-tick updates, caps memory and resets for rematches', () => {
  const buffer = new SnapshotBuffer(); buffer.push(snapshot(1), 1000); buffer.push(snapshot(.5), 1100); assert.equal(buffer.size, 1);
  const same = snapshot(1); same.players[0].mass = 88; buffer.push(same, 1100); assert.equal(buffer.size, 1);
  assert.equal(buffer.sample(1200, 'me', { x: 0, y: 0 }).players[0].mass, 88);
  for (let i = 0; i < 70; i++) buffer.push(snapshot(i + 2), 1200 + i * 100);
  assert.equal(buffer.size, EAT.network.maxSnapshots);
  const rematch = snapshot(0); rematch.id = 'new-game'; buffer.push(rematch, 10000); assert.equal(buffer.size, 1);
});

const networkSource = readFileSync(new URL('../src/games/eat-it/network.ts', import.meta.url), 'utf8');
const compiled = ts.transpileModule(networkSource, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2023 } }).outputText;
function transport() {
  const calls = [], scheduled = []; let receive, closed = 0;
  const channel = { on(_kind, _filter, callback) { receive = callback; return channel; }, subscribe() { return channel; } };
  const supabase = { channel: () => channel, removeChannel: async () => { closed++; }, functions: { invoke: async (_name, options) => await new Promise(resolve => calls.push({ options, resolve })) } };
  const exports = {};
  new Function('require', 'exports', 'setTimeout', 'clearTimeout', compiled)(
    name => name.includes('supabase') ? { supabase } : name.includes('presentation') ? { SnapshotBuffer } : { EAT },
    exports, (fn, delay) => { const task = { fn, delay }; scheduled.push(task); return task; }, task => { if (task) task.cancelled = true; },
  );
  const room = { id: 'room', room_code: 'ABC123', host_id: 'me', players: [], settings: { map: 'city', count: 2 }, game_state: snapshot(), status: 'playing', version: 0, last_tick: 1000 };
  const errors = [], transitions = [], connection = new exports.EatConnection(room, value => transitions.push(value), value => errors.push(value));
  const flush = () => new Promise(resolve => setImmediate(resolve));
  return { connection, calls, scheduled, room, errors, transitions, flush, receive: row => receive({ new: row }), get closed() { return closed; } };
}
test('network sends only input, applies timeout/cancellation, and keeps at most one request in flight', async () => {
  const t = transport(); assert.equal(t.calls.length, 1); assert.equal(t.scheduled.length, 0);
  assert.deepEqual(Object.keys(t.calls[0].options.body).sort(), ['code', 'input', 'op']);
  assert.equal(t.calls[0].options.timeout, EAT.network.requestTimeoutMs);
  t.connection.close(); assert.equal(t.calls[0].options.signal.aborted, true); assert.equal(t.closed, 1);
  t.calls[0].resolve({ data: { ...t.room, version: 1 }, error: null }); await t.flush(); assert.equal(t.scheduled.length, 0); assert.equal(t.errors.length, 0);
});
test('out-of-order HTTP/Realtime delivery cannot restore stale state, revive players or double-report results', async () => {
  const t = transport(); const latest = { ...t.room, version: 3, game_state: snapshot(1) }; latest.game_state.players[0].mass = 75;
  t.receive(latest); t.receive({ ...t.room, version: 2 });
  t.calls[0].resolve({ data: { ...t.room, version: 1 }, error: null }); await t.flush();
  assert.equal(t.connection.source.current.players[0].mass, 75); assert.equal(t.scheduled.length, 1);
  const finish = { ...latest, version: 4, status: 'finished', game_state: { ...latest.game_state, status: 'finished', winnerId: 'me' } };
  t.receive(finish); t.receive(finish); t.receive(latest);
  assert.equal(t.transitions.length, 1); assert.equal(t.connection.source.current.status, 'finished'); t.connection.close();
});
test('a failed network request reports an error and schedules recovery', async () => {
  const t = transport(); t.calls[0].resolve({ data: null, error: { message: 'timeout' } }); await t.flush();
  assert.equal(t.errors[0], 'timeout'); assert.equal(t.scheduled.length, 1);
  t.scheduled[0].fn(); assert.equal(t.calls.length, 2);
  t.calls[1].resolve({ data: { ...t.room, version: 1 }, error: null }); await t.flush(); assert.equal(t.errors.at(-1), ''); t.connection.close();
});
