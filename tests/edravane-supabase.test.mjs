import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { PGlite } from "@electric-sql/pglite";
import { councilHandler } from "../supabase/functions/edravane-match/handler.ts";
import {
  makeBattle,
  startCombat,
} from "../src/games/MedievalKingdoms/edravane/battle.ts";
import { defaultPlan } from "../src/games/MedievalKingdoms/edravane/battleRounds.ts";
import {
  makeCouncil,
  applyCouncilRequest,
  syncCouncil,
  PRESENCE_MS,
} from "../src/games/MedievalKingdoms/edravane/multiplayer.ts";
const A = "00000000-0000-4000-8000-000000000001",
  B = "00000000-0000-4000-8000-000000000002",
  V = "00000000-0000-4000-8000-000000000003";
const code = "ABCD1234";
function store() {
  const rooms = new Map(),
    leases = new Map();
  let now = 100000;
  const deps = {
    authenticate: async (token) => ([A, B, V].includes(token) ? token : null),
    read: async (code) => structuredClone(rooms.get(code) ?? null),
    presence: async (code) => structuredClone(leases.get(code) ?? []),
    write: async (room, expected, actor) => {
      await Promise.resolve();
      if ((rooms.get(room.code)?.version ?? -1) !== expected) return false;
      rooms.set(room.code, structuredClone(room));
      const old = leases.get(room.code) ?? [];
      leases.set(
        room.code,
        room.sessions.map((s) => ({
          user_id: s.id,
          active: s.connected,
          last_seen:
            s.id === actor
              ? new Date(now).toISOString()
              : (old.find((p) => p.user_id === s.id)?.last_seen ??
                new Date(now).toISOString()),
        })),
      );
      return true;
    },
    creations: async (user) =>
      [...rooms.values()].filter((r) => r.host === user).length,
    now: () => now,
    code: () => code,
  };
  const handler = councilHandler(deps);
  const request = async (user, body) => {
    const response = await handler(
      new Request("https://test.invalid", {
        method: "POST",
        headers: user ? { Authorization: `Bearer ${user}` } : {},
        body: JSON.stringify(body),
      }),
    );
    return { status: response.status, ...(await response.json()) };
  };
  return { rooms, leases, deps, handler, request, time: (n) => (now = n) };
}
async function lobby(f) {
  assert.equal(
    (await f.request(A, { type: "create", nation: "auremarch", name: "Host" }))
      .status,
    200,
  );
  assert.equal(
    (
      await f.request(B, {
        type: "join",
        code,
        nation: "high-cairn",
        name: "Guest",
      })
    ).status,
    200,
  );
}
async function campaign(f) {
  await lobby(f);
  await f.request(A, { type: "ready", code, ready: true });
  await f.request(B, { type: "ready", code, ready: true });
  return f.request(A, { type: "start", code });
}

