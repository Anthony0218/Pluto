import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { PGlite } from '@electric-sql/pglite';

const uid = n => `00000000-0000-4000-8000-${String(n).padStart(12,'0')}`;
const migration = readFileSync(new URL('../supabase/migrations/20261021000000_invites_atlas_ranks.sql',import.meta.url),'utf8');
const clockMigration = migration.slice(0,migration.indexOf('create function public.get_atlas_ranked_leaderboard'));
for (const columns of ['', ',byo_yomi_ms double precision', ',byo_yomi_periods integer', ',byo_yomi_periods integer,byo_yomi_ms double precision']) {
  test(`Go presets upgrade deployed clock columns (${columns || 'neither byo-yomi column'}) without changing active clocks`, async () => {
    const db = new PGlite();
    try {
      await db.exec(`create table go_ranked_time_controls(id text primary key,initial_ms double precision${columns});
        insert into go_ranked_time_controls(id,initial_ms) values('blitz',60000),('normal',600000);
        create table go_ranked_games(id integer primary key,black_time_ms double precision,white_time_ms double precision);
        insert into go_ranked_games values(1,48000,52000);`);
      await db.exec(clockMigration);
      // Running the clock upgrade again must also work when the columns exist.
      await db.exec(clockMigration);
      assert.deepEqual((await db.query('select id,initial_ms,byo_yomi_periods,byo_yomi_ms from go_ranked_time_controls order by id')).rows,
        [{id:'blitz',initial_ms:30000,byo_yomi_periods:5,byo_yomi_ms:10000},
          {id:'normal',initial_ms:300000,byo_yomi_periods:5,byo_yomi_ms:30000}]);
      assert.deepEqual((await db.query('select * from go_ranked_games')).rows,
        [{id:1,black_time_ms:48000,white_time_ms:52000}]);
    } finally { await db.close(); }
  });
}
test('universal room lookup preserves every game mode, collisions and authentication; Atlas ranks are global', async () => {
  const db = new PGlite();
  try {
    await db.exec(`create role anon; create role authenticated; create schema auth;
      create function auth.uid() returns uuid language sql as $$ select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;
      create table profiles(id uuid primary key, username text, display_name text);
      create table go_ranked_time_controls(id text primary key,initial_ms integer,byo_yomi_periods integer,byo_yomi_ms integer);
      insert into go_ranked_time_controls values('blitz',60000,3,10000);
      create table atlas_ranked_profiles(user_id uuid primary key, rating double precision,matches_played integer);
      create table chess_rooms(id uuid primary key default gen_random_uuid(),code text);
      create table ranked_chess_matches(room_id uuid);
      create table variant_rooms(code text,variant text);
      create table watten_rooms(code text); create table watten3_rooms(code text);
      create table schafkopf_rooms(code text);
      create table strategy_matches(room_code text, game_type text);
      create table atlas_matches(room_code text,mode text,match_kind text,status text);
      create table eat_it_matches(room_code text);
      create table chess_custom_matches(code text);
      create table card_game_sessions(code text);
      create table friend_messages(game_route text,message_type text,game text);
      alter table friend_messages add constraint friend_message_lobby_route check(game_route is null);`);
    await db.exec(migration);
    await assert.rejects(db.query('select * from resolve_game_invite($1)',['ABC123']), /Sign in/);
    await db.query("select set_config('request.jwt.claim.sub',$1,false)",[uid(1)]);
    await assert.rejects(db.query('select * from resolve_game_invite($1)',['oops']), /six-character/);
    await db.exec(`insert into strategy_matches values('ABC123','go'),('SHOGI1','shogi');
      insert into atlas_matches values('ABC123','guess_country','casual','waiting'),('RANKED','flag_battle','ranked','ready');
      insert into variant_rooms values('FOUR01','four-player'),('FLAG01','fog-of-war');
      insert into watten_rooms values('WATT04'); insert into watten3_rooms values('WATT03');
      insert into schafkopf_rooms values('SCHAF1'); insert into eat_it_matches values('EATIT1');
      insert into chess_custom_matches values('CUST01'); insert into card_game_sessions values('CARD01');
      insert into chess_rooms(code) values('CHESS1'),('RANKC1'); insert into ranked_chess_matches select id from chess_rooms where code='RANKC1';`);
    const resolve = async code => (await db.query('select * from resolve_game_invite($1)',[code])).rows;
    assert.deepEqual(await resolve(' abc123 '),[{game_route:'/games/go/multiplayer',mode:'go'},{game_route:'/games/atlas-arena/multiplayer',mode:'guess_country'}]);
    for (const [code,route] of [['SHOGI1','/games/shogi/multiplayer'],['FOUR01','/games/chess/variants/4-players/multiplayer'],['FLAG01','/games/chess/variants/fog-of-war/multiplayer'],['WATT04','/games/watten/multiplayer/4'],['WATT03','/games/watten/multiplayer/3'],['SCHAF1','/games/schafkopf/multiplayer'],['EATIT1','/games/eat-it/multiplayer'],['CUST01','/chess-custom/play/multiplayer'],['CARD01','/games/card-builder/room'],['CHESS1','/games/chess/classic/multiplayer']]) {
      assert.equal((await resolve(code))[0].game_route,route);
      await db.query("insert into friend_messages values($1,'game_code',$2)",[route,route.includes('watten')?'watten':'chess']);
    }
    assert.deepEqual(await resolve('RANKED'),[]);
    assert.deepEqual(await resolve('RANKC1'),[]);
    assert.deepEqual(await resolve('MISSING'.slice(0,6)),[]);
    await assert.rejects(db.query("insert into friend_messages values('/evil','game_code','chess')"), /check constraint/);
    const clock = (await db.query('select * from go_ranked_time_controls')).rows[0];
    assert.equal(clock.initial_ms,30000); assert.equal(clock.byo_yomi_periods,5);
    for(let n=1;n<=110;n++) await db.query('insert into atlas_ranked_profiles values($1,$2,1)',[uid(n),2000-n]);
    await db.query('insert into atlas_ranked_profiles values($1,10000,0)',[uid(111)]);
    const board=(await db.query('select * from get_atlas_ranked_leaderboard()')).rows;
    assert.equal(board.length,100);assert.equal(Number(board[0].leaderboard_rank),1);
    const exact=(await db.query('select * from get_atlas_ranked_leaderboard($1)',[[uid(10),uid(11),uid(110),uid(111)]])).rows;
    assert.deepEqual(exact.map(r=>r.leaderboard_rank===null?null:Number(r.leaderboard_rank)),[10,11,110,null]);
  } finally { await db.close(); }
});
