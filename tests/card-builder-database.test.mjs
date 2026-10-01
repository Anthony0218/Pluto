import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
let PGlite;
try { ({ PGlite } = await import(process.env.PGLITE_MODULE || "@electric-sql/pglite")); } catch { /* Optional local PostgreSQL harness. */ }

const alice = "00000000-0000-0000-0000-00000000000a";
const bob = "00000000-0000-0000-0000-00000000000b";
const definition = (name) => JSON.stringify({ schemaVersion: 1, id: "x", name, rules: [] });

async function setup() {
  const db = new PGlite();
  await db.exec(`create schema auth; create role authenticated; create role anon;
  create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('test.user_id',true),'')::uuid $$;
  create table auth.users(id uuid primary key);
  grant usage on schema auth to authenticated, anon; grant execute on function auth.uid() to authenticated, anon;
  insert into auth.users values ('${alice}'), ('${bob}');`);
  await db.exec(await fs.readFile(new URL("../supabase/migrations/20261006000000_card_builder.sql", import.meta.url), "utf8"));
  await db.exec(await fs.readFile(new URL("../supabase/migrations/20261007000000_card_builder_rooms.sql", import.meta.url), "utf8"));
  const as = async (user, role = "authenticated") => {
    await db.exec("reset role");
    await db.query("select set_config('test.user_id',$1,false)", [user ?? ""]);
    await db.exec(`set role ${role}`);
  };
  /** The edge function writes with the service role (a superuser here). */
  const service = async () => db.exec("reset role");
  return { db, as, service };
}

async function seedGame(db, owner, visibility = "private") {
  const game = (await db.query("insert into card_games(owner_id, name, slug, visibility) values ($1, 'Durak 6–A', 'durak-6-a', $2) returning id", [owner, visibility])).rows[0].id;
  const v1 = (await db.query("insert into card_game_versions(game_id, version, definition_json) values ($1, 1, $2::jsonb) returning id", [game, definition("v1")])).rows[0].id;
  return { game, v1 };
}

test("published versions are immutable and edits need a new version", { skip: !PGlite }, async () => {
  const { db, service } = await setup();
  await service();
  const { game, v1 } = await seedGame(db, alice);
  await db.query("update card_game_versions set definition_json = $2::jsonb where id = $1", [v1, definition("v1 edited")]);
  await db.query("update card_game_versions set status = 'published', published_at = now() where id = $1", [v1]);
  await assert.rejects(db.query("update card_game_versions set definition_json = $2::jsonb where id = $1", [v1, definition("tampered")]), /immutable/);
  await assert.rejects(db.query("update card_game_versions set status = 'draft', published_at = null where id = $1", [v1]), /immutable/);
  await assert.rejects(db.query("delete from card_game_versions where id = $1", [v1]), /cannot be deleted/);

  await db.query("insert into card_game_versions(game_id, version, definition_json) values ($1, 2, $2::jsonb)", [game, definition("v2")]);
  await assert.rejects(db.query("insert into card_game_versions(game_id, version, definition_json) values ($1, 3, $2::jsonb)", [game, definition("v3")]), /duplicate key/, "only one open draft per game");
  await assert.rejects(db.query("insert into card_game_versions(game_id, version, definition_json, status, published_at) values ($1, 2, $2::jsonb, 'published', now())", [game, definition("dup")]), /duplicate key/);
  const rows = (await db.query("select version, status, definition_json->>'name' as name from card_game_versions order by version")).rows;
  assert.deepEqual(rows, [
    { version: 1, status: "published", name: "v1 edited" },
    { version: 2, status: "draft", name: "v2" },
  ]);
  await assert.rejects(db.query("insert into card_game_versions(game_id, version, definition_json) values ($1, 9, '[]'::jsonb)", [game]), /check constraint/);
  await db.query("delete from card_games where id = $1", [game]);
  assert.equal((await db.query("select count(*)::int as n from card_game_versions")).rows[0].n, 0, "deleting the whole game removes its versions");
});

