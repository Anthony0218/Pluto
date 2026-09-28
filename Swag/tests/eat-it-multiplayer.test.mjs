import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import ts from 'typescript';
import * as authority from '../src/games/eat-it/authority.ts';
import * as config from '../src/games/eat-it/config.ts';

// Follow the existing Schafkopf endpoint-test pattern: execute the actual Edge
// handler, replacing only auth/database I/O with atomic, version-filtered storage.
const source = readFileSync(new URL('../supabase/functions/eat-it-match/index.ts', import.meta.url), 'utf8');
const compiled = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2023 } }).outputText;
function server() {
  const rows = new Map(), clock = { now: 1800000000000 };
  let handler, nextId = 1, writes = 0, failedWrites = 0;
  const db = {
    auth: { getUser: async token => ({ data: { user: /^user-\d+$/.test(token) ? { id: token } : null }, error: null }) },
    from(table) {
      let op = 'read', payload, countOnly = false; const filters = [];
      const query = {
        select(_columns, options) { countOnly ||= !!options?.count; return query; },
        eq(key, value) { filters.push(row => row[key] === value); return query; },
        gte(key, value) { filters.push(row => row[key] >= value); return query; },
        insert(value) { payload = value; op = 'insert'; return query; },
        update(value) { payload = value; op = 'update'; return query; },
        async run(single = false) {
          if (table === 'profiles') return { data: { display_name: 'Profile name', username: 'profile-name' }, error: null };
          assert.equal(table, 'eat_it_matches');
          const matches = [...rows.values()].filter(row => filters.every(filter => filter(row)));
          if (countOnly) return { data: null, count: matches.length, error: null };
          if (op === 'insert') {
            if ([...rows.values()].some(row => row.room_code === payload.room_code)) return { data: null, error: { code: '23505' } };
            const row = { id: `room-${nextId++}`, version: 0, status: 'waiting', game_state: null, created_at: new Date(clock.now).toISOString(), ...structuredClone(payload) };
            rows.set(row.id, row); writes++; return { data: structuredClone(row), error: null };
          }
          if (op === 'update') {
            if (matches.length === 0) failedWrites++;
            for (const row of matches) { Object.assign(row, structuredClone(payload)); writes++; }
          }
          return { data: structuredClone(single ? matches[0] ?? null : matches), error: null };
        },
        single() { return query.run(true); }, maybeSingle() { return query.run(true); },
        then(resolve, reject) { return query.run().then(resolve, reject); },
      };
      return query;
    },
  };
  class ServerDate extends Date {
    constructor(...args) { super(...(args.length ? args : [clock.now])); }
    static now() { return clock.now; }
  }
  new Function('require', 'Deno', 'exports', 'Date', compiled)(
    name => name.includes('supabase-js') ? { createClient: () => db } : name.includes('authority') ? authority : config,
    { env: { get: () => 'test-only' }, serve: value => { handler = value; } }, {}, ServerDate,
  );
  async function request(user, body, method = 'POST') {
    const response = await handler(new Request('http://localhost/eat-it-match', {
      method, headers: user ? { Authorization: `Bearer ${user}` } : {},
      ...(method === 'POST' ? { body: typeof body === 'string' ? body : JSON.stringify(body) } : {}),
    }));
    const text = await response.text();
    return { status: response.status, body: text === 'ok' ? text : JSON.parse(text) };
  }
  return { rows, clock, request, get writes() { return writes; }, get failedWrites() { return failedWrites; } };
}
async function create(s, count = 4) {
  const result = await s.request('user-0', { op: 'create', map: 'city', count });
  assert.equal(result.status, 200); return result.body;
}
async function start(s, room) {
  for (const member of room.players) assert.equal((await s.request(member.id, { op: 'ready', code: room.room_code })).status, 200);
  const response = await s.request(room.host_id, { op: 'start', code: room.room_code }); assert.equal(response.status, 200); return response.body;
}

