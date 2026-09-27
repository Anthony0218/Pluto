import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import ts from "typescript";
import * as engine from "../src/games/schafkopf/schafkopf.ts";

// Execute the real Edge handler with its auth/database boundaries replaced.
// The database fake performs atomic version-filtered writes, including races.
const source = readFileSync(new URL("../supabase/functions/schafkopf-multiplayer/index.ts", import.meta.url), "utf8");
const compiled = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2023 } }).outputText;
function server() {
  const rows = new Map();
  let handler;
  let nextId = 1;
  const db = {
    auth: { getUser: async token => ({ data: { user: token.startsWith("user-") ? { id: token } : null }, error: null }) },
    from(table) {
      assert.equal(table, "schafkopf_rooms");
      let op = "read", payload, countOnly = false;
      const filters = [];
      const query = {
        select(_columns, options) { if (options?.count) countOnly = true; return query; },
        insert(value) { op = "insert"; payload = value; return query; },
        update(value) { op = "update"; payload = value; return query; },
        delete() { op = "delete"; return query; },
        eq(key, value) { filters.push(row => row[key] === value); return query; },
        gte(key, value) { filters.push(row => row[key] >= value); return query; },
        async run(single = false) {
          const matches = [...rows.values()].filter(row => filters.every(filter => filter(row)));
          if (countOnly) return { count: matches.length, error: null };
          if (op === "insert") {
            if ([...rows.values()].some(row => row.code === payload.code)) return { data: null, error: { code: "23505" } };
            const row = { id: `room-${nextId++}`, version: 0, game: null, updated_at: new Date().toISOString(), ...structuredClone(payload) };
            rows.set(row.id, row);
            return { data: structuredClone(row), error: null };
          }
          if (op === "update") for (const row of matches) Object.assign(row, structuredClone(payload));
          if (op === "delete") for (const row of matches) rows.delete(row.id);
          return { data: structuredClone(single ? matches[0] ?? null : matches), error: null };
        },
        single() { return query.run(true); },
        maybeSingle() { return query.run(true); },
        then(resolve, reject) { return query.run().then(resolve, reject); },
      };
      return query;
    },
  };
  new Function("require", "Deno", "exports", compiled)(
    name => name.includes("supabase-js") ? { createClient: () => db } : engine,
    { env: { get: () => "test-only" }, serve: value => { handler = value; } }, {},
  );
  async function request(user, body) {
    const result = await handler(new Request("http://localhost/schafkopf", { method: "POST", headers: user ? { Authorization: `Bearer ${user}` } : {}, body: JSON.stringify(body) }));
    return { status: result.status, body: await result.json() };
  }
  return { request, rows };
}
async function fullRoom(server) {
  let { body } = await server.request("user-0", { op: "create", name: "Host" });
  for (let seat = 1; seat < 4; seat++) ({ body } = await server.request(`user-${seat}`, { op: "join", code: body.code, name: `Player ${seat}` }));
  return body;
}

test("endpoint rejects missing/invalid auth and outsider reads", async () => {
  const s = server();
  assert.equal((await s.request(null, { op: "create" })).status, 401);
  assert.equal((await s.request("invalid", { op: "create" })).status, 401);
  const { body: room } = await s.request("user-0", { op: "create", name: "Host" });
  assert.equal((await s.request("user-1", { op: "get", code: room.code })).status, 403);
  assert.equal((await s.request("user-0", { op: "get", code: "!!!!!!" })).status, 400);
});

test("concurrent joins retain all seats, reject a fifth, and permit reconnect", async () => {
  const s = server();
  const { body: room } = await s.request("user-0", { op: "create" });
  const joined = await Promise.all([1, 2, 3].map(seat => s.request(`user-${seat}`, { op: "join", code: room.code, name: `Player ${seat}` })));
  assert.ok(joined.every(result => result.status === 200));
  const current = (await s.request("user-0", { op: "get", code: room.code })).body;
  assert.equal(current.players.length, 4);
  assert.equal(new Set(current.players.map(p => p.id)).size, 4);
  assert.equal((await s.request("user-4", { op: "join", code: room.code })).status, 400);
  const reconnect = await s.request("user-2", { op: "join", code: room.code });
  assert.equal(reconnect.status, 200);
  assert.equal(reconnect.body.version, current.version);
});

test("only host starts; responses redact hands; concurrent moves commit only once", async () => {
  const s = server();
  const room = await fullRoom(s);
  assert.equal((await s.request("user-1", { op: "start", code: room.code, version: room.version })).status, 400);
  const { body: started, status } = await s.request("user-0", { op: "start", code: room.code, version: room.version });
  assert.equal(status, 200);
  assert.equal(started.game.hand.length, 8);
  assert.equal(started.game.hands, undefined);
  assert.equal(started.game.initialHands, undefined);
  assert.equal(started.game.partner, null);
  const other = (await s.request("user-1", { op: "get", code: room.code })).body;
  assert.equal(other.game.seat, 1);
  assert.equal(other.game.hand.some(c => started.game.hand.some(m => m.id === c.id)), false);
  const action = { op: "action", code: room.code, version: started.version, action: { type: "intent", play: false } };
  assert.equal((await s.request("user-1", action)).status, 400, "wrong seat cannot act");
  const raced = await Promise.all([s.request("user-0", action), s.request("user-0", action)]);
  assert.deepEqual(raced.map(r => r.status).sort(), [200, 409]);
  const latest = (await s.request("user-0", { op: "get", code: room.code })).body;
  assert.equal(latest.version, started.version + 1);
  assert.equal(latest.game.declarations, 1);
  assert.equal((await s.request("user-0", action)).status, 409, "stale version cannot replay");
  assert.equal((await s.request("user-0", { op: "leave", code: room.code, version: latest.version })).status, 400);
  assert.equal((await s.request("user-3", { op: "join", code: room.code })).status, 200, "running seat reconnects");
});

test("waiting host can leave and ownership transfers; final player removes empty room", async () => {
  const s = server();
  const { body: created } = await s.request("user-0", { op: "create" });
  const { body: joined } = await s.request("user-1", { op: "join", code: created.code });
  assert.equal((await s.request("user-0", { op: "leave", code: created.code, version: joined.version })).status, 200);
  const { body: room } = await s.request("user-1", { op: "get", code: created.code });
  assert.equal(room.hostId, "user-1");
  assert.equal(room.players.length, 1);
  assert.equal((await s.request("user-1", { op: "leave", code: room.code, version: room.version })).status, 200);
  assert.equal(s.rows.size, 0);
});

test("endpoint enforces Zugeben even when a client bypasses disabled cards", async () => {
  const s = server();
  const room = await fullRoom(s);
  const row = [...s.rows.values()][0];
  const game = engine.createGame();
  const card = (suit, rank) => ({ id: `${suit}-${rank}`, suit, rank });
  Object.assign(game, { phase: "play", turn: 0, declarer: 1, contract: { kind: "solo", suit: "Herz" }, trick: [{ seat: 3, card: card("Eichel", "9") }] });
  game.hands[0] = [card("Eichel", "7"), card("Herz", "Ass")];
  row.game = game;
  const response = await s.request("user-0", { op: "action", code: room.code, version: room.version, action: { type: "play", cardId: "Herz-Ass" } });
  assert.equal(response.status, 400);
  assert.match(response.body.error, /zugeben/);
  assert.equal(row.version, room.version);
  assert.equal(row.game.hands[0].length, 2);
});
