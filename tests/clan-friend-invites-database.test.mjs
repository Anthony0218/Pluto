import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
let PGlite;
try { ({ PGlite } = await import(process.env.PGLITE_MODULE || '@electric-sql/pglite')); } catch { /* Optional local PostgreSQL harness. */ }

const [alice, bob, carol, dave] = ['a1', 'b2', 'c3', 'd4'].map(tail => `00000000-0000-0000-0000-0000000000${tail}`);
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
    create table public.profiles(id uuid primary key, username text, display_name text, avatar_id text);
    create table public.friendships(user_a uuid, user_b uuid);
    insert into auth.users values ('${alice}'), ('${bob}'), ('${carol}'), ('${dave}');
    insert into public.profiles values ('${alice}', 'alice', 'Alice', 'm1'), ('${bob}', 'bob', null, 'm2'), ('${carol}', 'carol', ' ', 'f1'), ('${dave}', 'dave', 'Dave', 'm1');
    insert into public.friendships values ('${alice}', '${bob}'), ('${carol}', '${alice}'), ('${bob}', '${dave}');`);
  await db.exec(await migration('20260928100000_groups.sql'));
  await db.exec(await migration('20261113000000_clan_friend_invites.sql'));
  return db;
}
const as = (db, id) => db.query("select set_config('test.user_id', $1, false)", [id]);
const value = async (db, sql, params = []) => Object.values((await db.query(sql, params)).rows[0])[0];
const invite = (db, clan, friend) => value(db, 'select public.invite_friend_to_clan($1, $2)', [clan, friend]);
const members = async (db, clan) => (await db.query('select user_id from public.community_group_members where group_id = $1', [clan])).rows.map(row => row.user_id).sort();

test('a clan member invites friends, who accept or decline', { skip: !PGlite }, async () => {
  const db = await setup();
  await as(db, alice);
  const clan = await value(db, `select public.create_community_group('Mapmakers', 'Atlas fans', 'globe')`);

  // Only members invite, only their own friends, and never someone already in the clan.
  await assert.rejects(invite(db, clan, dave), /only invite friends/);
  await assert.rejects(invite(db, clan, alice), /only invite friends/);
  await as(db, bob);
  await assert.rejects(invite(db, clan, dave), /Join this clan first/);
  await as(db, '');
  await assert.rejects(invite(db, clan, bob), /Sign in/);

  await as(db, alice);
  const toBob = await invite(db, clan, bob);
  assert.equal(await invite(db, clan, bob), toBob, 'a second invitation reuses the open one');
  const toCarol = await invite(db, clan, carol);
  assert.equal((await db.query('select * from public.get_clan_invites()')).rows.length, 0, 'senders have no inbox entry');

  // The invited player sees the clan and who invited them, and cannot answer for somebody else.
  await as(db, bob);
  const inbox = (await db.query('select * from public.get_clan_invites()')).rows;
  assert.equal(inbox.length, 1);
  assert.deepEqual({ ...inbox[0], created_at: null }, { id: toBob, group_id: clan, group_name: 'Mapmakers', group_avatar_id: 'globe', member_count: 1, sender_id: alice, sender_name: 'Alice', sender_avatar_id: 'm1', created_at: null });
  await assert.rejects(db.query('select public.respond_clan_invite($1, true)', [toCarol]), /no longer open/);
  assert.equal(await value(db, 'select public.respond_clan_invite($1, true)', [toBob]), clan);
  assert.deepEqual(await members(db, clan), [alice, bob]);
  await assert.rejects(db.query('select public.respond_clan_invite($1, true)', [toBob]), /no longer open/);
  assert.equal((await db.query('select * from public.get_clan_invites()')).rows.length, 0);

  // A new member can invite their own friends too.
  const toDave = await invite(db, clan, dave);
  await as(db, alice);
  await assert.rejects(invite(db, clan, bob), /Already a member/);

  // Declining leaves the clan unchanged, and the player can be invited again.
  await as(db, carol);
  assert.equal(await value(db, 'select public.respond_clan_invite($1, false)', [toCarol]), null);
  assert.deepEqual(await members(db, clan), [alice, bob]);
  await as(db, alice);
  assert.notEqual(await invite(db, clan, carol), toCarol);

  // Joining with the code closes the inbox entry; disbanding removes every invitation.
  await as(db, dave);
  assert.equal((await db.query('select * from public.get_clan_invites()')).rows[0].sender_name, 'bob');
  await db.query('select public.join_community_group((select invite_code from public.community_groups where id = $1))', [clan]);
  assert.equal((await db.query('select * from public.get_clan_invites()')).rows.length, 0);
  assert.equal(await value(db, 'select public.respond_clan_invite($1, true)', [toDave]), clan);
  await as(db, alice);
  await db.query('select public.delete_community_group($1)', [clan]);
  assert.equal(Number(await value(db, 'select count(*) from public.community_group_invites')), 0);
});

test('invitations are private to sender and receiver and cannot be written directly', { skip: !PGlite }, async () => {
  const db = await setup();
  await as(db, alice);
  const clan = await value(db, `select public.create_community_group('Mapmakers', '', 'globe')`);
  await invite(db, clan, bob);
  await db.exec('set role authenticated');
  const visible = async id => { await as(db, id); return Number(await value(db, 'select count(*) from public.community_group_invites')); };
  assert.equal(await visible(alice), 1);
  assert.equal(await visible(bob), 1);
  assert.equal(await visible(carol), 0);
  await as(db, carol);
  await assert.rejects(db.query(`insert into public.community_group_invites(group_id, sender_id, receiver_id) values ($1, $2, $2)`, [clan, carol]), /permission denied/);
  await assert.rejects(db.query(`update public.community_group_invites set status = 'accepted'`), /permission denied/);
  await db.exec('reset role');
});
