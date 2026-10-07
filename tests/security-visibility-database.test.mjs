import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
let PGlite;
try { ({ PGlite } = await import(process.env.PGLITE_MODULE || '@electric-sql/pglite')); } catch { /* Optional local PostgreSQL harness. */ }

const alice = '00000000-0000-0000-0000-0000000000a1';
const bob = '00000000-0000-0000-0000-0000000000b2';
const carol = '00000000-0000-0000-0000-0000000000c3';
const dave = '00000000-0000-0000-0000-0000000000d4';
const bobRoom = '00000000-0000-0000-0000-000000000111';
const privateRoom = '00000000-0000-0000-0000-000000000222';
const migration = (file) => fs.readFile(new URL(`../supabase/migrations/${file}`, import.meta.url), 'utf8');

/** The schema as it is live before this migration; `harden` applies the migration under test. */
async function setup(harden = true) {
  const db = new PGlite();
  await db.exec(`create schema auth; create role authenticated; create role anon;
    create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('test.user_id', true), '')::uuid $$;
    create table auth.users(id uuid primary key);
    grant usage on schema auth to authenticated; grant execute on function auth.uid() to authenticated;
    grant usage on schema public to authenticated;
    create publication supabase_realtime;
    create table public.profiles(id uuid primary key, username text, display_name text, avatar_url text,
      avatar_id text check (avatar_id in ('m1', 'm2', 'f1')));
    create table public.friendships(user_a uuid, user_b uuid);
    create table public.chess_rooms(id uuid primary key, code text, host_id uuid, status text, match_kind text, time_control text);
    create table public.chess_room_players(room_id uuid, user_id uuid, seat int, display_name text, chosen_color text);
    create table public.chess_games(room_id uuid primary key, fen text, moves text[] default '{}', status text, winner text, end_reason text,
      last_move_from text, last_move_to text, white_time_ms int, black_time_ms int, clock_started_at timestamptz);
    create table public.chess_ratings(user_id uuid, time_control text, rating int, rated_games int);
    create table public.user_game_results(game text, source_id text, user_id uuid, outcome text, multiplayer boolean, completed_at timestamptz default now());
    create table public.user_presence(user_id uuid primary key references auth.users(id), last_seen_at timestamptz not null default now());
    alter table public.user_presence enable row level security;
    create policy "Read own and friends presence" on public.user_presence for select to authenticated using (true);
    create table public.online_games(id uuid primary key default gen_random_uuid(), white_player uuid, black_player uuid, fen text, status text default 'active', winner uuid);
    alter table public.online_games enable row level security;
    create policy "Authenticated users can create online games" on public.online_games for insert to authenticated with check (auth.uid() = white_player or auth.uid() = black_player);
    create policy "Players can view their online games" on public.online_games for select to authenticated using (auth.uid() = white_player or auth.uid() = black_player);
    create policy "Players can update their online games" on public.online_games for update to authenticated using (auth.uid() = white_player or auth.uid() = black_player);
    grant select on all tables in schema public to authenticated;
    grant insert, update, delete on public.online_games to authenticated;
    insert into auth.users values ('${alice}'), ('${bob}'), ('${carol}'), ('${dave}');
    insert into public.profiles(id, username, avatar_id) values ('${alice}', 'Alice', 'm1'), ('${bob}', 'Bob', 'm2'), ('${carol}', 'Carol', 'f1'), ('${dave}', 'Dave', 'm1');
    insert into public.friendships values ('${alice}', '${bob}');
    insert into public.chess_rooms values ('${bobRoom}', 'ABC123', '${bob}', 'playing', 'casual', 'rapid'), ('${privateRoom}', 'SECRET', '${carol}', 'playing', 'casual', 'rapid');
    insert into public.chess_room_players values ('${bobRoom}', '${bob}', 0, 'Bob', 'white'), ('${bobRoom}', '${carol}', 1, 'Carol', 'black'),
      ('${privateRoom}', '${carol}', 0, 'Carol', 'white'), ('${privateRoom}', '${dave}', 1, 'Dave', 'black');
    insert into public.chess_games(room_id, fen, status) values ('${bobRoom}', 'bob-fen', 'playing'), ('${privateRoom}', 'private-fen', 'playing');
    insert into public.online_games(white_player, black_player, fen) values ('${alice}', '${bob}', 'start');`);
  await db.exec(await migration('20260928100000_groups.sql'));
  await db.exec(await migration('20261014000000_social_profiles_clans.sql'));
  if (harden) await db.exec(await migration('20261102000000_security_hardening_visibility.sql'));
  return db;
}

const as = (db, id) => db.query("select set_config('test.user_id', $1, false)", [id]);
const one = async (db, sql, params = []) => (await db.query(sql, params)).rows[0];
const game = (code) => `/games/chess/classic/multiplayer/${code}/game`;

