import { readFileSync } from "node:fs";
import { PGlite } from "@electric-sql/pglite";
// The historical base schema/RPCs are hosted, not in this repository. Supply
// only that contract; run the actual queue, start, guard and clock migrations.
export async function database(extraMigrations = []) {
 const db=new PGlite();
 await db.exec(`
create role anon; create role authenticated; create role service_role;
create schema auth; create table auth.users(id uuid primary key);
create function auth.role() returns text language sql as $$ select current_setting('request.jwt.claim.role',true) $$;
create function auth.uid() returns uuid language sql as $$ select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;
select set_config('request.jwt.claim.role','service_role',false);
create table public.chess_rooms(id uuid primary key default gen_random_uuid(),code text unique,host_id uuid,status text default 'waiting');
create table public.chess_room_players(room_id uuid,user_id uuid,seat integer,chosen_color text,primary key(room_id,user_id));
create table public.chess_games(room_id uuid primary key,fen text,moves text[] default '{}',status text default 'playing',winner text,end_reason text,version integer default 0,last_move_from text,last_move_to text,undo_requested_by uuid,undo_requested_version integer,undo_last_requested_by uuid,undo_last_requested_version integer);
create table public.user_game_results(game text,source_id text,user_id uuid references auth.users(id),outcome text check(outcome in ('win','loss','draw')),multiplayer boolean,score_difference integer default 0,completed_at timestamptz default now(),details jsonb default '{}',primary key(game,source_id,user_id));
create table public.profiles(id uuid primary key,display_name text,username text,avatar_id text);
create function public.create_chess_room(p_display_name text) returns text language plpgsql as $$ declare c text:=upper(substr(md5(random()::text),1,6)); r uuid; begin insert into public.chess_rooms(code,host_id) values(c,auth.uid()) returning id into r; insert into public.chess_room_players values(r,auth.uid(),0,null); return c; end $$;
create function public.join_chess_room(p_code text,p_display_name text) returns text language plpgsql as $$ declare r uuid; begin select id into r from public.chess_rooms where code=p_code; insert into public.chess_room_players values(r,auth.uid(),1,null); update public.chess_rooms set status='ready' where id=r; return p_code; end $$;
create function public.start_chess_game(p_room_id uuid) returns void language plpgsql as $$ begin insert into public.chess_games(room_id,fen) values(p_room_id,'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1'); update public.chess_rooms set status='playing' where id=p_room_id; end $$;
 `);
 const migrate=async(file)=>{
  let sql=readFileSync(new URL('../../supabase/migrations/'+file,import.meta.url),'utf8');
  // pg_cron is a server extension unavailable in WASM. Exercise its exact
  // maintenance function below; installation/scheduling remains deployment QA.
  sql=sql.replace('create extension if not exists pg_cron;','').replace(/select cron.schedule\([^;]+;/,'');
  await db.exec(sql);
 };
 for(const file of ['20260928130000_ranked_foundation.sql','20260928180000_ranked_chess_guard.sql','20260928190000_ranked_chess_queue.sql','20260928200000_ranked_queue_autostart.sql','20260928210000_restore_ranked_round_guard.sql','20260928220000_ranked_color_draw.sql','20260929000000_ranked_lifecycle_clocks.sql','20261009000000_ranked_card_draw_clock.sql','20261010000000_ranked_time_controls.sql','20261012000000_ranked_undo_clock_pause.sql']) await migrate(file);
 const users=Array.from({length:4},(_,i)=>`00000000-0000-4000-8000-${String(i+1).padStart(12,'0')}`);
 for(const u of users)await db.query('insert into auth.users values($1)',[u]);
 // Extensions must also backfill users who existed before the migration.
 for(const file of extraMigrations) await migrate(file);
 const act=async(i,session,op,timeControl)=> (await db.query(timeControl?'select public.ranked_queue_action($1,$2,$3,$4,$5) result':'select public.ranked_queue_action($1,$2,$3) result',timeControl?[users[i],session,op,'Player',timeControl]:[users[i],session,op])).rows[0].result;
 const count=async(table)=>(await db.query(`select count(*)::int n from public.${table}`)).rows[0].n;
 return {db,users,act,count};
}
