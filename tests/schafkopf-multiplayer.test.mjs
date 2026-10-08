import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import ts from "typescript";
import * as engine from "../src/games/schafkopf/schafkopf.ts";
import * as botSettings from "../src/games/schafkopf/botConfig.ts";
import * as announcements from "../src/games/schafkopf/announcements.ts";

// Execute the real Edge handler with its auth/database boundaries replaced.
// The database fake performs atomic version-filtered writes, including races.
const source = readFileSync(new URL("../supabase/functions/schafkopf-multiplayer/index.ts", import.meta.url), "utf8");
const compiled = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2023 } }).outputText;
function server() {
  const rows = new Map();
  const hiddenRows = new Map();
  let handler;
  let nextId = 1;
  const db = {
    auth: { getUser: async token => ({ data: { user: token.startsWith("user-") ? { id: token } : null }, error: null }) },
    from(table) {
      if (table === "schafkopf_room_hidden") {
        let payload;
        const filters = [];
        const query = {
          select() { return query; },
          eq(key, value) { filters.push(row => row[key] === value); return query; },
          upsert(value) { payload = value; return query; },
          then(resolve, reject) {
            if (payload) hiddenRows.set(`${payload.room_id}:${payload.user_id}`, structuredClone(payload));
            return Promise.resolve({ data: [...hiddenRows.values()].filter(row => filters.every(filter => filter(row))), error: null }).then(resolve, reject);
          },
        };
        return query;
      }
      assert.equal(table, "schafkopf_rooms");
      let op = "read", payload, countOnly = false;
      let orderBy, ascending = true, maximum = Infinity;
      const filters = [];
      const query = {
        select(_columns, options) { if (options?.count) countOnly = true; return query; },
        insert(value) { op = "insert"; payload = value; return query; },
        update(value) { op = "update"; payload = value; return query; },
        delete() { op = "delete"; return query; },
        eq(key, value) { filters.push(row => row[key] === value); return query; },
        gte(key, value) { filters.push(row => row[key] >= value); return query; },
        contains(key, value) { filters.push(row => value.every(expected => row[key].some(actual => Object.entries(expected).every(([field, val]) => actual[field] === val)))); return query; },
        order(key, options) { orderBy = key; ascending = options?.ascending ?? true; return query; },
        limit(value) { maximum = value; return query; },
        async run(single = false) {
          const matches = [...rows.values()].filter(row => filters.every(filter => filter(row)));
          if (orderBy) matches.sort((a, b) => ascending ? String(a[orderBy]).localeCompare(String(b[orderBy])) : String(b[orderBy]).localeCompare(String(a[orderBy])));
          matches.splice(maximum);
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
    name => name.includes("supabase-js") ? { createClient: () => db } : name.includes("announcements") ? announcements : name.includes("botConfig") ? botSettings : engine,
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

test('online host controls knock duration and run/knocker switches; invalid times are rejected',async()=>{
  const s=server(), room=await fullRoom(s);
  const rules={...engine.DEFAULT_GAME_RULES,legen:true,multiplayerKlopfSekunden:47,hotseatKlopfSekunden:22,laufendeAktiv:false,klopferMussSpiel:false};
  const before=Date.now();
  const result=await s.request('user-0',{op:'start',code:room.code,version:room.version,rules});
  assert.equal(result.status,200);
  assert.ok(result.body.game.legenDeadline>=before+47000 && result.body.game.legenDeadline<=Date.now()+47000);
  assert.equal(result.body.game.rules.laufendeAktiv,false);
  assert.equal(result.body.game.rules.klopferMussSpiel,false);
  const invalid=await s.request('user-0',{op:'rules',code:room.code,version:result.body.version,rules:{...rules,multiplayerKlopfSekunden:0}});
  assert.equal(invalid.status,400);
});

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
  const { body: started, status } = await s.request("user-0", { op: "start", code: room.code, version: room.version, rules: { ...engine.DEFAULT_GAME_RULES, legen: false } });
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

test("online Legen accepts independent decisions and gives each player their second packet immediately", async () => {
  const s = server();
  const room = await fullRoom(s);
  let state = (await s.request("user-0", { op: "start", code: room.code, version: room.version, rules: { ...engine.DEFAULT_GAME_RULES, legen: true } })).body;
  assert.equal(state.game.phase, "legen");
  assert.ok(state.game.legenDeadline - Date.now() <= 30_000);
  assert.ok(state.game.legenDeadline - Date.now() > 19_000);
  assert.equal(state.game.turnDeadline, null);
  assert.equal(state.game.hand.length, 4);
  assert.equal(state.game.pendingHands, undefined);
  for (const seat of [2, 0, 3, 1]) {
    const response = await s.request(`user-${seat}`, { op: "action", code: room.code, version: state.version, action: { type: "legen", knock: seat < 2 } });
    assert.equal(response.status, 200);
    state = response.body;
    assert.equal(state.game.pendingHands, undefined);
    assert.equal(state.game.hand.length, 8);
  }
  assert.equal(state.game.phase, "intent");
  assert.equal(state.game.hand.length, 8);
  assert.equal(state.game.multiplier, 4);
});

test("online announcements and card turns receive a shared 60-second clock", async () => {
  const s = server();
  const room = await fullRoom(s);
  const started = (await s.request("user-0", { op: "start", code: room.code, version: room.version, rules: { ...engine.DEFAULT_GAME_RULES, legen: false } })).body;
  assert.equal(started.game.phase, "intent");
  assert.ok(started.game.turnDeadline - Date.now() <= 60_000);
  assert.ok(started.game.turnDeadline - Date.now() > 59_000);
  const moved = (await s.request("user-0", { op: "action", code: room.code, version: started.version, action: { type: "intent", play: false } })).body;
  assert.equal(moved.game.turn, 1);
  assert.ok(moved.game.turnDeadline - Date.now() <= 60_000);
  assert.ok(moved.game.turnDeadline - Date.now() > 59_000);
});

test("online Legen timeout passes undecided players after 30 seconds", async () => {
  const s = server();
  const room = await fullRoom(s);
  const started = await s.request("user-0", { op: "start", code: room.code, version: room.version, rules: { ...engine.DEFAULT_GAME_RULES, legen: true } });
  assert.equal(started.status, 200);
  const row = [...s.rows.values()][0];
  row.game.legenDeadline = Date.now() - 1;
  const resolved = await s.request("user-2", { op: "get", code: room.code });
  assert.equal(resolved.status, 200);
  assert.equal(resolved.body.game.phase, "intent");
  assert.deepEqual(resolved.body.game.legenDecisions, [false, false, false, false]);
  assert.equal(resolved.body.game.hand.length, 8);
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

test("a host can start with three AI seats and the server advances their turns", async () => {
  const s = server();
  const created = (await s.request("user-0", { op: "create", name: "Host", title: "Sonntagsrunde", aiDifficulty: "pro" })).body;
  const started = await s.request("user-0", { op: "start", code: created.code, version: created.version, rules: { ...engine.DEFAULT_GAME_RULES, legen: false }, title: "Sonntagsrunde", aiDifficulty: "pro" });
  assert.equal(started.status, 200);
  assert.equal(started.body.players.length, 4);
  assert.equal(started.body.players.filter(player => player.bot).length, 3);
  assert.equal(started.body.game.hands, undefined);
  const afterHuman = await s.request("user-0", { op: "action", code: created.code, version: started.body.version, action: { type: "intent", play: false } });
  assert.equal(afterHuman.status, 200);
  const row = [...s.rows.values()][0];
  assert.equal(row.game.turn, 1);
  row.updated_at = new Date(Date.now() - 2000).toISOString();
  const afterBot = await s.request("user-0", { op: "get", code: created.code });
  assert.equal(afterBot.status, 200);
  assert.equal(afterBot.body.version, afterHuman.body.version + 1);
  assert.equal(afterBot.body.game.hands, undefined);
});

test("saved game days show scores, guests can hide them, and hosts can delete them", async () => {
  const s = server();
  const created = (await s.request("user-0", { op: "create", name: "Host", title: "Freitagsrunde", aiDifficulty: "normal" })).body;
  const joined = (await s.request("user-1", { op: "join", code: created.code, name: "Gast" })).body;
  const started = (await s.request("user-0", { op: "start", code: created.code, version: joined.version, rules: engine.DEFAULT_GAME_RULES, title: "Freitagsrunde", aiDifficulty: "normal" })).body;
  const hostList = await s.request("user-0", { op: "list" });
  assert.equal(hostList.status, 200);
  assert.equal(hostList.body[0].title, "Freitagsrunde");
  assert.equal(hostList.body[0].totals.length, 4);
  assert.equal(hostList.body[0].game, undefined);
  const hidden = await s.request("user-1", { op: "delete", code: created.code, version: started.version });
  assert.equal(hidden.status, 200);
  assert.equal((await s.request("user-1", { op: "list" })).body.length, 0);
  assert.equal((await s.request("user-0", { op: "list" })).body.length, 1);
  assert.equal((await s.request("user-0", { op: "delete", code: created.code, version: started.version - 1 })).status, 200, "deleting a saved day also works after a newer move");
  assert.equal(s.rows.size, 0);
});

test("the host can hand a human seat to AI and the player can reclaim it", async () => {
  const s = server();
  const created = (await s.request("user-0", { op: "create", name: "Host" })).body;
  const joined = (await s.request("user-1", { op: "join", code: created.code, name: "Gast" })).body;
  const started = (await s.request("user-0", { op: "start", code: created.code, version: joined.version, rules: engine.DEFAULT_GAME_RULES })).body;
  const replaced = await s.request("user-0", { op: "replace", code: created.code, version: started.version, seat: 1, bot: true });
  assert.equal(replaced.status, 200);
  assert.equal(replaced.body.players[1].bot, true);
  const restored = await s.request("user-1", { op: "replace", code: created.code, version: replaced.body.version, seat: 1, bot: false });
  assert.equal(restored.status, 200);
  assert.equal(restored.body.players[1].bot, false);
  assert.equal((await s.request("user-1", { op: "replace", code: created.code, version: restored.body.version, seat: 1, bot: true })).status, 400);
});

test("host changes a seat between games without passing its score to the replacement", async () => {
  const s = server();
  const created = (await s.request("user-0", { op: "create", name: "Host" })).body;
  const joined = (await s.request("user-1", { op: "join", code: created.code, name: "Old guest" })).body;
  const started = (await s.request("user-0", { op: "start", code: created.code, version: joined.version, rules: engine.DEFAULT_GAME_RULES })).body;
  assert.equal((await s.request("user-0", { op: "vacate", code: created.code, version: started.version, seat: 1 })).status, 400);
  const row = [...s.rows.values()][0];
  row.game.phase = "finished";
  row.game.totals[1] = 42;
  assert.equal((await s.request("user-1", { op: "vacate", code: created.code, version: row.version, seat: 1 })).status, 400);
  const freed = await s.request("user-0", { op: "vacate", code: created.code, version: row.version, seat: 1 });
  assert.equal(freed.status, 200);
  assert.match(freed.body.players[1].id, /^bot:/);
  assert.deepEqual(freed.body.pendingSeats, [1]);
  assert.equal((await s.request("user-1", { op: "get", code: created.code })).status, 403);
  const oldList = (await s.request("user-1", { op: "list" })).body;
  assert.equal(oldList.length, 1);
  assert.deepEqual(oldList[0].formerPlayers, [{ id: "user-1", name: "Old guest", total: 42, round: 1 }]);
  const replacement = await s.request("user-2", { op: "join", code: created.code, name: "New guest" });
  assert.equal(replacement.status, 200);
  assert.equal(replacement.body.players[1].name, "New guest");
  const next = await s.request("user-0", { op: "action", code: created.code, version: replacement.body.version, action: { type: "next" } });
  assert.equal(next.status, 200);
  assert.equal(next.body.game.names[1], "New guest");
  assert.equal(next.body.game.totals[1], 0);
  assert.deepEqual(next.body.pendingSeats, []);
  assert.equal((await s.request("user-1", { op: "delete", code: created.code, version: next.body.version })).status, 200);
  assert.equal((await s.request("user-1", { op: "list" })).body.length, 0);
  assert.equal((await s.request("user-0", { op: "get", code: created.code })).status, 200);
});

test("only the online host can set a valid trick collection delay", async () => {
  const s = server();
  const created = (await s.request("user-0", { op: "create", name: "Host", aiDifficulty: "legend" })).body;
  const joined = (await s.request("user-1", { op: "join", code: created.code, name: "Guest" })).body;
  const started = (await s.request("user-0", { op: "start", code: created.code, version: joined.version, rules: engine.DEFAULT_GAME_RULES, aiDifficulty: "legend" })).body;
  assert.equal(started.collectSeconds, 2);
  assert.equal((await s.request("user-1", { op: "timing", code: created.code, version: started.version, collectSeconds: 7 })).status, 400);
  assert.equal((await s.request("user-0", { op: "timing", code: created.code, version: started.version, collectSeconds: 11 })).status, 400);
  const changed = await s.request("user-0", { op: "timing", code: created.code, version: started.version, collectSeconds: 7 });
  assert.equal(changed.status, 200);
  assert.equal(changed.body.collectSeconds, 7);
  assert.equal((await s.request("user-1", { op: "get", code: created.code })).body.collectSeconds, 7);
});

test("host bot configuration survives validated online rules, but guests cannot change it", async () => {
  const s=server(); const room=await fullRoom(s);
  const configured={...engine.DEFAULT_GAME_RULES,bot:{legendIterations:350,legendTimeMs:250,proError:.01}};
  const started=await s.request("user-0",{op:"start",code:room.code,version:room.version,rules:configured});
  assert.equal(started.status,200);
  assert.equal(started.body.game.rules.bot.legendIterations,350);
  assert.equal(started.body.game.rules.bot.proError,.01);
  const denied=await s.request("user-1",{op:"rules",code:room.code,version:started.body.version,rules:configured});
  assert.equal(denied.status,400);
  assert.match(denied.body.error,/Gastgeber/);
  const invalid=await s.request("user-0",{op:"rules",code:room.code,version:started.body.version,rules:{...configured,bot:[]}});
  assert.equal(invalid.status,400);
});
