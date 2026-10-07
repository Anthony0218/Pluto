import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
let PGlite;
try { ({ PGlite } = await import(process.env.PGLITE_MODULE || '@electric-sql/pglite')); } catch { /* Optional local PostgreSQL harness. */ }

const alice = '00000000-0000-0000-0000-0000000000a1';
const bob = '00000000-0000-0000-0000-0000000000b2';
const carol = '00000000-0000-0000-0000-0000000000c3';
const table4 = '11111111-1111-4111-8111-111111111111';
const table3 = '33333333-3333-4333-8333-333333333333';
const migration = (file) => fs.readFile(new URL(`../supabase/migrations/${file}`, import.meta.url), 'utf8');

/** The parts of the live project this migration touches, as they are before it. */
async function setup(harden = true) {
  const db = new PGlite();
  await db.exec(`create schema auth; create schema realtime; create role authenticated; create role anon;
    create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('test.user_id', true), '')::uuid $$;
    create function realtime.topic() returns text language sql stable as $$ select nullif(current_setting('realtime.topic', true), '') $$;
    grant usage on schema auth, realtime, public to authenticated, anon;
    create table realtime.messages(id uuid primary key default gen_random_uuid(), topic text not null, extension text not null, payload jsonb, event text, private boolean default false);
    alter table realtime.messages enable row level security;
    grant select, insert, update on realtime.messages to authenticated, anon;
    create table public.profiles(id uuid primary key, username text, display_name text, avatar_id text, rating int default 1200);
    alter table public.profiles enable row level security;
    create policy "Profiles are publicly readable" on public.profiles for select to public using (true);
    create policy "profiles readable by authenticated users" on public.profiles for select to authenticated using (true);
    create policy "users can update own profile" on public.profiles for update to authenticated using (id = auth.uid()) with check (id = auth.uid());
    grant select on public.profiles to anon, authenticated; grant update (username, display_name, avatar_id) on public.profiles to authenticated;
    create table public.watten_room_players(room_id uuid, user_id uuid);
    create table public.watten3_room_players(room_id uuid, user_id uuid, seat int);
    create table public.watten3_hands(room_id uuid, user_id uuid, cards jsonb);
    create table public.watten_rooms(id uuid primary key, code text, status text, player_count int);
    create table public.atlas_matches(id uuid primary key default gen_random_uuid(), room_code text unique, players jsonb not null default '[]');
    alter table public.atlas_matches enable row level security;
    create function public.is_watten_room_member(p_room_id uuid) returns boolean language sql security definer set search_path = public as $$
      select exists (select 1 from public.watten_room_players p where p.room_id = p_room_id and p.user_id = auth.uid()) $$;
    create function public.is_watten3_room_member(p_room_id uuid) returns boolean language sql stable security definer set search_path = public as $$
      select exists (select 1 from public.watten3_room_players where room_id = p_room_id and user_id = auth.uid()) $$;
    create function public.get_watten_room_info(p_code text) returns table(room_id uuid, status text, joined_players bigint) language sql security definer set search_path = public as $$
      select r.id, r.status, count(p.user_id) from public.watten_rooms r left join public.watten_room_players p on p.room_id = r.id where r.code = upper(trim(p_code)) group by r.id, r.status $$;
    create function public.watten3_cards_remaining(p_room_id uuid) returns jsonb language sql security definer set search_path = public as $$
      select coalesce(jsonb_object_agg(p.seat::text, coalesce(jsonb_array_length(h.cards), 0)), '{}'::jsonb)
      from public.watten3_room_players p left join public.watten3_hands h on h.room_id = p.room_id and h.user_id = p.user_id where p.room_id = p_room_id $$;
    -- Stands in for play_watten3_card, which reads the card count as the function owner.
    create function public.play_card(p_room_id uuid) returns jsonb language sql security definer set search_path = public as $$ select public.watten3_cards_remaining(p_room_id) $$;
    revoke execute on function public.get_watten_room_info(text), public.watten3_cards_remaining(uuid) from public;
    grant execute on function public.get_watten_room_info(text), public.watten3_cards_remaining(uuid) to authenticated;
    insert into public.profiles(id, username) values ('${alice}', 'Alice'), ('${bob}', 'Bob'), ('${carol}', 'Carol');
    insert into public.watten_rooms values ('${table4}', 'WATTEN', 'playing', 4);
    insert into public.watten_room_players values ('${table4}', '${alice}'), ('${table4}', '${bob}');
    insert into public.watten3_room_players values ('${table3}', '${alice}', 0), ('${table3}', '${bob}', 1);
    insert into public.watten3_hands values ('${table3}', '${alice}', '[1,2,3]'), ('${table3}', '${bob}', '[1,2]');
    insert into public.atlas_matches(room_code, players) values ('ARENA1', '[{"id":"${alice}","name":"Alice"},{"id":"${bob}","name":"Bob"}]');`);
  if (harden) await db.exec(await migration('20261103000000_security_hardening_profiles_realtime.sql'));
  return db;
}

const as = async (db, role, id = '') => { await db.exec(`reset role; select set_config('test.user_id', '${id}', false); set role ${role}`); };
/** What Realtime does when a client joins or sends on a private channel: set the topic, then read or write realtime.messages as that user. */
const canJoin = async (db, topic) => {
  await db.query(`select set_config('realtime.topic', $1, false)`, [topic]);
  return (await db.query(`select public.can_use_realtime_topic(realtime.topic()) as ok`)).rows[0].ok;
};
const canSend = async (db, topic, extension = 'broadcast') => {
  await db.query(`select set_config('realtime.topic', $1, false)`, [topic]);
  try { await db.query(`insert into realtime.messages(topic, extension, payload) values ($1, $2, '{}')`, [topic, extension]); return true; } catch (error) { assert.match(String(error), /row-level security|permission denied/); return false; }
};