test("Supabase endpoint authenticates, rejects outsiders and validates requests before exposing a council", async () => {
  const f = store();
  assert.equal((await f.request(null, { type: "create" })).status, 401);
  assert.equal((await f.request("fake", { type: "create" })).status, 401);
  await lobby(f);
  assert.equal((await f.request(V, { type: "snapshot", code })).status, 403);
  assert.equal(
    (await f.request(V, { type: "join", code, nation: "auremarch" })).status,
    400,
  );
  const bad = await f.handler(
    new Request("https://test.invalid", {
      method: "POST",
      headers: { Authorization: `Bearer ${A}` },
      body: "x".repeat(8193),
    }),
  );
  assert.equal(bad.status, 413);
});
test("host and guest both ready; only the host starts or edits settings and settings reset readiness", async () => {
  const f = store();
  await lobby(f);
  assert.equal((await f.request(A, { type: "start", code })).status, 400);
  await f.request(A, { type: "ready", code, ready: true });
  await f.request(B, { type: "ready", code, ready: true });
  assert.equal((await f.request(B, { type: "start", code })).status, 400);
  assert.equal(
    (
      await f.request(B, {
        type: "settings",
        code,
        tickSeconds: 4,
        maritimeHazard: 0,
      })
    ).status,
    400,
  );
  const settings = await f.request(A, {
    type: "settings",
    code,
    tickSeconds: 4,
    maritimeHazard: 0,
  });
  assert.ok(settings.room.slots.filter((s) => s.player).every((s) => !s.ready));
  await f.request(A, { type: "ready", code, ready: true });
  await f.request(B, { type: "ready", code, ready: true });
  const started = await f.request(A, { type: "start", code });
  assert.equal(started.status, 200);
  assert.equal(started.room.state.mode, "multi");
});
test("concurrent Supabase joins recompute against the winning database version instead of overwriting a seat", async () => {
  const f = store();
  await f.request(A, { type: "create", nation: "auremarch" });
  const results = await Promise.all([
    f.request(B, { type: "join", code, nation: "high-cairn" }),
    f.request(V, { type: "join", code, nation: "high-cairn" }),
  ]);
  assert.equal(results.filter((r) => r.status === 200).length, 1);
  assert.equal(f.rooms.get(code).sessions.length, 2);
});
test("Supabase campaign orders preserve actor authority, reject replay, and never advance human turns with elapsed time", async () => {
  const f = store();
  const started = await campaign(f);
  const before = structuredClone(started.room.state);
  const foreign = await f.request(B, {
    type: "command",
    code,
    seq: 1,
    command: { type: "endTurn" },
  });
  assert.equal(foreign.status, 400);
  f.time(130000);
  const snapshot = await f.request(A, { type: "snapshot", code });
  assert.deepEqual(snapshot.room.state, before);
  const ended = await f.request(A, {
    type: "command",
    code,
    seq: 1,
    command: { type: "endTurn" },
  });
  assert.equal(ended.status, 200);
  assert.equal(
    ended.room.state.turns.order[ended.room.state.turns.index],
    "high-cairn",
  );
  assert.equal(
    (
      await f.request(A, {
        type: "command",
        code,
        seq: 1,
        command: { type: "endTurn" },
      })
    ).status,
    400,
  );
});
test("Supabase battle plans stay private and the round waits for both players, with durable wounded aftermath", async () => {
  const f = store();
  await campaign(f);
  const r = f.rooms.get(code),
    s = r.state;
  const a = s.armies.find((a) => a.house === "auremarch-0"),
    b = s.armies.find((a) => a.house === "high-cairn-0");
  a.garrison = false;
  b.garrison = false;
  s.armies = [a, b];
  s.wars = ["auremarch|high-cairn"];
  const battle = makeBattle(s, a, b, a.hex);
  startCombat(battle);
  s.battles = [battle];
  const command = (army, order, round = 1) => ({
    type: "battlePlan",
    battle: battle.id,
    army: army.id,
    round,
    plan: defaultPlan(order),
  });
  const first = await f.request(A, {
    type: "command",
    code,
    seq: 1,
    command: command(a, "hold"),
  });
  assert.equal(first.status, 200);
  assert.ok(first.room.state.battles[0].rounds.plans[a.id]);
  const guest = await f.request(B, { type: "snapshot", code });
  assert.deepEqual(guest.room.state.battles[0].rounds.plans, {});
  assert.equal(guest.room.state.battles[0].rounds.round, 1);
  assert.equal(
    (
      await f.request(B, {
        type: "command",
        code,
        seq: 1,
        command: command(a, "advance"),
      })
    ).status,
    400,
  );
  const next = await f.request(B, {
    type: "command",
    code,
    seq: 1,
    command: command(b, "advance"),
  });
  assert.equal(next.status, 200);
  assert.equal(next.room.state.battles[0].rounds.round, 2);
  await f.request(A, {
    type: "command",
    code,
    seq: 2,
    command: command(a, "retreat", 2),
  });
  const end = await f.request(B, {
    type: "command",
    code,
    seq: 2,
    command: command(b, "hold", 2),
  });
  assert.equal(end.status, 200);
  assert.ok(
    end.room.state.battleReports[0].sides.some((side) => side.wounded > 0),
  );
  const restored = await f.request(A, { type: "resume", code });
  assert.equal(restored.seq, 2);
  assert.deepEqual(
    restored.room.state.battleReports,
    end.room.state.battleReports,
  );
});
test("database leases cause bot takeover and host migration, resume reclaims the same crown and sequence", async () => {
  const f = store();
  await lobby(f);
  f.time(100000 + PRESENCE_MS + 1);
  f.leases.get(code).find((p) => p.user_id === B).last_seen = new Date(
    100000 + PRESENCE_MS,
  ).toISOString();
  const migrated = await f.request(B, { type: "snapshot", code });
  assert.equal(migrated.room.host, B);
  assert.ok(migrated.room.slots.find((s) => s.player === A).bot);
  const resume = await f.request(A, { type: "resume", code });
  assert.equal(resume.nation, "auremarch");
  assert.equal(resume.player, A);
  assert.equal(resume.room.host, B);
  assert.equal(resume.room.slots.find((s) => s.player === A).bot, false);
});
test("all-offline councils retain their campaign and do not run endless bot turns", () => {
  const r = makeCouncil(code, A, { type: "create", nation: "auremarch" }, 0);
  applyCouncilRequest(r, A, { type: "ready", ready: true }, 0);
  applyCouncilRequest(r, A, { type: "start" }, 0);
  const tick = r.state.tick;
  syncCouncil(r, [], PRESENCE_MS + 1);
  assert.equal(r.state.tick, tick);
  assert.equal(r.sessions[0].connected, false);
});

