import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {PGlite} from '@electric-sql/pglite';
import {certifiedRating} from '../src/games/atlas/ranked.ts';
const migration=async name=>readFile(new URL('../supabase/migrations/'+name,import.meta.url),'utf8');
const A='00000000-0000-4000-8000-000000000001',B='00000000-0000-4000-8000-000000000002';
test('private rows and telemetry are unreadable to players; leaderboard and calibration use safe contracts',async()=>{
 const db=new PGlite();
 try{
  await db.exec(`create role anon;create role authenticated;create role service_role;create schema auth;
   create function auth.uid() returns uuid language sql as $$select '${A}'::uuid$$;
   create function auth.role() returns text language sql as $$select 'service_role'::text$$;
   create table auth.users(id uuid primary key);insert into auth.users values('${A}'),('${B}');
   create table profiles(id uuid primary key,username text,display_name text);create publication supabase_realtime;`);
  for(const file of ['20260926150000_atlas_arena.sql','20261013000000_atlas_party_modes.sql','20261017000000_atlas_unified_modes.sql','20261018000000_atlas_language_guesser.sql','20261019000000_atlas_ranked.sql'])await db.exec(await migration(file));
  const previous=await migration('20261021000000_invites_atlas_ranks.sql');await db.exec(previous.slice(previous.indexOf('create function public.get_atlas_ranked_leaderboard'),previous.indexOf('-- Metadata only.')));
  await db.query("insert into atlas_matches(room_code,mode,host_id,players,dataset_version,seed) values('OLD001','map_fill',$1::uuid,jsonb_build_array(jsonb_build_object('id',$1::text)),'2026-09','secret')",[A]);
  await db.exec(await migration('20261023000000_atlas_arena_overhaul.sql'));
  assert.equal((await db.query("select status from atlas_matches where room_code='OLD001'")).rows[0].status,'cancelled');
  assert.equal((await db.query("select count(*)::int n from pg_publication_tables where tablename='atlas_matches'")).rows[0].n,0);
  await db.exec('set role authenticated');await assert.rejects(db.query('select * from atlas_matches'),/permission denied/);await assert.rejects(db.query('select * from atlas_question_attempts'),/permission denied/);await db.exec('reset role');
  await assert.rejects(db.query("insert into atlas_matches(room_code,mode,host_id,players,dataset_version,seed) values('BAD001','map_fill',$1::uuid,jsonb_build_array(jsonb_build_object('id',$1::text)),'2026-09','old')",[A]),/atlas_current_protocol/);
  await db.query('insert into atlas_ranked_profiles(user_id,rating,deviation,matches_played) values($1,2450,60,30),($2,2600,300,3)',[A,B]);
  for(const [rating,deviation,matches] of [[2450,60,30],[2450,60,29],[2300,100,19],[1920,100,20],[1600,60,10]])assert.equal((await db.query('select atlas_certified_rating($1,$2,$3) r',[rating,deviation,matches])).rows[0].r,certifiedRating(rating,deviation,matches));
  await db.exec('set role anon');const board=(await db.query('select * from get_atlas_ranked_leaderboard()')).rows;assert.equal(board.length,1);assert.equal(board[0].user_id,A);assert.equal(board[0].deviation,60);await db.exec('reset role');
  const {rows:[room]}=await db.query("insert into atlas_matches(room_code,mode,host_id,players,dataset_version,seed) values('NEW001','map_fill',$1::uuid,jsonb_build_array(jsonb_build_object('id',$1::text)),'2026-09-arena2','private') returning id",[A]);
  const state={race:{[A]:{ledger:[{index:0,correct:true,points:1000,elapsedMs:1800,concept:'map_fill:locations'}]}}};
  await db.query('update atlas_matches set state=$1 where id=$2',[JSON.stringify(state),room.id]);await db.query('update atlas_matches set version=version+1 where id=$1',[room.id]);
  const attempts=(await db.query('select concept,correct,response_ms,points from atlas_question_attempts')).rows;assert.deepEqual(attempts,[{concept:'map_fill:locations',correct:true,response_ms:1800,points:1000}]);
  await db.exec('set role authenticated');await assert.rejects(db.query('update atlas_matches set scores=\'{"cheat":1000000}\''),/permission denied/);await db.exec('reset role');
 }finally{await db.close();}
});
