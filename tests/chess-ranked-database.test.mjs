import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { PGlite } from '@electric-sql/pglite';
// The historical base schema/RPCs are hosted, not in this repository. Supply
// only that contract; run the actual queue, start, guard and clock migrations.
async function database() {
 const db=new PGlite();
 await db.exec(`
create role anon; create role authenticated; create role service_role;
create schema auth; create table auth.users(id uuid primary key);
create function auth.role() returns text language sql as $$ select current_setting('request.jwt.claim.role',true) $$;
create function auth.uid() returns uuid language sql as $$ select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;
select set_config('request.jwt.claim.role','service_role',false);
create table public.chess_rooms(id uuid primary key default gen_random_uuid(),code text unique,host_id uuid,status text default 'waiting');
create table public.chess_room_players(room_id uuid,user_id uuid,seat integer,chosen_color text,primary key(room_id,user_id));
create table public.chess_games(room_id uuid primary key,fen text,moves text[] default '{}',status text default 'playing',winner text,end_reason text,version integer default 0,last_move_from text,last_move_to text,undo_requested_by uuid,undo_requested_version integer);
create table public.profiles(id uuid primary key,display_name text,username text,avatar_id text);
create function public.create_chess_room(p_display_name text) returns text language plpgsql as $$ declare c text:=upper(substr(md5(random()::text),1,6)); r uuid; begin insert into public.chess_rooms(code,host_id) values(c,auth.uid()) returning id into r; insert into public.chess_room_players values(r,auth.uid(),0,null); return c; end $$;
create function public.join_chess_room(p_code text,p_display_name text) returns text language plpgsql as $$ declare r uuid; begin select id into r from public.chess_rooms where code=p_code; insert into public.chess_room_players values(r,auth.uid(),1,null); update public.chess_rooms set status='ready' where id=r; return p_code; end $$;
create function public.start_chess_game(p_room_id uuid) returns void language plpgsql as $$ begin insert into public.chess_games(room_id,fen) values(p_room_id,'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1'); update public.chess_rooms set status='playing' where id=p_room_id; end $$;
 `);
 for(const file of ['20260928130000_ranked_foundation.sql','20260928180000_ranked_chess_guard.sql','20260928190000_ranked_chess_queue.sql','20260928200000_ranked_queue_autostart.sql','20260928210000_restore_ranked_round_guard.sql','20260928220000_ranked_color_draw.sql','20260929000000_ranked_lifecycle_clocks.sql']) {
  let sql=readFileSync(new URL('../supabase/migrations/'+file,import.meta.url),'utf8');
  // pg_cron is a server extension unavailable in WASM. Exercise its exact
  // maintenance function below; installation/scheduling remains deployment QA.
  sql=sql.replace('create extension if not exists pg_cron;','').replace(/select cron.schedule\([^;]+;/,'');
  await db.exec(sql);
 }
 const users=Array.from({length:4},(_,i)=>`00000000-0000-4000-8000-${String(i+1).padStart(12,'0')}`);
 for(const u of users)await db.query('insert into auth.users values($1)',[u]);
 const act=async(i,session,op)=> (await db.query('select public.ranked_queue_action($1,$2,$3) result',[users[i],session,op])).rows[0].result;
 const count=async(table)=>(await db.query(`select count(*)::int n from public.${table}`)).rows[0].n;
 return {db,users,act,count};
}
test('queue lifecycle: late join, duplicate joins, refresh sessions, lease cleanup and match handoff',async()=>{
 const {db,act,count}=await database();
 try {
  const old=crypto.randomUUID();await act(0,old,'leaveQueue');assert.equal((await act(0,old,'queue')).status,'idle');assert.equal(await count('ranked_chess_queue'),0);
  const a=crypto.randomUUID(),b=crypto.randomUUID();
  assert.equal((await act(0,a,'queue')).status,'waiting');await act(0,a,'queue');assert.equal(await count('ranked_chess_queue'),1);
  const refreshed=crypto.randomUUID();assert.equal((await act(0,refreshed,'queueStatus')).status,'idle');
  await act(0,refreshed,'queue');await act(0,a,'leaveQueue');assert.equal(await count('ranked_chess_queue'),1);
  const match=await act(1,b,'queue');assert.equal(match.status,'matched');assert.equal((await act(0,refreshed,'queueStatus')).code,match.code);
  const g=(await db.query('select * from chess_games')).rows[0];assert.equal(g.white_time_ms,300000);assert.equal(g.black_time_ms,300000);assert.ok(g.clock_started_at);
  await act(0,refreshed,'leaveQueue');assert.equal((await db.query('select status from chess_games')).rows[0].status,'playing');
  assert.equal((await act(0,crypto.randomUUID(),'queueStatus')).code,match.code);
  const c=crypto.randomUUID();await act(2,c,'queue');await db.exec("update ranked_chess_queue set last_seen_at=clock_timestamp()-interval '13 seconds' where claimed_by is null");
  await db.exec('select public.maintain_ranked_chess()');assert.equal((await act(2,c,'queueStatus')).status,'idle');
 }finally{await db.close()}
});
test('database clocks switch on valid moves, preserve time on reconnect and end on deadline with no browsers',async()=>{
 const {db,act}=await database();
 try{
  await act(0,crypto.randomUUID(),'queue');await act(1,crypto.randomUUID(),'queue');
  const g=(await db.query('select * from chess_games')).rows[0];
  // Test elapsed database time deterministically without a five-minute sleep.
  await db.exec('alter table chess_games disable trigger z_ranked_clock_guard');
  await db.query("update chess_games set clock_started_at=clock_timestamp()-interval '4 seconds' where room_id=$1",[g.room_id]);
  await db.exec('alter table chess_games enable trigger z_ranked_clock_guard');
  await db.query("update chess_games set fen=replace(fen,' w ',' b '), moves=array['e4'],version=1 where room_id=$1",[g.room_id]);
  let moved=(await db.query('select * from chess_games')).rows[0];assert.ok(moved.white_time_ms<296100&&moved.white_time_ms>295000);assert.equal(moved.black_time_ms,300000);
  const saved=moved.white_time_ms;
  await db.query('select public.ranked_clock_snapshot($1)',[g.room_id]);assert.equal((await db.query('select white_time_ms from chess_games')).rows[0].white_time_ms,saved);
  await db.exec('alter table chess_games disable trigger z_ranked_clock_guard');
  await db.query("update chess_games set clock_started_at=clock_timestamp()-interval '301 seconds' where room_id=$1",[g.room_id]);
  await db.exec('alter table chess_games enable trigger z_ranked_clock_guard');
  await db.exec('select public.maintain_ranked_chess()');moved=(await db.query('select * from chess_games')).rows[0];
  assert.equal(moved.status,'finished');assert.equal(moved.end_reason,'timeout');assert.equal(moved.winner,'white');assert.equal(moved.black_time_ms,0);assert.equal(moved.white_time_ms,saved);assert.equal(moved.clock_started_at,null);
  await db.exec('select public.maintain_ranked_chess()');assert.equal((await db.query('select count(*)::int n from ranked_chess_matches')).rows[0].n,1);
 }finally{await db.close()}
});
test('a move racing flag fall cannot overwrite the authoritative timeout; casual remains untimed',async()=>{
 const {db,act,users}=await database();
 try{
  await act(0,crypto.randomUUID(),'queue');await act(1,crypto.randomUUID(),'queue');
  const g=(await db.query('select * from chess_games')).rows[0];
  await db.exec("alter table chess_games disable trigger z_ranked_clock_guard; update chess_games set clock_started_at=clock_timestamp()-interval '301 seconds'; alter table chess_games enable trigger z_ranked_clock_guard");
  await db.query("update chess_games set fen='late checkmate',moves=array['illegal'],status='finished',winner='white',end_reason='checkmate',version=1 where room_id=$1",[g.room_id]);
  const result=(await db.query('select * from chess_games')).rows[0];assert.equal(result.fen,g.fen);assert.deepEqual(result.moves,[]);assert.equal(result.winner,'black');assert.equal(result.end_reason,'timeout');
  const room=(await db.query("insert into chess_rooms(code,host_id) values('CASUAL',$1) returning id",[users[2]])).rows[0];
  await db.query('select start_chess_game($1)',[room.id]);
  const casual=(await db.query('select * from chess_games where room_id=$1',[room.id])).rows[0];assert.equal(casual.clock_started_at,null);assert.equal(casual.white_time_ms,null);assert.equal(casual.black_time_ms,null);
  await db.query("update chess_games set status='finished',version=10 where room_id=$1",[room.id]);
  await db.query("update chess_games set status='playing',version=0 where room_id=$1",[room.id]);
  const rematch=(await db.query('select * from chess_games where room_id=$1',[room.id])).rows[0];
  assert.equal(rematch.ranked_round,2);assert.equal(rematch.version,0);assert.equal(rematch.clock_started_at,null);
  await db.exec("select set_config('request.jwt.claim.role','authenticated',false)");
  await assert.rejects(db.query('select ranked_clock_snapshot($1)',[g.room_id]),/Service only/);
  await assert.rejects(act(2,crypto.randomUUID(),'queue'),/Service only/);
 }finally{await db.close()}
});
test('timeout draws against a bare king rather than granting an impossible win',async()=>{
 const {db,act}=await database();
 try {
  await act(0,crypto.randomUUID(),'queue');await act(1,crypto.randomUUID(),'queue');
  await db.exec("alter table chess_games disable trigger z_ranked_clock_guard; update chess_games set fen='4k3/8/8/8/8/8/4Q3/4K3 w - - 0 1',clock_started_at=clock_timestamp()-interval '301 seconds'; alter table chess_games enable trigger z_ranked_clock_guard");
  await db.exec('select maintain_ranked_chess()');const g=(await db.query('select * from chess_games')).rows[0];
  assert.equal(g.status,'finished');assert.equal(g.winner,'draw');assert.match(g.end_reason,/insufficient material/);assert.equal(g.white_time_ms,0);
 }finally{await db.close()}
});

test('queue session ownership, SQL privileges, and RLS protect other users',async()=>{
 const {db,act,users,count}=await database();
 try{
  const session=crypto.randomUUID();await act(0,session,'queue');
  await assert.rejects(act(1,session,'leaveQueue'),/Invalid queue session/);
  assert.equal(await count('ranked_chess_queue'),1);
  await act(1,crypto.randomUUID(),'leaveQueue');assert.equal(await count('ranked_chess_queue'),1);
  for(const role of ['anon','authenticated']){
   await db.exec('set role '+role);
   await assert.rejects(db.query('select ranked_queue_action($1,$2,$3)',[users[0],session,'leaveQueue']),/permission denied/);
   await assert.rejects(db.query('delete from ranked_chess_queue where user_id=$1',[users[0]]),/permission denied/);
   await assert.rejects(db.query('update ranked_chess_queue_sessions set active=false'),/permission denied/);
   await assert.rejects(db.query('select maintain_ranked_chess()'),/permission denied/);
   await assert.rejects(db.query('select start_queued_ranked_chess_game($1)',[users[0]]),/permission denied/);
   await assert.rejects(db.query('select ranked_clock_snapshot($1)',[users[0]]),/permission denied/);
   await db.exec('reset role');
  }
  assert.equal(await count('ranked_chess_queue'),1);
 }finally{await db.close()}
});
test('repeated timeout settlement awards Elo once and a rematch resets both clocks',async()=>{
 const {db,act}=await database();
 try{
  await act(0,crypto.randomUUID(),'queue');await act(1,crypto.randomUUID(),'queue');
  const g=(await db.query('select * from chess_games')).rows[0];
  await db.exec("alter table chess_games disable trigger z_ranked_clock_guard; update chess_games set clock_started_at=clock_timestamp()-interval '301 seconds'; alter table chess_games enable trigger z_ranked_clock_guard");
  await db.query('select ranked_clock_snapshot($1)',[g.room_id]);
  await db.query('select apply_verified_ranked_chess_result($1)',[g.room_id]);
  await db.query('select ranked_clock_snapshot($1)',[g.room_id]);
  assert.deepEqual((await db.query('select rated_games from chess_ratings order by user_id')).rows.map(r=>r.rated_games),[1,1]);
  assert.equal((await db.query('select count(*)::int n from ranked_chess_matches')).rows[0].n,1);
  await db.query("update chess_games set status='playing',winner=null,end_reason=null,version=0 where room_id=$1",[g.room_id]);
  const next=(await db.query('select * from chess_games')).rows[0];
  assert.equal(next.ranked_round,2);assert.equal(next.white_time_ms,300000);assert.equal(next.black_time_ms,300000);assert.ok(next.clock_started_at);
 }finally{await db.close()}
});
