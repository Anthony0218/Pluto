import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
let PGlite;
try { ({ PGlite } = await import(process.env.PGLITE_MODULE || '@electric-sql/pglite')); } catch { /* Optional local PostgreSQL harness. */ }
const host = '00000000-0000-0000-0000-000000000001';

test('favorites accept every catalog game up to the eight-game limit', { skip: !PGlite }, async () => {
  const db = new PGlite();
  await db.exec(`create schema auth; create role authenticated; create role anon;
  create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('test.user_id',true),'')::uuid $$;
  create table auth.users(id uuid primary key);
  create table public.friend_messages(id uuid,game text,message_type text);
  create table public.dashboard_preferences(user_id uuid primary key); grant select, insert on public.dashboard_preferences to authenticated;
  grant usage on schema auth to authenticated; grant execute on function auth.uid() to authenticated;
  insert into auth.users values ('${host}');`);
  for (const file of ['20260926120000_chess_social_preferences.sql', '20261002000000_favorite_games_all_routes.sql']) {
    await db.exec(await fs.readFile(new URL('../supabase/migrations/' + file, import.meta.url), 'utf8'));
  }
  await db.query("select set_config('test.user_id',$1,false)", [host]);
  await db.exec('set role authenticated');
  // Newer games (Pluto Party, Eat It) used to be rejected by a hard-coded route list.
  const eight = ['/games/chess', '/games/watten', '/games/schafkopf', '/games/pluto-party', '/games/eat-it', '/games/go', '/games/shogi', '/games/natura'];
  await db.query('select set_favorite_games($1)', [eight]);
  assert.deepEqual((await db.query('select game_route from user_game_favorites order by slot')).rows.map(row => row.game_route), eight);
  await assert.rejects(db.query('select set_favorite_games($1)', [[...eight, '/games/atlas-arena']]));
  await assert.rejects(db.query('select set_favorite_games($1)', [['/games/chess', '/games/chess']]));
  await assert.rejects(db.query('select set_favorite_games($1)', [['https://untrusted.invalid']]));
  assert.equal((await db.query('select count(*)::int as count from user_game_favorites')).rows[0].count, 8);
});
