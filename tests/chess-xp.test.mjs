import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import { PGlite } from '@electric-sql/pglite';
import { activityXp, activityLevel } from '../src/components/social/avatarFrame.ts';

test('classic chess XP: coach discount, repeat completion, account isolation and profile levels', async () => {
  const db = new PGlite();
  const alice = '00000000-0000-0000-0000-000000000001';
  const bob = '00000000-0000-0000-0000-000000000002';
  const game = '00000000-0000-0000-0000-000000000011';
  const coached = '00000000-0000-0000-0000-000000000012';
  const next = '00000000-0000-0000-0000-000000000013';
  try {
    await db.exec(`create schema auth; create role authenticated; create role anon;
      create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('test.user_id', true), '')::uuid $$;
      grant usage on schema auth to authenticated;
      create table auth.users(id uuid primary key);
      create table public.games(id uuid primary key);
      create table public.profiles(id uuid, username text, display_name text, avatar_id text);
      create table public.user_game_results(game text, source_id text, user_id uuid, outcome text, multiplayer boolean, score_difference integer default 0);
      alter table public.user_game_results enable row level security;
      create policy own_results on public.user_game_results for select to authenticated using (user_id = auth.uid());
      grant select on public.user_game_results to authenticated;
      create table public.chess_ratings(user_id uuid, time_control text, rating int, rated_games int);
      create table public.chess_puzzles(id text primary key);
      create table public.chess_puzzle_completions(user_id uuid, puzzle_id text);
      insert into auth.users values ('${alice}'), ('${bob}');
      insert into public.profiles values ('${alice}', 'Alice', null, 'm1'), ('${bob}', 'Bob', null, 'm2');
      insert into public.user_game_results(game, source_id, user_id, outcome, multiplayer)
        select 'chess', g::text, '${alice}', 'win', true from generate_series(1, 9) g;
      create function public.get_my_game_stats() returns jsonb language sql as $$ select '{}'::jsonb $$;
      grant execute on function public.get_my_game_stats() to authenticated;`);
    await db.exec(await fs.readFile(new URL('../supabase/migrations/20261114000000_local_chess_xp.sql', import.meta.url), 'utf8'));
    await db.exec('set role authenticated');
    const as = id => db.query("select set_config('test.user_id', $1, false)", [id]);
    const claim = async (id, mode, coach) => (await db.query('select public.claim_local_chess_xp($1,$2,$3) as xp', [id, mode, coach])).rows[0].xp;
    const stats = async () => (await db.query('select public.get_my_game_stats() as stats')).rows[0].stats;
    await as('');
    await assert.rejects(claim(game, 'hotseat', false), /Sign in/);
    await as(alice);
    for (const [id, mode, coach] of [[null, 'hotseat', false], [game, 'online', false], [game, null, false], [game, 'hotseat', null]]) {
      await assert.rejects(claim(id, mode, coach), /Invalid chess XP session/);
    }
    assert.equal(await claim(game, 'hotseat', false), 100);
    assert.equal(await claim(game, 'hotseat', false), 100);
    assert.equal((await stats()).general.local_chess_xp, 100, 'repeat completion does not add a second reward');
    const level = async () => (await db.query('select public.get_public_profile($1) as profile', [alice])).rows[0].profile.level;
    assert.equal(await level(), 2);
    assert.equal(await claim(coached, 'singleplayer', true), 50);
    assert.equal(await claim(coached, 'singleplayer', false), 50, 'turning coach off cannot remove the discount');
    assert.equal(await claim(game, 'hotseat', true), 50, 'coach use after undo reduces the existing reward');
    assert.equal(await claim(game, 'hotseat', false), 50);
    assert.equal(await claim(next, 'singleplayer', false), 100, 'a fresh unassisted game earns full XP');
    const result = await stats();
    assert.equal(result.general.local_chess_xp, 200);
    assert.equal(result.general.games_played, 9, 'local XP leaves verified match statistics intact');
    assert.equal(activityXp(result.general.games_played, 0, result.general.local_chess_xp), 1100);
    assert.equal(await level(), activityLevel(1100));
    await assert.rejects(db.query('insert into public.local_chess_xp(user_id,session_id,mode) values ($1,$2,$3)', [alice, next, 'hotseat']), /permission denied/);
    await assert.rejects(db.query('update public.local_chess_xp set coach_used = false'), /permission denied/);
    await as(bob);
    assert.equal((await stats()).general.local_chess_xp, 0);
    assert.equal((await db.query('select * from public.local_chess_xp')).rows.length, 0);
    assert.equal(await claim(game, 'hotseat', false), 100, 'the same local game may credit a different account once');
    assert.equal((await stats()).general.local_chess_xp, 100);
    await as(alice);
    assert.equal((await stats()).general.local_chess_xp, 200, 'another account cannot change the reward');
  } finally { await db.close(); }
});
