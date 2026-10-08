import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import { PGlite } from "@electric-sql/pglite";

const alice = "00000000-0000-0000-0000-000000000001";
const bob = "00000000-0000-0000-0000-000000000002";
const group = "00000000-0000-0000-0000-0000000000aa";

// Stubs of the tables the migration reads; the real ones live in earlier migrations and the live database.
const stubs = `
  create schema auth; create role authenticated; create role anon;
  create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('test.user_id', true), '')::uuid $$;
  grant usage on schema auth to authenticated;
  create table public.profiles(id uuid primary key, display_name text, username text, avatar_id text);
  create table public.community_group_members(group_id uuid, user_id uuid);
  create table public.community_game_invites(
    id uuid primary key default gen_random_uuid(), group_id uuid not null, sender_id uuid not null,
    game text not null check (game in ('chess','go','shogi')), mode text not null check (mode = 'casual'),
    room_code text not null check (room_code ~ '^[A-Z0-9]{6}$'), created_at timestamptz not null default now(),
    expires_at timestamptz not null default now() + interval '1 day', unique (group_id, game, room_code));
  create table public.chess_rooms(id uuid primary key default gen_random_uuid(), code text, status text);
  create table public.chess_room_players(room_id uuid, user_id uuid);
  create table public.strategy_matches(id uuid primary key default gen_random_uuid(), room_code text, game_type text, players jsonb, game_state jsonb);
  create table public.schafkopf_rooms(code text, players jsonb, game jsonb);
  create table public.atlas_matches(room_code text, players jsonb, status text, settings jsonb);
  create table public.eat_it_matches(room_code text, players jsonb, status text, settings jsonb);
  create table public.chess_custom_matches(code text, guest_id uuid, status text);
  create table public.variant_rooms(id uuid primary key default gen_random_uuid(), code text, variant text, status text);
  create table public.variant_room_players(room_id uuid, user_id uuid);
  create table public.stub_lobbies(code text, route text);
  create function public.resolve_game_invite(p_code text) returns table(game_route text, mode text) language sql as $$
    select route, 'x' from public.stub_lobbies where code = upper(p_code) $$;
`;

async function setup() {
  const db = new PGlite();
  await db.exec(stubs);
  await db.query("insert into community_group_members values ($1, $2)", [group, alice]);
  await db.exec(await fs.readFile(new URL("../supabase/migrations/20261031000000_clan_share_all_games.sql", import.meta.url), "utf8"));
  await db.query("select set_config('test.user_id', $1, false)", [alice]);
  return db;
}
const lobby = (db, code, route) => db.query("insert into stub_lobbies values ($1, $2)", [code, route]);
const share = (db, game, route, code, as = alice) => db.query("select set_config('test.user_id', $1, false)", [as]).then(() => db.query("select public.share_community_game_room($1, $2, $3, $4) as id", [group, game, route, code]));
const invites = async db => (await db.query("select public.get_community_game_invites($1) as list", [group])).rows[0].list;

