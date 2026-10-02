import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
let PGlite;
try { ({ PGlite } = await import(process.env.PGLITE_MODULE || '@electric-sql/pglite')); } catch { /* Optional local PostgreSQL harness. */ }
const host = '00000000-0000-0000-0000-000000000001', guest = '00000000-0000-0000-0000-000000000002';

async function setup() {
  const db = new PGlite();
  await db.exec(`create schema auth; create role authenticated; create role anon;
  create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('test.user_id',true),'')::uuid $$;
  create table public.chess_rooms(id uuid primary key default gen_random_uuid(),code text not null,host_id uuid not null,status text not null default 'waiting',match_kind text not null default 'casual');
  create table public.chess_room_players(room_id uuid references chess_rooms(id) on delete cascade,user_id uuid,seat smallint not null check (seat in (0,1)),
    display_name text not null,joined_at timestamptz not null default now(),chosen_color text,primary key(room_id,user_id),unique(room_id,seat));
  create table public.chess_games(room_id uuid primary key,status text);
  create table public.variant_rooms(id uuid primary key default gen_random_uuid(),code text not null,host_id uuid not null,variant text not null,
    max_players integer not null default 2,status text not null default 'waiting',created_at timestamptz not null default now(),bot_colors text[] not null default '{}');
  create table public.variant_room_players(room_id uuid references variant_rooms(id) on delete cascade,user_id uuid,seat integer not null,display_name text not null default 'Player',
    chosen_color text,joined_at timestamptz not null default now(),primary key(room_id,user_id),unique(room_id,seat));
  create table public.variant_games(room_id uuid primary key,status text,updated_at timestamptz);
  create table public.fog_multiplayer_games(room_id uuid primary key,status text,updated_at timestamptz);
  create table public.variant_draft_private(room_id uuid,user_id uuid,side text check (side in ('w','b')),placements jsonb not null default '[]',
    confirmed boolean not null default false,updated_at timestamptz default now(),primary key(room_id,user_id),unique(room_id,side));`);
  for (const file of ['20261002010000_chess_room_color_choice.sql', '20261003000000_chess_room_ready_check.sql']) {
    await db.exec(await fs.readFile(new URL('../supabase/migrations/' + file, import.meta.url), 'utf8'));
  }
  const as = (id) => db.query("select set_config('test.user_id',$1,false)", [id]);
  return { db, as };
}

test('classic rooms: default colors, ready gate and seat assignment on start', { skip: !PGlite }, async () => {
  const { db, as } = await setup();
  await as(host);
  const code = (await db.query("select create_chess_room('Host') as code")).rows[0].code;
  await as(guest);
  await db.query("select join_chess_room($1,'Guest')", [code]);
  const room = (await db.query('select * from chess_rooms')).rows[0];
  const players = async () => Object.fromEntries((await db.query('select * from chess_room_players')).rows.map((row) => [row.user_id, row]));
  let rows = await players();
  assert.equal(rows[host].preferred_color, 'black');
  assert.equal(rows[guest].preferred_color, 'white');

  // Nobody is ready yet.
  await as(host);
  await assert.rejects(db.query('select start_chess_game($1)', [room.id]), /ready/);

  // Host clears Black; the guest may take it, the host takes White.
  await db.query('select set_chess_room_color($1,null)', [room.id]);
  await assert.rejects(db.query('select set_chess_room_ready($1,true)', [room.id]), /color/);
  await assert.rejects(db.query("select set_chess_room_color($1,'white')", [room.id]), /taken/);
  await as(guest);
  await db.query("select set_chess_room_color($1,'black')", [room.id]);
  await db.query('select set_chess_room_ready($1,true)', [room.id]);
  await as(host);
  await db.query("select set_chess_room_color($1,'white')", [room.id]);
  await db.query('select set_chess_room_ready($1,true)', [room.id]);

  // Only the host starts.
  await as(guest);
  await assert.rejects(db.query('select start_chess_game($1)', [room.id]), /host/);
  await as(host);
  await db.query('select start_chess_game($1)', [room.id]);
  rows = await players();
  assert.equal(rows[host].seat, 0);
  assert.equal(rows[host].chosen_color, 'white');
  assert.equal(rows[guest].seat, 1);
  assert.equal(rows[guest].chosen_color, 'black');
  assert.equal((await db.query('select status from chess_games')).rows[0].status, 'playing');
  await assert.rejects(db.query('select set_chess_room_ready($1,false)', [room.id]), /started/);
});