const migration = await readFile(
  new URL(
    "../supabase/migrations/20261101000000_edravane_supabase_multiplayer.sql",
    import.meta.url,
  ),
  "utf8",
);
async function database() {
  const db = new PGlite();
  await db.exec(
    `create role anon;create role authenticated;create role service_role bypassrls;create schema auth;grant usage on schema auth to anon,authenticated,service_role;create table auth.users(id uuid primary key);insert into auth.users values('${A}'),('${B}'),('${V}');create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('test.uid',true),'')::uuid$$;create function auth.role() returns text language sql stable as $$select current_setting('test.role',true)$$;`,
  );
  await db.exec(migration);
  return db;
}
async function as(db, role, user = "") {
  await db.exec(
    `reset role;select set_config('test.uid','${user}',false),set_config('test.role','${role}',false);set role ${role};`,
  );
}
async function write(db, r, expected, actor = A) {
  return (
    await db.query("select public.edravane_store_room($1,$2,$3,$4) as saved", [
      r.code,
      expected,
      JSON.stringify(r),
      actor,
    ])
  ).rows[0].saved;
}
test("actual Postgres RLS hides campaigns/plans, limits revision notifications to members, and forbids browser writes", async () => {
  const db = await database();
  try {
    const r = makeCouncil(
      code,
      A,
      { type: "create", nation: "auremarch" },
      100000,
    );
    await as(db, "service_role");
    assert.equal(await write(db, r, -1), true);
    await as(db, "anon");
    await assert.rejects(
      db.query("select * from edravane_rooms"),
      /permission denied/,
    );
    await assert.rejects(
      db.query("select * from edravane_room_events"),
      /permission denied/,
    );
    await as(db, "authenticated", A);
    await assert.rejects(
      db.query("select * from edravane_rooms"),
      /permission denied/,
    );
    assert.equal(
      (await db.query("select * from edravane_room_events")).rows.length,
      1,
    );
    await assert.rejects(write(db, r, 0), /permission denied/);
    await assert.rejects(
      db.query("update edravane_members set active=false"),
      /permission denied/,
    );
    await as(db, "authenticated", V);
    assert.equal(
      (await db.query("select * from edravane_members")).rows.length,
      0,
    );
    assert.equal(
      (await db.query("select * from edravane_room_events")).rows.length,
      0,
    );
    await assert.rejects(
      db.query("select edravane_heartbeat($1)", [code]),
      /Reconnect/,
    );
  } finally {
    await db.close();
  }
});
test("actual Postgres CAS atomically saves state and revisions; heartbeat cannot keep another player connected", async () => {
  const db = await database();
  try {
    const r = makeCouncil(
      code,
      A,
      { type: "create", nation: "auremarch" },
      100000,
    );
    applyCouncilRequest(r, B, { type: "join", nation: "high-cairn" }, 100000);
    await as(db, "service_role");
    assert.equal(await write(db, r, -1), true);
    r.version = 1;
    assert.equal(await write(db, r, 0, B), true);
    assert.equal(await write(db, r, 0, A), false);
    assert.equal(
      (await db.query("select version from edravane_room_events")).rows[0]
        .version,
      1,
    );
    await db.query(
      "update edravane_members set last_seen=now()-interval '120 seconds' where user_id=$1",
      [A],
    );
    await as(db, "authenticated", B);
    const heartbeat = (
      await db.query("select edravane_heartbeat($1) as pulse", [code])
    ).rows[0].pulse;
    assert.equal(heartbeat.needs_sync, true);
    assert.equal(heartbeat.version, 1);
    await as(db, "service_role");
    const before = (
      await db.query(
        "select last_seen from edravane_members where user_id=$1",
        [A],
      )
    ).rows[0].last_seen;
    r.version = 2;
    assert.equal(await write(db, r, 1, B), true);
    const after = (
      await db.query(
        "select last_seen from edravane_members where user_id=$1",
        [A],
      )
    ).rows[0].last_seen;
    assert.deepEqual(after, before);
  } finally {
    await db.close();
  }
});