test("a clan can share lobbies of every multiplayer game, and the card reports whether a seat is left", async () => {
  const db = await setup();
  try {
    // Atlas Arena: two seats by default, more when the host raised it.
    await db.query("insert into atlas_matches values ('ATLAS1', '[{}]', 'waiting', '{}'), ('ATLAS2', '[{},{}]', 'waiting', '{\"maxPlayers\":4}'), ('ATLAS3', '[{},{}]', 'waiting', '{}'), ('ATLAS4', '[{}]', 'round_active', '{}')");
    for (const code of ["ATLAS1", "ATLAS2", "ATLAS3", "ATLAS4"]) await lobby(db, code, "/games/atlas-arena/multiplayer");
    for (const code of ["ATLAS1", "ATLAS2"]) await share(db, "atlas-arena", "/games/atlas-arena/multiplayer", code);
    // A lobby that is already full or already started cannot be shared at all.
    for (const code of ["ATLAS3", "ATLAS4"]) await assert.rejects(share(db, "atlas-arena", "/games/atlas-arena/multiplayer", code), /unavailable/);
    assert.deepEqual(Object.fromEntries((await invites(db)).map(item => [item.room_code, item.status])), { ATLAS1: "open", ATLAS2: "open" });
    // Once the second player sits down the shared card turns into "full".
    await db.query("update atlas_matches set players = '[{},{}]' where room_code = 'ATLAS1'");
    assert.deepEqual(Object.fromEntries((await invites(db)).map(item => [item.room_code, item.status])), { ATLAS1: "full", ATLAS2: "open" });

    // Eat It: as many seats as the room's count; a started game is closed.
    await db.query("insert into eat_it_matches values ('EAT001', '[{},{}]', 'waiting', '{\"count\":3}'), ('EAT002', '[{},{}]', 'waiting', '{\"count\":2}')");
    await lobby(db, "EAT001", "/games/eat-it/multiplayer"); await lobby(db, "EAT002", "/games/eat-it/multiplayer");
    await share(db, "eat-it", "/games/eat-it/multiplayer", "EAT001");
    await assert.rejects(share(db, "eat-it", "/games/eat-it/multiplayer", "EAT002"), /unavailable/);
    await db.query("update eat_it_matches set status = 'playing' where room_code = 'EAT001'");
    await db.query("update eat_it_matches set status = 'finished' where room_code = 'EAT001'");
    assert.equal((await invites(db)).find(item => item.room_code === "EAT001").status, "ended");

    // Schafkopf: four seats.
    await db.query("insert into schafkopf_rooms values ('SCH001', '[{},{},{}]', null), ('SCH002', '[{},{},{},{}]', null)");
    await lobby(db, "SCH001", "/games/schafkopf/multiplayer"); await lobby(db, "SCH002", "/games/schafkopf/multiplayer");
    await share(db, "schafkopf", "/games/schafkopf/multiplayer", "SCH001");
    await assert.rejects(share(db, "schafkopf", "/games/schafkopf/multiplayer", "SCH002"), /unavailable/);
    await db.query("update schafkopf_rooms set players = '[{},{},{},{}]' where code = 'SCH001'");
    assert.equal((await invites(db)).find(item => item.room_code === "SCH001").status, "full");

    // Custom chess and chess variants (two seats, four for four-player chess).
    await db.query("insert into chess_custom_matches values ('CUS001', null, 'waiting')");
    await lobby(db, "CUS001", "/chess-custom/play/multiplayer");
    await share(db, "chess-custom", "/chess-custom/play/multiplayer", "CUS001");
    await db.query("update chess_custom_matches set guest_id = $1", [bob]);
    assert.equal((await invites(db)).find(item => item.room_code === "CUS001").status, "full");
    const fourId = (await db.query("insert into variant_rooms(code, variant, status) values ('VAR004', 'four-player', 'waiting') returning id")).rows[0].id;
    await db.query("insert into variant_room_players values ($1, $2), ($1, $2), ($1, $2)", [fourId, alice]);
    await lobby(db, "VAR004", "/games/chess/variants/4-players/multiplayer");
    await share(db, "chess-variant", "/games/chess/variants/4-players/multiplayer", "VAR004");
    assert.equal((await invites(db)).find(item => item.room_code === "VAR004").status, "open");
    await db.query("insert into variant_room_players values ($1, $2)", [fourId, alice]);
    assert.equal((await invites(db)).find(item => item.room_code === "VAR004").status, "full");

    // Watten and Pluto Party rooms are not readable here, so the lobby itself refuses a full table.
    await lobby(db, "WAT001", "/games/watten/multiplayer/4");
    await share(db, "watten", "/games/watten/multiplayer/4", "WAT001");
    await share(db, "pluto-party", "/games/pluto-party", "PAR001");
    const list = await invites(db);
    assert.equal(list.find(item => item.room_code === "WAT001").game_route, "/games/watten/multiplayer/4");
    assert.equal(list.find(item => item.room_code === "PAR001").status, "open");
  } finally { await db.close(); }
});

