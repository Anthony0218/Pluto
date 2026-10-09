import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
let PGlite;
try { ({ PGlite } = await import(process.env.PGLITE_MODULE || '@electric-sql/pglite')); } catch { /* Optional local PostgreSQL harness. */ }

const u = n => `00000000-0000-0000-0000-00000000000${n}`;
const migration = await fs.readFile(new URL('../supabase/migrations/20261112000000_leave_waiting_rooms.sql', import.meta.url), 'utf8');

async function setup() {
  const db = new PGlite();
  // Stand-ins for the live tables, which predate the migrations folder; keys and cascades match production.
  await db.exec(`create schema auth; create role authenticated; create role anon;
    create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('test.user_id', true), '')::uuid $$;
    create table public.chess_rooms(id uuid primary key default gen_random_uuid(), code text unique, host_id uuid, status text default 'waiting', match_kind text default 'casual');
    create table public.chess_room_players(room_id uuid references public.chess_rooms(id) on delete cascade, user_id uuid, seat smallint check (seat in (0, 1)),
      ready boolean not null default false, primary key (room_id, user_id), unique (room_id, seat));
    create table public.chess_games(room_id uuid primary key references public.chess_rooms(id) on delete cascade);
    create table public.variant_rooms(id uuid primary key default gen_random_uuid(), code text unique, host_id uuid, variant text, max_players int, status text default 'waiting');
    create table public.variant_room_players(room_id uuid references public.variant_rooms(id) on delete cascade, user_id uuid, seat int,
      chosen_color text, ready boolean not null default false, primary key (room_id, user_id), unique (room_id, seat));
    create table public.variant_games(room_id uuid primary key references public.variant_rooms(id) on delete cascade);
    create table public.watten_rooms(id uuid primary key default gen_random_uuid(), code text unique, host_id uuid, status text default 'waiting');
    create table public.watten_room_players(room_id uuid references public.watten_rooms(id) on delete cascade, user_id uuid, seat int, primary key (room_id, user_id), unique (room_id, seat));
    create table public.watten_hands(room_id uuid references public.watten_rooms(id) on delete cascade, user_id uuid, primary key (room_id, user_id));
    create table public.watten3_rooms(id uuid primary key default gen_random_uuid(), code text unique, host_id uuid, status text default 'waiting');
    create table public.watten3_room_players(room_id uuid references public.watten3_rooms(id) on delete cascade, user_id uuid, seat int, primary key (room_id, user_id), unique (room_id, seat));
    create table public.watten3_hands(room_id uuid references public.watten3_rooms(id) on delete cascade, user_id uuid, primary key (room_id, user_id));`);
  await db.exec(migration);
  return db;
}
const as = (db, n) => db.query("select set_config('test.user_id', $1, false)", [n === null ? '' : u(n)]);
const rows = async (db, sql) => (await db.query(sql)).rows;
/** Creates a room with the given players in seat order; the first one hosts. */
async function room(db, table, code, players, extra = '') {
  const id = (await db.query(`insert into public.${table}_rooms(code, host_id${extra ? ', ' + extra.split('=')[0] : ''}) values ($1, $2${extra ? ', ' + extra.split('=')[1] : ''}) returning id`, [code, u(players[0])])).rows[0].id;
  for (const [seat, player] of players.entries()) await db.query(`insert into public.${table}_room_players(room_id, user_id, seat) values ($1, $2, $3)`, [id, u(player), seat]);
  return id;
}

test('classic chess: the host leaving hands the room to the guest, the last player closes it', { skip: !PGlite }, async () => {
  const db = await setup();
  const id = await room(db, 'chess', 'ABC123', [1, 2]);
  await db.exec(`update public.chess_rooms set status = 'ready'; update public.chess_room_players set ready = true; insert into public.chess_games values ('${id}')`);
  await as(db, 1);
  await db.query("select public.leave_chess_room(' abc123 ')");
  assert.deepEqual(await rows(db, 'select host_id, status from public.chess_rooms'), [{ host_id: u(2), status: 'waiting' }]);
  // The guest moves to seat 0, so join_chess_room can seat the next player in seat 1.
  assert.deepEqual(await rows(db, 'select user_id, seat, ready from public.chess_room_players'), [{ user_id: u(2), seat: 0, ready: false }]);
  // Leaving twice, or a room the player is not in, changes nothing.
  await db.query("select public.leave_chess_room('ABC123')");
  assert.equal((await rows(db, 'select 1 from public.chess_room_players')).length, 1);
  await as(db, 2);
  await db.query("select public.leave_chess_room('ABC123')");
  assert.deepEqual(await rows(db, 'select 1 from public.chess_rooms'), []);
  assert.deepEqual(await rows(db, 'select 1 from public.chess_games'), []);
});

