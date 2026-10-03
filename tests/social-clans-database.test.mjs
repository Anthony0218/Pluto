import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
let PGlite;
try { ({ PGlite } = await import(process.env.PGLITE_MODULE || '@electric-sql/pglite')); } catch { /* Optional local PostgreSQL harness. */ }

const alice = '00000000-0000-0000-0000-0000000000a1';
const bob = '00000000-0000-0000-0000-0000000000b2';
const carol = '00000000-0000-0000-0000-0000000000c3';
const room = '00000000-0000-0000-0000-000000000111';
const migration = (file) => fs.readFile(new URL(`../supabase/migrations/${file}`, import.meta.url), 'utf8');

async function setup() {
  const db = new PGlite();
  // Minimal stand-ins for tables that predate the migrations folder.
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
    grant select on all tables in schema public to authenticated;
    insert into auth.users values ('${alice}'), ('${bob}'), ('${carol}');
    insert into public.profiles(id, username, display_name, avatar_id) values ('${alice}', 'Alice', null, 'm1'), ('${bob}', 'Yannick', 'Yanni', 'm2'), ('${carol}', 'Carol', null, 'f1');
    insert into public.friendships values ('${alice}', '${bob}');`);
  await db.exec(await migration('20260928100000_groups.sql'));
  await db.exec(await migration('20261014000000_social_profiles_clans.sql'));
  return db;
}

const as = (db, id) => db.query("select set_config('test.user_id', $1, false)", [id]);
const one = async (db, sql, params = []) => (await db.query(sql, params)).rows[0];

test('pixel avatars replace the preset-only avatar check', { skip: !PGlite }, async () => {
  const db = await setup();
  await db.query(`update public.profiles set avatar_id = $1 where id = $2`, [`px1:${'0c'.repeat(128)}`, alice]);
  await db.query(`update public.profiles set avatar_id = 'chess-fox' where id = $1`, [alice]);
  await assert.rejects(db.query(`update public.profiles set avatar_id = 'px1:zz' where id = $1`, [alice]));
  await assert.rejects(db.query(`update public.profiles set avatar_id = '<script>' where id = $1`, [alice]));
});

test('friends see game and mode, never the room; spectating needs the player to accept', { skip: !PGlite }, async () => {
  const db = await setup();
  await db.query(`insert into public.chess_rooms values ($1, 'ABC123', $2, 'playing', 'casual', 'rapid')`, [room, bob]);
  await db.query(`insert into public.chess_room_players values ($1, $2, 0, 'Yanni', 'white'), ($1, $3, 1, 'Carol', 'black')`, [room, bob, carol]);
  await db.query(`insert into public.chess_games(room_id, fen, moves, status, last_move_from, last_move_to) values ($1, 'fen-after-e4', '{e4}', 'playing', 'e2', 'e4')`, [room]);

  await as(db, bob);
  await db.query(`select public.update_presence('Chess', 'Multiplayer', '/games/chess/classic/multiplayer/ABC123/game')`);
  const row = await one(db, `select activity_game, activity_mode, spectatable from public.user_presence where user_id = $1`, [bob]);
  assert.deepEqual(row, { activity_game: 'Chess', activity_mode: 'Multiplayer', spectatable: true });

  // The route is not readable by other players.
  await db.exec('set role authenticated');
  await as(db, alice);
  await db.query(`select user_id, last_seen_at, activity_game, activity_mode, spectatable from public.user_presence`);
  await assert.rejects(db.query(`select activity_route from public.user_presence`), /permission denied/);
  await db.exec('reset role');

  // Lobby pages are not spectatable; only six-character room codes are.
  await as(db, carol);
  await db.query(`select public.update_presence('Chess', 'Multiplayer', '/games/chess/classic/multiplayer/friends')`);
  assert.equal((await one(db, `select spectatable from public.user_presence where user_id = $1`, [carol])).spectatable, false);

  // Only friends can ask.
  await assert.rejects(db.query(`select public.request_spectate($1)`, [bob]), /only spectate friends/);
  await as(db, alice);
  const { request_spectate: requestId } = await one(db, `select public.request_spectate($1)`, [bob]);
  const again = await one(db, `select public.request_spectate($1)`, [bob]);
  assert.equal(again.request_spectate, requestId, 'a repeated request refreshes the pending one');
  await assert.rejects(db.query(`select public.get_spectate_snapshot($1)`, [requestId]), /not available/);
  await assert.rejects(db.query(`select public.respond_spectate_request($1, true)`, [requestId]), /expired/, 'only the player can accept');

  await as(db, bob);
  await db.query(`select public.respond_spectate_request($1, true)`, [requestId]);
  await as(db, carol);
  await assert.rejects(db.query(`select public.get_spectate_snapshot($1)`, [requestId]), /not available/, 'others cannot use the request');
  await as(db, alice);
  const snapshot = (await one(db, `select public.get_spectate_snapshot($1) as s`, [requestId])).s;
  assert.equal(snapshot.room.code, 'ABC123');
  assert.equal(snapshot.game.fen, 'fen-after-e4');
  assert.deepEqual(snapshot.game.moves, ['e4']);
  assert.deepEqual(snapshot.players.map((player) => player.chosen_color), ['white', 'black']);
});

test('public profiles expose name, avatar, most played games and best rank only', { skip: !PGlite }, async () => {
  const db = await setup();
  await db.query(`insert into public.user_game_results(game, source_id, user_id, outcome, multiplayer) values
    ('chess', 'a', $1, 'win', true), ('chess', 'b', $1, 'loss', true), ('go', 'c', $1, 'win', true), ('watten', 'd', $1, 'win', true), ('watten', 'e', $1, 'win', true), ('watten', 'f', $1, 'draw', true), ('atlas', 'g', $1, 'win', true)`, [bob]);
  await db.query(`insert into public.chess_ratings values ($1, 'blitz', 1420, 3), ($1, 'rapid', 1510, 0)`, [bob]);
  await as(db, alice);
  const profile = (await one(db, `select public.get_public_profile($1) as p`, [bob])).p;
  assert.deepEqual(Object.keys(profile).sort(), ['avatar_id', 'chess_rating', 'display_name', 'id', 'most_played', 'username']);
  assert.deepEqual(profile.most_played, ['watten', 'chess', 'atlas']);
  assert.deepEqual(profile.chess_rating, { rating: 1420, time_control: 'blitz' }, 'unrated time controls are ignored');
  assert.equal((await one(db, `select public.find_profile_by_username('yannick') as id`)).id, bob);
  assert.equal((await one(db, `select public.find_profile_by_username('nobody') as id`)).id, null);
});

test('clan chat is members-only and rate limited', { skip: !PGlite }, async () => {
  const db = await setup();
  await as(db, alice);
  const { create_community_group: clan } = await one(db, `select public.create_community_group('Knights', '', 'chess-king')`);
  const { invite_code: code } = await one(db, `select invite_code from public.community_groups where id = $1`, [clan]);
  await as(db, carol);
  await assert.rejects(db.query(`select public.send_community_group_message($1, 'hi')`, [clan]), /Join this clan first/);
  await db.query(`select public.join_community_group($1)`, [code]);
  await db.query(`select public.send_community_group_message($1, '  hello clan  ')`, [clan]);
  assert.equal((await one(db, `select body from public.community_group_messages`)).body, 'hello clan');
  await assert.rejects(db.query(`select public.send_community_group_message($1, '   ')`, [clan]));
  for (let i = 0; i < 9; i++) await db.query(`select public.send_community_group_message($1, $2)`, [clan, `m${i}`]);
  await assert.rejects(db.query(`select public.send_community_group_message($1, 'too fast')`, [clan]), /Slow down/);

  // Row-level security: outsiders cannot read the chat.
  await db.exec('set role authenticated');
  await as(db, bob);
  assert.equal((await db.query(`select * from public.community_group_messages`)).rows.length, 0);
  await as(db, alice);
  assert.equal((await db.query(`select * from public.community_group_messages`)).rows.length, 10);
  await db.exec('reset role');

  const published = await db.query(`select tablename from pg_publication_tables where pubname = 'supabase_realtime' order by tablename`);
  assert.deepEqual(published.rows.map((row) => row.tablename), ['community_game_invites', 'community_group_messages', 'spectate_requests']);
});