test("sharing is limited to members, to a code that exists for that game, and to supported routes", async () => {
  const db = await setup();
  try {
    await db.query("insert into schafkopf_rooms values ('SCH001', '[{}]', null)");
    await lobby(db, "SCH001", "/games/schafkopf/multiplayer");
    await assert.rejects(share(db, "schafkopf", "/games/schafkopf/multiplayer", "SCH001", bob), /Join this group first/);
    await assert.rejects(share(db, "schafkopf", "/games/schafkopf/multiplayer", "NOROOM"), /unavailable/);
    await assert.rejects(share(db, "schafkopf", "/games/go/multiplayer", "SCH001"), /Unsupported game/);
    await assert.rejects(share(db, "watten", "/games/watten/multiplayer/5", "SCH001"), /Unsupported game/);
    await assert.rejects(share(db, "schafkopf", "/games/schafkopf/multiplayer", "bad"), /six-character/);
    // The same lobby stays one card; re-sharing refreshes it.
    await share(db, "schafkopf", "/games/schafkopf/multiplayer", "SCH001");
    await share(db, "schafkopf", "/games/schafkopf/multiplayer", "sch001");
    assert.equal((await invites(db)).length, 1);
    // Older chess and Go invites keep their own status rules.
    await db.query("insert into chess_rooms(code, status) values ('CHE001', 'waiting')");
    await db.query("insert into community_game_invites(group_id, sender_id, game, mode, room_code) values ($1, $2, 'chess', 'casual', 'CHE001')", [group, alice]);
    assert.equal((await invites(db)).find(item => item.room_code === "CHE001").status, "open");
    await db.query("update community_game_invites set expires_at = now() - interval '1 minute' where room_code = 'SCH001'");
    assert.equal((await invites(db)).find(item => item.room_code === "SCH001").status, "ended");
  } finally { await db.close(); }
});

test("casual clan invites accept Pluto codes and honor Card Builder and four-team custom chess capacity", async () => {
  const db = await setup();
  try {
    await db.exec(`alter table chess_custom_matches add column player_ids uuid[] default '{}'::uuid[], add column variant jsonb;
      create table card_game_sessions(id uuid primary key default gen_random_uuid(), code text, status text, state_json jsonb);
      create table card_game_players(session_id uuid, user_id uuid, status text);`);
    await db.exec(await fs.readFile(new URL("../supabase/migrations/20261107000000_complete_casual_clan_invites.sql", import.meta.url), "utf8"));
    await share(db, "pluto-party", "/games/pluto-party", "pluto-123456");
    await share(db, "pluto-party", "/games/pluto-party", "123456");
    assert.equal((await invites(db)).filter(item => item.game === "pluto-party").length, 1);
    assert.equal((await invites(db))[0].room_code, "PLUTO-123456");
    await assert.rejects(share(db, "pluto-party", "/games/pluto-party", "ABC123"), /Pluto lobby code/);
    await assert.rejects(share(db, "card-builder", "/games/card-builder/room", "PLUTO-123456"), /six-character/);
    await assert.rejects(share(db, "pluto-party", "/games/pluto-party", "PLUTO-654321", bob), /Join this group/);

    const session = (await db.query(`insert into card_game_sessions(code,status,state_json) values ('CAR001','waiting','{"room":{"capacity":3}}') returning id`)).rows[0].id;
    await db.query("insert into card_game_players values ($1,$2,'active')", [session, alice]);
    await lobby(db, "CAR001", "/games/card-builder/room");
    await share(db, "card-builder", "/games/card-builder/room", "CAR001");
    assert.equal((await invites(db)).find(item => item.game === "card-builder").status, "open");
    await db.query("insert into card_game_players values ($1,$2,'left')", [session, bob]);
    assert.equal((await invites(db)).find(item => item.game === "card-builder").status, "open");
    await db.query("insert into card_game_players values ($1,$2,'active'),($1,$2,'active')", [session, bob]);
    assert.equal((await invites(db)).find(item => item.game === "card-builder").status, "full");
    await assert.rejects(share(db, "card-builder", "/games/card-builder/room", "CAR001"), /unavailable/);
    await db.query("update card_game_sessions set status='finished'");
    assert.equal((await invites(db)).find(item => item.game === "card-builder").status, "ended");

    await db.query(`insert into chess_custom_matches(code,status,player_ids,variant) values ('CUS004','waiting',array[$1::uuid,$2::uuid],'{"teams":[{},{},{},{}]}')`, [alice, bob]);
    await lobby(db, "CUS004", "/chess-custom/play/multiplayer");
    await share(db, "chess-custom", "/chess-custom/play/multiplayer", "CUS004");
    assert.equal((await invites(db)).find(item => item.room_code === "CUS004").status, "open");
    await db.query("update chess_custom_matches set player_ids=array[$1::uuid,$2::uuid,$1::uuid,$2::uuid]", [alice,bob]);
    assert.equal((await invites(db)).find(item => item.room_code === "CUS004").status, "full");
  } finally { await db.close(); }
});