test("sessions reference one published version and cannot switch", { skip: !PGlite }, async () => {
  const { db, service } = await setup();
  await service();
  const { game, v1 } = await seedGame(db, alice);
  await assert.rejects(db.query("insert into card_game_sessions(game_version_id, state_json) values ($1, '{}'::jsonb)", [v1]), /published game version/);
  await db.query("update card_game_versions set status = 'published', published_at = now() where id = $1", [v1]);
  const session = (await db.query("insert into card_game_sessions(game_version_id, created_by, state_json, status) values ($1, $2, '{\"revision\":0}'::jsonb, 'playing') returning id", [v1, alice])).rows[0].id;
  await db.query("insert into card_game_players(session_id, user_id, seat) values ($1, $2, 0), ($1, null, 1)", [session, alice]);
  const v2 = (await db.query("insert into card_game_versions(game_id, version, definition_json, status, published_at) values ($1, 2, $2::jsonb, 'published', now()) returning id", [game, definition("v2")])).rows[0].id;
  await assert.rejects(db.query("update card_game_sessions set game_version_id = $2 where id = $1", [session, v2]), /cannot switch/);
  await db.query("update card_game_sessions set state_json = '{\"revision\":1}'::jsonb, revision = 1 where id = $1", [session]);
  await assert.rejects(db.query("insert into card_game_players(session_id, user_id, seat) values ($1, $2, 0)", [session, bob]), /duplicate key/);
});

test("players read their own and public games; all writes are server-only", { skip: !PGlite }, async () => {
  const { db, as, service } = await setup();
  await service();
  const own = await seedGame(db, alice);
  const shared = await seedGame(db, bob, "public");
  await db.query("update card_game_versions set status = 'published', published_at = now() where id = $1", [shared.v1]);
  const session = (await db.query("insert into card_game_sessions(game_version_id, state_json) values ($1, '{\"secret\":\"cards\"}'::jsonb) returning id", [shared.v1])).rows[0].id;
  await db.query("insert into card_game_players(session_id, user_id, seat) values ($1, $2, 0)", [session, alice]);

  await as(alice);
  assert.equal((await db.query("select count(*)::int as n from card_games")).rows[0].n, 2, "own private + Bob's public");
  assert.equal((await db.query("select count(*)::int as n from card_game_versions")).rows[0].n, 2, "own draft + Bob's published version");
  assert.equal((await db.query("select count(*)::int as n from card_game_players")).rows[0].n, 1);
  await assert.rejects(db.query("select * from card_game_sessions"), /permission denied/, "raw state (hidden cards) is never readable");
  await assert.rejects(db.query("insert into card_games(owner_id, name, slug) values ($1, 'x', 'x')", [alice]), /permission denied/);
  await assert.rejects(db.query("update card_game_versions set definition_json = '{}'::jsonb where id = $1", [own.v1]), /permission denied/);

  await as(bob);
  assert.equal((await db.query("select count(*)::int as n from card_games")).rows[0].n, 1, "Bob cannot see Alice's private game");
  assert.equal((await db.query("select count(*)::int as n from card_game_versions where game_id = $1", [own.game])).rows[0].n, 0);

  await as(null, "anon");
  assert.equal((await db.query("select count(*)::int as n from card_games")).rows[0].n, 1, "visitors browse public games");
});

test("rooms have unique share codes and named seats", { skip: !PGlite }, async () => {
  const { db, as, service } = await setup();
  await service();
  const { v1 } = await seedGame(db, alice);
  await db.query("update card_game_versions set status = 'published', published_at = now() where id = $1", [v1]);
  const room = (await db.query("insert into card_game_sessions(game_version_id, created_by, code, state_json) values ($1, $2, 'ABC234', '{\"room\":{}}'::jsonb) returning id, status", [v1, alice])).rows[0];
  assert.equal(room.status, "waiting");
  await assert.rejects(db.query("insert into card_game_sessions(game_version_id, code, state_json) values ($1, 'ABC234', '{}'::jsonb)", [v1]), /duplicate key/);
  await assert.rejects(db.query("insert into card_game_sessions(game_version_id, code, state_json) values ($1, 'abc234', '{}'::jsonb)", [v1]), /check constraint/);
  await db.query("insert into card_game_sessions(game_version_id, state_json) values ($1, '{}'::jsonb)", [v1]);
  await db.query("insert into card_game_sessions(game_version_id, state_json) values ($1, '{}'::jsonb)", [v1]);

  await db.query("insert into card_game_players(session_id, user_id, seat, name) values ($1, $2, 0, 'Alice'), ($1, $3, 1, 'Bob'), ($1, null, 2, 'Bot 1')", [room.id, alice, bob]);
  await assert.rejects(db.query("insert into card_game_players(session_id, user_id, seat, name) values ($1, null, 3, '  ')", [room.id]), /check constraint/);
  await db.query("delete from card_game_sessions where id = $1", [room.id]);
  assert.equal((await db.query("select count(*)::int as n from card_game_players")).rows[0].n, 0, "closing a room frees its seats");

  await as(alice);
  await assert.rejects(db.query("update card_game_players set name = 'x'"), /permission denied/);
});