test('classic rooms: changing color resets ready; default colors move the host to the Black seat', { skip: !PGlite }, async () => {
  const { db, as } = await setup();
  await as(host);
  const code = (await db.query("select create_chess_room('Host') as code")).rows[0].code;
  await as(guest);
  await db.query("select join_chess_room($1,'Guest')", [code]);
  const room = (await db.query('select * from chess_rooms')).rows[0];
  const ready = async (id) => (await db.query('select ready from chess_room_players where user_id=$1', [id])).rows[0].ready;
  await db.query('select set_chess_room_ready($1,true)', [room.id]);
  await db.query('select set_chess_room_color($1,null)', [room.id]);
  assert.equal(await ready(guest), false);

  await db.query("select set_chess_room_color($1,'white')", [room.id]);
  await db.query('select set_chess_room_ready($1,true)', [room.id]);
  await as(host);
  await db.query('select set_chess_room_ready($1,true)', [room.id]);
  await db.query('select start_chess_game($1)', [room.id]);
  const seats = Object.fromEntries((await db.query('select user_id, seat, chosen_color from chess_room_players')).rows.map((row) => [row.user_id, `${row.seat}:${row.chosen_color}`]));
  assert.deepEqual(seats, { [host]: '1:black', [guest]: '0:white' });
});

test('variant rooms wait for both players to be ready before the host starts', { skip: !PGlite }, async () => {
  const { db, as } = await setup();
  for (const variant of ['draft', 'three-lives', 'fog-of-war']) {
    const code = `${variant.slice(0, 3).toUpperCase()}123`;
    await as(host);
    const room = (await db.query("insert into variant_rooms(code,host_id,variant) values ($1,$2,$3) returning id", [code, host, variant])).rows[0].id;
    await db.query("insert into variant_room_players(room_id,user_id,seat,chosen_color) values ($1,$2,0,'black')", [room, host]);
    await db.query("insert into variant_games(room_id,status) values ($1,'waiting')", [room]);
    await db.query("insert into fog_multiplayer_games(room_id,status) values ($1,'waiting')", [room]);
    if (variant === 'draft') await db.query("insert into variant_draft_private(room_id,user_id,side) values ($1,$2,'b')", [room, host]);

    await as(guest);
    if (variant === 'draft') await db.query("select join_draft_variant_room($1,'Guest')", [code.toLowerCase()]);
    else await db.query("select join_variant_room($1,$2,'Guest')", [code, variant]);
    await assert.rejects(db.query("select join_variant_room($1,'mirror','Guest')", [code]), /another chess variant/);
    assert.equal((await db.query('select status from variant_rooms where id=$1', [room])).rows[0].status, 'waiting');
    assert.equal((await db.query('select chosen_color from variant_room_players where user_id=$1 and room_id=$2', [guest, room])).rows[0].chosen_color, 'white');

    // Swap colors: host frees Black, guest moves there, host takes White.
    await as(host);
    await db.query('select set_variant_room_color($1,null)', [room]);
    await as(guest);
    await db.query("select set_variant_room_color($1,'black')", [room]);
    await db.query('select set_variant_room_ready($1,true)', [room]);
    await as(host);
    await assert.rejects(db.query('select set_variant_room_ready($1,true)', [room]), /color/);
    await db.query("select set_variant_room_color($1,'white')", [room]);
    await assert.rejects(db.query('select start_variant_room($1)', [room]), /ready/);
    await db.query('select set_variant_room_ready($1,true)', [room]);
    await as(guest);
    await assert.rejects(db.query('select start_variant_room($1)', [room]), /host/);
    await as(host);
    await db.query('select start_variant_room($1)', [room]);

    assert.equal((await db.query('select status from variant_rooms where id=$1', [room])).rows[0].status, 'playing');
    const gameTable = variant === 'fog-of-war' ? 'fog_multiplayer_games' : 'variant_games';
    const expectedGameStatus = variant === 'draft' ? 'waiting' : 'playing';
    assert.equal((await db.query(`select status from ${gameTable} where room_id=$1`, [room])).rows[0].status, expectedGameStatus);
    if (variant === 'draft') {
      const sides = Object.fromEntries((await db.query('select user_id, side from variant_draft_private where room_id=$1', [room])).rows.map((row) => [row.user_id, row.side]));
      assert.deepEqual(sides, { [host]: 'w', [guest]: 'b' });
    }
    await assert.rejects(db.query("select set_variant_room_color($1,'black')", [room]), /started/);
  }
});