/** Bob points his presence at `code`, his friend Alice asks to watch, Bob accepts. */
async function spectate(db, code) {
  await as(db, bob);
  await db.query(`select public.update_presence('Chess', 'Multiplayer', $1)`, [game(code)]);
  await as(db, alice);
  const { request_spectate: id } = await one(db, `select public.request_spectate($1)`, [bob]);
  await as(db, bob);
  await db.query(`select public.respond_spectate_request($1, true)`, [id]);
  await as(db, alice);
  return id;
}

test('before hardening a spectate request could be pointed at somebody else\'s game', { skip: !PGlite }, async () => {
  const db = await setup(false);
  const id = await spectate(db, 'SECRET');
  assert.equal((await one(db, `select public.get_spectate_snapshot($1) as s`, [id])).s.game.fen, 'private-fen');
});

test('spectating only ever shows a game the spectated friend is seated in', { skip: !PGlite }, async () => {
  const db = await setup();
  await assert.rejects(spectate(db, 'SECRET'), /Open your game first/);
  await assert.rejects(spectate(db, 'NOROOM'), /Open your game first/);
  assert.equal((await one(db, `select count(*)::int as n from public.spectate_requests where status = 'accepted'`)).n, 0);

  const id = await spectate(db, 'ABC123');
  const snapshot = (await one(db, `select public.get_spectate_snapshot($1) as s`, [id])).s;
  assert.equal(snapshot.game.fen, 'bob-fen');
  assert.deepEqual(snapshot.players.map((player) => player.display_name), ['Bob', 'Carol']);

  // A request accepted earlier stops working once the friend has left that room.
  await db.query(`delete from public.chess_room_players where room_id = $1 and user_id = $2`, [bobRoom, bob]);
  await assert.rejects(db.query(`select public.get_spectate_snapshot($1)`, [id]), /The game has ended/);
});

test('clan member lists are visible to that clan\'s members only', { skip: !PGlite }, async () => {
  for (const harden of [false, true]) {
    const db = await setup(harden);
    await as(db, alice);
    const { create_community_group: clan } = await one(db, `select public.create_community_group('Knights', '', 'chess-king')`);
    const { invite_code: code } = await one(db, `select invite_code from public.community_groups where id = $1`, [clan]);
    await as(db, bob);
    await db.query(`select public.join_community_group($1)`, [code]);
    await as(db, carol);
    const { create_community_group: other } = await one(db, `select public.create_community_group('Bishops', '', 'chess-queen')`);

    await db.exec('set role authenticated');
    const members = async (id) => { await as(db, id); return (await db.query(`select user_id from public.community_group_members where group_id = $1 order by user_id`, [clan])).rows.map((row) => row.user_id); };
    assert.deepEqual(await members(alice), [alice, bob]);
    assert.deepEqual(await members(bob), [alice, bob]);
    assert.deepEqual(await members(dave), harden ? [] : [alice, bob], 'a player in no clan');
    assert.deepEqual(await members(carol), harden ? [] : [alice, bob], 'a player in another clan');
    // The policies that look memberships up still resolve for members, and only for them.
    await as(db, bob);
    assert.deepEqual((await db.query(`select name from public.community_groups`)).rows, [{ name: 'Knights' }]);
    await as(db, carol);
    assert.deepEqual((await db.query(`select id from public.community_groups`)).rows, [{ id: other }]);
    assert.deepEqual((await db.query(`select group_id from public.community_group_members where user_id = $1`, [carol])).rows, [{ group_id: other }]);
    await db.exec('reset role');
    await db.close();
  }
});

test('legacy online games are read-only for their two players', { skip: !PGlite }, async () => {
  const before = await setup(false);
  await before.exec('set role authenticated');
  await as(before, carol);
  assert.equal((await before.query(`insert into public.online_games(white_player, black_player) values ($1, $2) returning id`, [carol, dave])).rows.length, 1, 'a game naming a player who never agreed');
  await as(before, bob);
  assert.equal((await before.query(`update public.online_games set winner = $1 where white_player = $2 returning id`, [bob, alice])).rows.length, 1);

  const db = await setup();
  await db.exec('set role authenticated');
  await as(db, carol);
  await assert.rejects(db.query(`insert into public.online_games(white_player, black_player) values ($1, $2)`, [carol, dave]), /permission denied/);
  assert.equal((await db.query(`select * from public.online_games`)).rows.length, 0);
  await as(db, bob);
  await assert.rejects(db.query(`update public.online_games set winner = $1`, [bob]), /permission denied/);
  await assert.rejects(db.query(`delete from public.online_games`), /permission denied/);
  assert.equal((await one(db, `select fen from public.online_games`)).fen, 'start');
});