test('profiles need a signed-in player', { skip: !PGlite }, async () => {
  const before = await setup(false);
  await as(before, 'anon');
  assert.equal((await before.query('select username from public.profiles')).rows.length, 3, 'the open read this closes');

  const db = await setup();
  await as(db, 'anon');
  await assert.rejects(db.query('select username from public.profiles'), /permission denied/);
  await assert.rejects(db.query('select count(*) from public.profiles'), /permission denied/);
  await as(db, 'authenticated', carol);
  assert.equal((await db.query('select username from public.profiles')).rows.length, 3);
  assert.equal((await db.query(`update public.profiles set username = 'Caz' where id = $1 returning id`, [carol])).rows.length, 1);
  assert.equal((await db.query(`update public.profiles set username = 'x' where id = $1 returning id`, [alice])).rows.length, 0);
});

test('room lookups are closed to players; the game itself still counts cards', { skip: !PGlite }, async () => {
  const before = await setup(false);
  await as(before, 'authenticated', carol);
  assert.deepEqual((await before.query(`select public.watten3_cards_remaining($1) as c`, [table3])).rows[0].c, { 0: 3, 1: 2 }, 'an outsider could count the cards');
  assert.equal((await before.query(`select * from public.get_watten_room_info('watten')`)).rows.length, 1);

  const db = await setup();
  for (const [role, id] of [['authenticated', carol], ['authenticated', alice], ['anon', '']]) {
    await as(db, role, id);
    await assert.rejects(db.query(`select public.watten3_cards_remaining($1)`, [table3]), /permission denied/);
    await assert.rejects(db.query(`select * from public.get_watten_room_info('watten')`), /permission denied/);
  }
  await as(db, 'authenticated', alice);
  assert.deepEqual((await db.query(`select public.play_card($1) as c`, [table3])).rows[0].c, { 0: 3, 1: 2 });
});

test('private realtime topics admit the players of that room only', { skip: !PGlite }, async () => {
  const db = await setup();
  const topics = { watten4: `watten4-deal-${table4}`, watten3: `watten3-deal-${table3}`, atlas: 'atlas-ARENA1', natura: 'natura-v2:ABC234' };

  for (const player of [alice, bob]) {
    await as(db, 'authenticated', player);
    for (const topic of Object.values(topics)) assert.equal(await canJoin(db, topic), true, topic);
    assert.equal(await canSend(db, topics.watten4), true);
    assert.equal(await canSend(db, topics.atlas, 'presence'), true);
    assert.equal(await canSend(db, topics.atlas, 'postgres_changes'), false, 'only broadcast and presence are opened');
  }

  // A signed-in player who is in none of the rooms: Natura rooms only, since those exist in the host's browser.
  await as(db, 'authenticated', carol);
  assert.equal(await canJoin(db, topics.watten4), false);
  assert.equal(await canJoin(db, topics.watten3), false);
  assert.equal(await canJoin(db, topics.atlas), false);
  assert.equal(await canJoin(db, topics.natura), true);
  for (const topic of [topics.watten4, topics.watten3, topics.atlas]) assert.equal(await canSend(db, topic), false, topic);
  await db.query(`select set_config('realtime.topic', $1, false)`, [topics.atlas]);
  assert.equal((await db.query('select * from realtime.messages')).rows.length, 0, 'nothing sent in the arena is readable');
  await db.query(`select set_config('realtime.topic', $1, false)`, [topics.natura]);
  assert.equal(await canSend(db, topics.natura), true);

  // Topics nobody defined, or shaped to slip past the patterns, are refused without an error.
  await as(db, 'authenticated', alice);
  for (const topic of ['', 'anything', 'atlas-arena1', 'atlas-ARENA1x', 'atlas-ARENA2', `watten4-deal-${table3}`, `watten3-deal-${table4}`, 'watten4-deal-not-a-uuid',
    `watten4-deal-${table4}' or '1'='1`, `x-watten4-deal-${table4}`, 'natura-v2:abc234', 'natura-v2:ABC2345', 'natura-v1:ABC234', `chess-game-${table4}`]) {
    assert.equal(await canJoin(db, topic), false, topic);
    assert.equal(await canSend(db, topic), false, topic);
  }

  // Seats are checked when the channel is used, not remembered: leaving the arena closes it.
  await as(db, 'authenticated', alice);
  assert.equal(await canJoin(db, topics.atlas), true);
  await db.exec('reset role');
  await db.query(`update public.atlas_matches set players = $1 where room_code = 'ARENA1'`, [JSON.stringify([{ id: bob, name: 'Bob' }])]);
  await as(db, 'authenticated', alice);
  assert.equal(await canJoin(db, topics.atlas), false);
});

test('visitors without an account get no private channel at all', { skip: !PGlite }, async () => {
  const db = await setup();
  await as(db, 'anon');
  for (const topic of ['natura-v2:ABC234', 'atlas-ARENA1', `watten4-deal-${table4}`]) {
    await db.query(`select set_config('realtime.topic', $1, false)`, [topic]);
    await assert.rejects(db.query(`select public.can_use_realtime_topic(realtime.topic())`), /permission denied/);
    await assert.rejects(db.query(`insert into realtime.messages(topic, extension) values ($1, 'broadcast')`, [topic]), /row-level security/);
    assert.equal((await db.query('select * from realtime.messages')).rows.length, 0);
  }
});
