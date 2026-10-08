import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
let PGlite;
try { ({ PGlite } = await import(process.env.PGLITE_MODULE || '@electric-sql/pglite')); } catch { /* Optional local PostgreSQL harness. */ }

const alice = '00000000-0000-0000-0000-0000000000a1';
const bob = '00000000-0000-0000-0000-0000000000b2';
const migration = (file) => fs.readFile(new URL(`../supabase/migrations/${file}`, import.meta.url), 'utf8');

async function setup() {
  const db = new PGlite();
  await db.exec(`create schema auth; create role authenticated; create role anon;
    create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('test.user_id', true), '')::uuid $$;
    grant usage on schema auth to authenticated; grant execute on function auth.uid() to authenticated;
    grant usage on schema public to authenticated;
    create table public.user_game_results(game text, source_id text, user_id uuid, outcome text, completed_at timestamptz default now());
    create table public.chess_puzzle_completions(user_id uuid, puzzle_id text, completed_at timestamptz default now(), mistakes integer default 0);
    create table public.dashboard_game_visits(user_id uuid, game_route text, visited_on date, last_visited_at timestamptz default now());
    create table public.dashboard_resource_visits(user_id uuid, route text, visited_on date);
    grant select on all tables in schema public to authenticated;`);
  await db.exec(await migration('20261108000000_activity_overview.sql'));
  await db.exec(`
    insert into public.user_game_results values
      ('chess', 'a', '${alice}', 'win',  '2026-10-07 23:30:00+00'),
      ('chess', 'b', '${alice}', 'loss', '2026-10-08 10:00:00+00'),
      ('atlas', 'c', '${alice}', 'draw', '2026-10-08 11:00:00+00'),
      ('chess', 'z', '${bob}',   'win',  '2026-10-08 10:00:00+00');
    insert into public.chess_puzzle_completions values ('${alice}', 'p1', '2026-10-08 12:00:00+00', 2), ('${bob}', 'p2', '2026-10-08 12:00:00+00', 0);
    insert into public.dashboard_game_visits values ('${alice}', '/games/go', '2026-10-08', '2026-10-08 09:00:00+00');
    insert into public.dashboard_resource_visits values ('${alice}', '/learn/math', '2026-10-08'), ('${bob}', '/learn/music', '2026-10-08');`);
  return db;
}
const as = (db, id) => db.query("select set_config('test.user_id', $1, false)", [id ?? '']);
const days = async (db, tz) => (await db.query(`select day::text, kind, label, n from public.get_activity_days('2026-10-01', '2026-10-31', $1) order by 1, 2, 3`, [tz])).rows;

test('days are bucketed in the caller\'s time zone and only the caller\'s rows count', { skip: !PGlite }, async () => {
  const db = await setup();
  await as(db, alice);
  const utc = await days(db, 'UTC');
  assert.deepEqual(utc.filter(row => row.kind === 'game'), [
    { day: '2026-10-07', kind: 'game', label: 'chess', n: 1 },
    { day: '2026-10-08', kind: 'game', label: 'atlas', n: 1 },
    { day: '2026-10-08', kind: 'game', label: 'chess', n: 1 },
  ]);
  // 23:30 UTC on the 7th is 01:30 on the 8th in Berlin (UTC+2 in October).
  const berlin = await days(db, 'Europe/Berlin');
  assert.deepEqual(berlin.filter(row => row.kind === 'game' && row.label === 'chess'), [{ day: '2026-10-08', kind: 'game', label: 'chess', n: 2 }]);
  assert.equal(utc.filter(row => row.kind === 'puzzle').length, 1);
  assert.deepEqual(utc.filter(row => row.kind === 'explore').map(row => row.label), ['/games/go', '/learn/math']);
  // Bob's rows never leak into Alice's totals, and his totals stay his own.
  await as(db, bob);
  assert.equal((await days(db, 'UTC')).reduce((sum, row) => sum + row.n, 0), 3);
});

test('an unknown time zone falls back to UTC; bad ranges and signed-out callers are rejected', { skip: !PGlite }, async () => {
  const db = await setup();
  await as(db, alice);
  assert.deepEqual(await days(db, 'Not/AZone'), await days(db, 'UTC'));
  await assert.rejects(db.query(`select * from public.get_activity_days('2026-10-31', '2026-10-01', 'UTC')`), /Invalid range/);
  await assert.rejects(db.query(`select * from public.get_activity_days('2025-01-01', '2026-10-31', 'UTC')`), /Invalid range/);
  await as(db, null);
  await assert.rejects(db.query(`select * from public.get_activity_days('2026-10-01', '2026-10-31', 'UTC')`), /Authentication required/);
  await assert.rejects(db.query(`select * from public.get_activity_day('2026-10-08', 'UTC')`), /Authentication required/);
});

test('a day lists its events in order, with untimed lesson visits last', { skip: !PGlite }, async () => {
  const db = await setup();
  await as(db, alice);
  const { rows } = await db.query(`select to_char(at at time zone 'UTC', 'HH24:MI') as hhmm, kind, label, detail from public.get_activity_day('2026-10-08', 'UTC')`);
  assert.deepEqual(rows, [
    { hhmm: '09:00', kind: 'explore', label: '/games/go', detail: null },
    { hhmm: '10:00', kind: 'game', label: 'chess', detail: 'loss' },
    { hhmm: '11:00', kind: 'game', label: 'atlas', detail: 'draw' },
    { hhmm: '12:00', kind: 'puzzle', label: 'chess', detail: '2' },
    { hhmm: null, kind: 'explore', label: '/learn/math', detail: null },
  ]);
});