test('Eat It endpoint rejects unauthenticated/outsider reads, invalid payloads and oversized requests', async () => {
  const s = server();
  assert.equal((await s.request(null, { op: 'create' })).status, 401);
  assert.equal((await s.request('invalid', { op: 'create' })).status, 401);
  assert.equal((await s.request(null, null, 'OPTIONS')).status, 200);
  assert.equal((await s.request('user-0', null, 'GET')).status, 405);
  for (const body of ['{bad', 'null', '[]', '1', JSON.stringify({ op: 'create', padding: 'x'.repeat(2050) })]) {
    assert.ok((await s.request('user-0', body)).status >= 400);
  }
  const room = await create(s);
  assert.equal((await s.request('user-1', { op: 'get', code: room.room_code })).status, 403);
  assert.equal((await s.request('user-1', { op: 'input', code: room.room_code, input: { x: 1, y: 0 } })).status, 403);
  assert.equal((await s.request('user-0', { op: 'get', code: '!!!!!!' })).status, 400);
  assert.equal((await s.request('user-0', { op: 'get', code: 'ZZZZZZ' })).status, 404);
});
test('waiting and result reads do not cause a Realtime update feedback loop', async () => {
  const s = server(), room = await create(s); const before = s.writes;
  for (let i = 0; i < 30; i++) { s.clock.now += 10; assert.equal((await s.request('user-0', { op: 'join', code: room.room_code })).status, 200); }
  assert.equal(s.writes, before);
  s.clock.now += 5000; await s.request('user-0', { op: 'get', code: room.room_code });
  assert.equal(s.writes, before + 1);
  s.clock.now += 10; await s.request('user-0', { op: 'get', code: room.room_code }); assert.equal(s.writes, before + 1);
});
test('seven simultaneous joins fill an eight-human room without losing seats; ninth is rejected', async () => {
  const s = server(), room = await create(s, 8);
  const joined = await Promise.all(Array.from({ length: 7 }, (_, i) => s.request(`user-${i + 1}`, { op: 'join', code: room.room_code })));
  assert.ok(joined.every(r => r.status === 200), JSON.stringify(joined.map(r => r.status)));
  assert.ok(s.failedWrites > 0, 'the test exercised CAS conflicts');
  const current = (await s.request('user-0', { op: 'get', code: room.room_code })).body;
  assert.equal(new Set(current.players.map(p => p.id)).size, 8);
  assert.equal((await s.request('user-8', { op: 'join', code: room.room_code })).status, 400);
  assert.equal((await s.request('user-3', { op: 'join', code: room.room_code })).body.players.length, 8);
  assert.ok(current.players.every(p => p.name === 'Profile name'), 'names come from profiles, not client claims');
});
test('ready/host checks and human-bot filling survive concurrent requests', async () => {
  const s = server(), room = await create(s, 8);
  const joined = (await s.request('user-1', { op: 'join', code: room.room_code })).body;
  assert.equal((await s.request('user-1', { op: 'start', code: room.room_code })).status, 400);
  assert.equal((await s.request('user-0', { op: 'start', code: room.room_code })).status, 400);
  const ready = await Promise.all(joined.players.map(p => s.request(p.id, { op: 'ready', code: room.room_code })));
  assert.ok(ready.every(r => r.status === 200));
  const started = await s.request('user-0', { op: 'start', code: room.room_code }); assert.equal(started.status, 200);
  assert.equal(started.body.game_state.players.length, 8); assert.equal(started.body.game_state.players.filter(p => p.bot).length, 6);
  assert.equal((await s.request('user-2', { op: 'join', code: room.room_code })).status, 400);
});
test('simultaneous input packets commit a bite and its mass/score reward exactly once', async () => {
  const s = server(), room = await create(s, 2);
  const joined = (await s.request('user-1', { op: 'join', code: room.room_code })).body; await start(s, joined);
  const row = s.rows.get(room.id), state = row.game_state, [a, b] = state.players;
  state.food = []; state.powerups = []; state.nextFood = 1000; state.nextPower = 1000;
  Object.assign(a, { x: 1000, y: 800, mass: 100, facing: 0 }); Object.assign(b, { x: 1045, y: 800, mass: 36 });
  s.clock.now += 100;
  const responses = await Promise.all([0, 1, 0, 1].map(i => s.request(`user-${i}`, { op: 'input', code: room.room_code, input: { x: 0, y: 0 }, mass: 100000, score: 999999, ate: 'user-0', dt: 500 })));
  assert.ok(responses.every(r => r.status === 200));
  assert.equal(row.status, 'finished'); assert.equal(row.game_state.winnerId, 'user-0');
  assert.equal(row.game_state.players[0].mass, 125.2); assert.equal(row.game_state.players[0].playersEaten, 1);
  assert.equal(row.game_state.players[0].score, 360); assert.equal(row.game_state.players[1].alive, false);
  const writes = s.writes; await s.request('user-0', { op: 'get', code: room.room_code }); assert.equal(s.writes, writes);
});
test('active leavers remain available to result recording, but do not block the next lobby', async () => {
  const s = server(), room = await create(s, 2);
  const joined = (await s.request('user-1', { op: 'join', code: room.room_code })).body; await start(s, joined);
  const left = await s.request('user-1', { op: 'leave', code: room.room_code }); assert.equal(left.status, 200);
  assert.equal(left.body.status, 'finished'); assert.equal(left.body.players.length, 2);
  assert.equal(left.body.players.find(p => p.id === 'user-1').departed, true);
  const rematch = await s.request('user-0', { op: 'rematch', code: room.room_code }); assert.equal(rematch.status, 200);
  assert.equal(rematch.body.players.length, 1); assert.equal(rematch.body.players[0].ready, false);
  assert.equal((await start(s, rematch.body)).game_state.players.filter(p => p.bot).length, 1);
});
test('disconnected host forfeits and a connected human can host the rematch', async () => {
  const s = server(), room = await create(s, 2);
  const joined = (await s.request('user-1', { op: 'join', code: room.room_code })).body; await start(s, joined);
  const row = s.rows.get(room.id); s.clock.now += 21000; row.players[1].lastSeen = s.clock.now;
  const response = await s.request('user-1', { op: 'input', code: room.room_code, input: { x: 0, y: 0 } });
  assert.equal(response.status, 200); assert.equal(response.body.host_id, 'user-1'); assert.equal(response.body.game_state.winnerId, 'user-1');
  const rematch = await s.request('user-1', { op: 'rematch', code: room.room_code }); assert.equal(rematch.status, 200); assert.equal(rematch.body.players.length, 1);
});
test('leaving an empty waiting room allows the next entrant to become host', async () => {
  const s = server(), room = await create(s);
  await s.request('user-0', { op: 'leave', code: room.room_code });
  const joined = (await s.request('user-1', { op: 'join', code: room.room_code })).body;
  assert.equal(joined.host_id, 'user-1'); assert.equal((await start(s, joined)).status, 'playing');
});
test('stale inputs stop and newer inputs do not retroactively move the elapsed interval', async () => {
  const s = server(), room = await create(s); await start(s, room);
  const row = s.rows.get(room.id), p = row.game_state.players[0]; row.game_state.players.slice(1).forEach(b => { b.bot = false; });
  row.game_state.food = []; row.game_state.powerups = []; const originalX = p.x;
  s.clock.now += 125; await s.request('user-0', { op: 'input', code: room.room_code, input: { x: 1000, y: 0 } });
  assert.equal(row.game_state.players[0].x, originalX); assert.deepEqual(row.game_state.players[0].input, { x: 1, y: 0 });
  s.clock.now += 125; await s.request('user-0', { op: 'input', code: room.room_code, input: { x: 1, y: 0 } });
  assert.ok(row.game_state.players[0].x > originalX);
  s.clock.now += 1000; await s.request('user-0', { op: 'get', code: room.room_code });
  assert.deepEqual(row.game_state.players[0].input, { x: 0, y: 0 });
});