test('classic chess: running and ranked rooms keep their seats', { skip: !PGlite }, async () => {
  const db = await setup();
  await room(db, 'chess', 'PLAY01', [1, 2]);
  await room(db, 'chess', 'RANK01', [1, 2], "match_kind='ranked'");
  await db.exec("update public.chess_rooms set status = 'playing' where code = 'PLAY01'");
  await as(db, 1);
  await db.query("select public.leave_chess_room('PLAY01'), public.leave_chess_room('RANK01'), public.leave_chess_room('NOROOM')");
  assert.equal((await rows(db, 'select 1 from public.chess_room_players')).length, 4);
  await as(db, null);
  await assert.rejects(db.query("select public.leave_chess_room('PLAY01')"), /Authentication required/);
});

test('chess variants: two-player rooms re-seat the remaining player, Four Player keeps colors', { skip: !PGlite }, async () => {
  const db = await setup();
  const duel = await room(db, 'variant', 'DUEL01', [1, 2], 'max_players=2');
  const four = await room(db, 'variant', 'FOUR01', [1, 2, 3], 'max_players=4');
  await db.exec(`update public.variant_room_players set ready = true; insert into public.variant_games values ('${duel}')`);
  await as(db, 1);
  await db.query("select public.leave_variant_room('duel01'), public.leave_variant_room('FOUR01')");
  assert.deepEqual(await rows(db, `select user_id, seat, ready from public.variant_room_players where room_id = '${duel}'`), [{ user_id: u(2), seat: 0, ready: false }]);
  assert.deepEqual(await rows(db, `select user_id, seat from public.variant_room_players where room_id = '${four}' order by seat`), [{ user_id: u(2), seat: 1 }, { user_id: u(3), seat: 2 }]);
  assert.deepEqual(await rows(db, 'select code, host_id from public.variant_rooms order by code'), [{ code: 'DUEL01', host_id: u(2) }, { code: 'FOUR01', host_id: u(2) }]);
  // A guest leaving keeps the host; the last player removes the room and its game.
  await as(db, 3);
  await db.query("select public.leave_variant_room('FOUR01')");
  assert.equal((await rows(db, "select host_id from public.variant_rooms where code = 'FOUR01'"))[0].host_id, u(2));
  await as(db, 2);
  await db.query("select public.leave_variant_room('DUEL01')");
  assert.deepEqual(await rows(db, 'select code from public.variant_rooms'), [{ code: 'FOUR01' }]);
  assert.deepEqual(await rows(db, 'select 1 from public.variant_games'), []);
  await db.exec("update public.variant_rooms set status = 'playing'");
  await db.query("select public.leave_variant_room('FOUR01')");
  assert.equal((await rows(db, 'select 1 from public.variant_room_players')).length, 1);
});

for (const [table, leave] of [['watten', 'leave_watten_room'], ['watten3', 'leave_watten3_room']]) {
  test(`${table}: a leaving player frees the seat and the next seat hosts`, { skip: !PGlite }, async () => {
    const db = await setup();
    const id = await room(db, table, 'WATT01', [1, 2, 3]);
    await db.exec(`insert into public.${table}_hands select room_id, user_id from public.${table}_room_players`);
    await as(db, 1);
    await db.query(`select public.${leave}('watt01')`);
    assert.deepEqual(await rows(db, `select user_id, seat from public.${table}_room_players order by seat`), [{ user_id: u(2), seat: 1 }, { user_id: u(3), seat: 2 }]);
    assert.deepEqual((await rows(db, `select user_id from public.${table}_hands order by user_id`)).map(row => row.user_id), [u(2), u(3)]);
    assert.equal((await rows(db, `select host_id from public.${table}_rooms`))[0].host_id, u(2));
    // Once the game runs nobody is removed.
    await db.exec(`update public.${table}_rooms set status = 'playing'`);
    await as(db, 2);
    await db.query(`select public.${leave}('WATT01')`);
    assert.equal((await rows(db, `select 1 from public.${table}_room_players`)).length, 2);
    await db.exec(`update public.${table}_rooms set status = 'waiting'`);
    await db.query(`select public.${leave}('WATT01')`);
    await as(db, 3);
    await db.query(`select public.${leave}('WATT01')`);
    assert.deepEqual(await rows(db, `select 1 from public.${table}_rooms where id = '${id}'`), []);
  });
}

test('only signed-in players may call the leave functions', { skip: !PGlite }, async () => {
  const db = await setup();
  const grants = await rows(db, `select p.proname, has_function_privilege('anon', p.oid, 'execute') anon, has_function_privilege('authenticated', p.oid, 'execute') member
    from pg_proc p where p.pronamespace = 'public'::regnamespace and p.proname like 'leave_%' order by 1`);
  assert.deepEqual(grants.map(row => row.proname), ['leave_chess_room', 'leave_variant_room', 'leave_watten3_room', 'leave_watten_room']);
  for (const row of grants) assert.deepEqual([row.anon, row.member], [false, true], row.proname);
});
