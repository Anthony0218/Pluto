import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
let PGlite;
try { ({ PGlite } = await import(process.env.PGLITE_MODULE || '@electric-sql/pglite')); } catch { /* Optional local PostgreSQL harness. */ }

const u = n => `00000000-0000-0000-0000-00000000000${n}`;
const room4 = '00000000-0000-0000-0000-000000000444';
const room3 = '00000000-0000-0000-0000-000000000333';
const migration = await fs.readFile(new URL('../supabase/migrations/20261111000000_watten_gehen_votes.sql', import.meta.url), 'utf8');

async function setup() {
  const db = new PGlite();
  // Stand-ins for the live tables, which predate the migrations folder.
  await db.exec(`create schema auth; create role authenticated;
    create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('test.user_id', true), '')::uuid $$;
    create table public.watten_room_players(room_id uuid, user_id uuid, seat int);
    create table public.watten_games(room_id uuid primary key, phase text, round_value int, pending_bid_team text, pending_bid_value int,
      last_bid_team text, winner text, round_end_reason text, played_cards jsonb default '[]', trick_winner_seat int,
      team_a_score int default 0, team_b_score int default 0, match_winner text, version int default 0, updated_at timestamptz);
    create table public.watten3_room_players(room_id uuid, user_id uuid, seat int);
    create table public.watten3_games(room_id uuid primary key, phase text, trump_caller int, round_value int, pending_bid_side text,
      pending_bid_value int, last_bid_side text, winner_side text, version int default 0, updated_at timestamptz);
    create function public.watten3_award_side(p_room uuid, p_side text, p_value int, p_reason text) returns void language sql as
      $$ update public.watten3_games set phase = 'roundFinished', winner_side = p_side where room_id = p_room $$;
    insert into public.watten_room_players values ('${room4}', '${u(0)}', 0), ('${room4}', '${u(1)}', 1), ('${room4}', '${u(2)}', 2), ('${room4}', '${u(3)}', 3);
    insert into public.watten3_room_players values ('${room3}', '${u(0)}', 0), ('${room3}', '${u(1)}', 1), ('${room3}', '${u(2)}', 2);`);
  await db.exec(migration);
  return db;
}
const as = (db, n) => db.query("select set_config('test.user_id', $1, false)", [u(n)]);
const game4 = async db => (await db.query('select * from public.watten_games')).rows[0];
const game3 = async db => (await db.query('select * from public.watten3_games')).rows[0];

test('four players: one vote to stay holds, giving up needs both players of the team', { skip: !PGlite }, async () => {
  const db = await setup();
  const raise = () => db.exec(`delete from public.watten_games; insert into public.watten_games(room_id, phase, round_value, pending_bid_team, pending_bid_value) values ('${room4}', 'bidPending', 2, 'team-a', 3)`);
  await raise();
  await as(db, 1); // team B answers a raise by team A
  const first = (await db.query('select public.respond_watten_bid($1, false) r', [room4])).rows[0].r;
  assert.equal(first.pending, true);
  assert.deepEqual((await game4(db)).bid_votes, { 1: 'gehen' });
  assert.equal((await game4(db)).phase, 'bidPending');
  // The same player voting again does not count twice.
  await db.query('select public.respond_watten_bid($1, false)', [room4]);
  assert.equal((await game4(db)).phase, 'bidPending');
  await as(db, 3);
  const second = (await db.query('select public.respond_watten_bid($1, false) r', [room4])).rows[0].r;
  assert.equal(second.held, false);
  const done = await game4(db);
  assert.equal(done.phase, 'roundFinished'); assert.equal(done.winner, 'team-a'); assert.equal(done.round_end_reason, 'declined');
  assert.deepEqual(done.bid_votes, {});

  await raise();
  await as(db, 1); await db.query('select public.respond_watten_bid($1, false)', [room4]);
  await as(db, 3); await db.query('select public.respond_watten_bid($1, true)', [room4]);
  const held = await game4(db);
  assert.equal(held.phase, 'playing'); assert.equal(held.round_value, 3); assert.deepEqual(held.bid_votes, {});

  await raise();
  await as(db, 0);
  await assert.rejects(db.query('select public.respond_watten_bid($1, true)', [room4]), /opposing team must answer/);
});

test('three players: the team gives up together, the solo player alone', { skip: !PGlite }, async () => {
  const db = await setup();
  const raise = side => db.exec(`delete from public.watten3_games; insert into public.watten3_games(room_id, phase, trump_caller, round_value, pending_bid_side, pending_bid_value) values ('${room3}', 'bidPending', 0, 2, '${side}', 3)`);
  await raise('solo');
  await as(db, 1); await db.query('select public.respond_watten3_bid($1, false)', [room3]);
  assert.equal((await game3(db)).phase, 'bidPending'); assert.deepEqual((await game3(db)).bid_votes, { 1: 'gehen' });
  await as(db, 2); await db.query('select public.respond_watten3_bid($1, false)', [room3]);
  assert.equal((await game3(db)).phase, 'roundFinished'); assert.equal((await game3(db)).winner_side, 'solo');

  await raise('solo');
  await as(db, 1); await db.query('select public.respond_watten3_bid($1, false)', [room3]);
  await as(db, 2); await db.query('select public.respond_watten3_bid($1, true)', [room3]);
  assert.equal((await game3(db)).phase, 'playing'); assert.equal((await game3(db)).round_value, 3);

  await raise('team');
  await as(db, 0); await db.query('select public.respond_watten3_bid($1, false)', [room3]);
  assert.equal((await game3(db)).phase, 'roundFinished'); assert.equal((await game3(db)).winner_side, 'team');
});
