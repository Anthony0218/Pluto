import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {PGlite} from '@electric-sql/pglite';
const migration=await readFile(new URL('../supabase/migrations/20261027000000_security_hardening.sql',import.meta.url),'utf8');
const A='00000000-0000-4000-8000-000000000001',B='00000000-0000-4000-8000-000000000002',V='00000000-0000-4000-8000-000000000003';
// The legacy tables and their dashboard-made policies, as they exist in the live project before this migration.
const legacy=`create role anon;create role authenticated;create schema auth;
 create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('test.uid',true),'')::uuid$$;
 grant usage on schema auth to anon,authenticated;
 create table auth.users(id uuid primary key);insert into auth.users values('${A}'),('${B}'),('${V}');
 create table games(id uuid primary key default gen_random_uuid(),user_id uuid,name text,status text not null default 'waiting',white_user_id uuid,black_user_id uuid);
 create table game_moves(id bigint primary key);create table online_games(id uuid primary key);
 create table profiles(id uuid primary key,username text unique,display_name text,avatar_id text,avatar_url text,rating integer default 1200,wins integer default 0);
 create table friend_requests(id uuid primary key default gen_random_uuid(),sender_id uuid not null,receiver_id uuid not null,status text not null default 'pending',check(sender_id<>receiver_id));
 grant all on games,game_moves,online_games,profiles,friend_requests to anon,authenticated;
 alter table games enable row level security;alter table profiles enable row level security;alter table friend_requests enable row level security;
 create policy "Allow anyone to insert games" on games for insert to anon with check(true);
 create policy "Allow anyone to read games" on games for select to anon using(true);
 create policy "Allow delete games" on games for delete to anon using(true);
 create policy "Allow insert games" on games for insert to anon with check(true);
 create policy "Allow read games" on games for select to anon using(true);
 create policy "Allow update games" on games for update to anon using(true) with check(true);
 create policy "create game" on games for insert to public with check(auth.uid() is not null);
 create policy "join open game" on games for update to public using(status='waiting' and (white_user_id is null or black_user_id is null));
 create policy "read own or open games" on games for select to public using(white_user_id=auth.uid() or black_user_id=auth.uid() or status='waiting');
 create policy "Users can create their own games" on games for insert to public with check(auth.uid()=user_id);
 create policy "Users can delete their own games" on games for delete to public using(auth.uid()=user_id);
 create policy "Users can update their own games" on games for update to public using(auth.uid()=user_id);
 create policy "Users can view their own games" on games for select to public using(auth.uid()=user_id);
 create policy "Profiles are publicly readable" on profiles for select to public using(true);
 create policy "users can update own profile" on profiles for update to authenticated using(id=auth.uid()) with check(id=auth.uid());
 create policy "users can insert own profile" on profiles for insert to authenticated with check(id=auth.uid());
 create policy "participants can read friend requests" on friend_requests for select to authenticated using(sender_id=auth.uid() or receiver_id=auth.uid());
 create policy "receiver can update friend request" on friend_requests for update to authenticated using(receiver_id=auth.uid()) with check(receiver_id=auth.uid());
 create policy "users can send friend requests" on friend_requests for insert to authenticated with check(sender_id=auth.uid() and receiver_id<>auth.uid());
 insert into profiles(id,username) values('${A}','alice'),('${B}','bobby');
 insert into games(user_id,name) values('${A}','alice game');
 insert into friend_requests(sender_id,receiver_id) values('${B}','${A}');`;
const as=async(db,role,uid='')=>{await db.exec(`reset role;select set_config('test.uid','${uid}',false);set role ${role}`);};
test('legacy policies allowed the attacks this migration closes',async()=>{
 const db=new PGlite();
 try{
  await db.exec(legacy);
  await as(db,'anon');assert.equal((await db.query('select * from games')).rows.length,1);
  assert.equal((await db.query("update games set name='defaced' returning id")).rows.length,1);
  await as(db,'authenticated',A);assert.equal((await db.query('update profiles set rating=9999 where id=$1 returning id',[A])).rows.length,1);
  assert.equal((await db.query('update friend_requests set sender_id=$1 returning id',[V])).rows.length,1);
 }finally{await db.close();}
});
test('saved games, profile stats and friend requests are protected after hardening',async()=>{
 const db=new PGlite();
 try{
  await db.exec(legacy);await db.exec(migration);
  await as(db,'anon');await assert.rejects(db.query('select * from games'),/permission denied/);
  await assert.rejects(db.query("insert into games(name) values('spam')"),/permission denied/);
  assert.equal((await db.query('select username from profiles')).rows.length,2);
  await assert.rejects(db.query("update profiles set username='hacked'"),/permission denied/);
  await assert.rejects(db.query('insert into friend_requests(sender_id,receiver_id) values($1,$2)',[A,B]),/permission denied/);
  // Another signed-in player cannot see, edit, delete or impersonate the owner of a saved game.
  await as(db,'authenticated',B);assert.equal((await db.query('select * from games')).rows.length,0);
  assert.equal((await db.query("update games set name='defaced' returning id")).rows.length,0);
  assert.equal((await db.query('delete from games returning id')).rows.length,0);
  await assert.rejects(db.query('insert into games(user_id,name) values($1,$2)',[A,'forged']),/row-level security/);
  // The owner keeps every operation the client performs.
  await as(db,'authenticated',A);assert.equal((await db.query('select * from games')).rows.length,1);
  const {rows:[saved]}=await db.query('insert into games(user_id,name) values($1,$2) returning id',[A,'mine']);
  assert.equal((await db.query("update games set name='renamed' where id=$1 returning id",[saved.id])).rows.length,1);
  assert.equal((await db.query('delete from games where id=$1 returning id',[saved.id])).rows.length,1);
  // Profile: name and avatar only, within the same length rules the form enforces.
  assert.equal((await db.query("update profiles set username='alice2',avatar_id='fox' where id=$1 returning id",[A])).rows.length,1);
  assert.equal((await db.query("update profiles set username='nope' where id=$1 returning id",[B])).rows.length,0);
  for(const column of ['rating=9999','wins=500','avatar_url=\'https://tracker.example/p.png\'',`id='${V}'`])await assert.rejects(db.query(`update profiles set ${column} where id=$1`,[A]),/permission denied/);
  await assert.rejects(db.query('update profiles set username=$2 where id=$1',[A,'x']),/profiles_username_length/);
  await assert.rejects(db.query('update profiles set username=$2 where id=$1',[A,'x'.repeat(31)]),/profiles_username_length/);
  await assert.rejects(db.query('insert into profiles(id,username) values($1,$2)',[V,'victim']),/permission denied/);
  // Friend requests: send as yourself, pending only; never rewrite or delete directly.
  await assert.rejects(db.query('update friend_requests set sender_id=$1',[V]),/permission denied/);
  await assert.rejects(db.query("update friend_requests set status='accepted'"),/permission denied/);
  await assert.rejects(db.query('delete from friend_requests'),/permission denied/);
  await assert.rejects(db.query("insert into friend_requests(sender_id,receiver_id,status) values($1,$2,'accepted')",[A,V]),/row-level security/);
  await assert.rejects(db.query('insert into friend_requests(sender_id,receiver_id) values($1,$2)',[B,V]),/row-level security/);
  assert.equal((await db.query('insert into friend_requests(sender_id,receiver_id) values($1,$2) returning id',[A,V])).rows.length,1);
 }finally{await db.close();}
});
const followup=await readFile(new URL('../supabase/migrations/20261028000000_security_hardening_followup.sql',import.meta.url),'utf8');
// Tables, policies and functions the follow-up migration touches, in their live pre-migration shape.
const followupLegacy=`create role anon;create role authenticated;create role service_role;create schema auth;create schema extensions;
 create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('test.uid',true),'')::uuid$$;
 grant usage on schema auth to anon,authenticated;
 create table friend_requests(id uuid primary key default gen_random_uuid(),sender_id uuid not null,receiver_id uuid not null,status text not null default 'pending',created_at timestamptz not null default now());
 create table friend_messages(id uuid primary key default gen_random_uuid(),sender_id uuid not null,receiver_id uuid not null,message_type text not null,created_at timestamptz not null default now());
 create table watten3_rooms(id uuid primary key default gen_random_uuid(),code text,host_id uuid,status text default 'waiting');
 create table watten3_room_players(room_id uuid,user_id uuid,seat integer,primary key(room_id,user_id));
 create table watten3_games(room_id uuid primary key,phase text);
 create table online_games(id uuid primary key default gen_random_uuid(),white_player uuid,black_player uuid);
 grant all on friend_requests,friend_messages,watten3_rooms,watten3_room_players,watten3_games,online_games to anon,authenticated;
 alter table friend_requests enable row level security;alter table friend_messages enable row level security;alter table watten3_rooms enable row level security;
 alter table watten3_room_players enable row level security;alter table watten3_games enable row level security;alter table online_games enable row level security;
 create policy send on friend_requests for insert to authenticated with check(sender_id=auth.uid());
 create policy read on friend_requests for select to authenticated using(sender_id=auth.uid() or receiver_id=auth.uid());
 create policy send on friend_messages for insert to authenticated with check(sender_id=auth.uid());
 create policy read on friend_messages for select to authenticated using(sender_id=auth.uid() or receiver_id=auth.uid());
 create function is_watten3_room_member(p_room uuid) returns boolean language sql stable security definer set search_path='' as $$select exists(select 1 from public.watten3_room_players p where p.room_id=p_room and p.user_id=auth.uid())$$;
 create policy "watten3 members can view rooms" on watten3_rooms for select to authenticated using(host_id=auth.uid() or is_watten3_room_member(id));
 create policy "watten3 users can create rooms" on watten3_rooms for insert to authenticated with check(host_id=auth.uid());
 create policy "watten3 host can update room" on watten3_rooms for update to authenticated using(host_id=auth.uid()) with check(host_id=auth.uid());
 create policy "watten3 host can delete room" on watten3_rooms for delete to authenticated using(host_id=auth.uid());
 create policy "watten3 members can view room players" on watten3_room_players for select to authenticated using(is_watten3_room_member(room_id));
 create policy "watten3 users can insert themselves" on watten3_room_players for insert to authenticated with check(user_id=auth.uid());
 create policy "watten3 users can update themselves" on watten3_room_players for update to authenticated using(user_id=auth.uid()) with check(user_id=auth.uid());
 create policy "watten3 users can delete themselves" on watten3_room_players for delete to authenticated using(user_id=auth.uid());
 create policy "watten3 games authenticated read" on watten3_games for select to authenticated using(true);
 create policy "watten3 members read game" on watten3_games for select to authenticated using(exists(select 1 from watten3_room_players p where p.room_id=watten3_games.room_id and p.user_id=auth.uid()));
 create policy "Authenticated users can view online games" on online_games for select to authenticated using(true);
 create function create_watten3_room() returns uuid language plpgsql security definer set search_path='' as $$declare r uuid;begin
  if auth.uid() is null then raise exception 'Sign in';end if;
  insert into public.watten3_rooms(code,host_id) values('ABC123',auth.uid()) returning id into r;insert into public.watten3_room_players values(r,auth.uid(),0);insert into public.watten3_games values(r,'waiting');return r;end$$;
 create function list_chess_custom_community() returns integer language sql security definer set search_path='' as $$select 1$$;
 create function service_only() returns integer language sql security definer set search_path='' as $$select 1$$;
 revoke all on function service_only() from public,anon,authenticated;grant execute on function service_only() to service_role;
 create function via_public_only() returns integer language sql security definer set search_path='' as $$select 1$$;
 create function handle_new_user() returns trigger language plpgsql security definer set search_path='' as $$begin return new;end$$;
 create function watten_rank(p text) returns integer language sql immutable as $$select length(p)$$;
 insert into online_games(white_player,black_player) values('${A}','${B}');`;
const can=async(db,role,fn)=>(await db.query('select has_function_privilege($1,$2,$3) ok',[role,fn,'execute'])).rows[0].ok;
test('follow-up hardening limits spam, closes direct Watten writes and hides privileged functions from visitors',async()=>{
 const db=new PGlite();
 try{
  await db.exec(followupLegacy);
  assert.equal(await can(db,'anon','create_watten3_room()'),true);
  await db.exec(followup);
  // Visitors keep the public read function and lose every other privileged one; other roles are unchanged.
  assert.equal(await can(db,'anon','list_chess_custom_community()'),true);
  for(const fn of ['create_watten3_room()','is_watten3_room_member(uuid)','via_public_only()','service_only()','limit_friend_requests()'])assert.equal(await can(db,'anon',fn),false,fn);
  for(const fn of ['create_watten3_room()','is_watten3_room_member(uuid)','via_public_only()'])assert.equal(await can(db,'authenticated',fn),true,fn);
  assert.equal(await can(db,'authenticated','service_only()'),false);assert.equal(await can(db,'service_role','service_only()'),true);
  assert.equal(await can(db,'anon','handle_new_user()'),true);
  assert.match((await db.query("select array_to_string(proconfig,',') c from pg_proc where proname='watten_rank'")).rows[0].c,/search_path=public, extensions, pg_temp/);
  assert.equal((await db.query("select watten_rank('Ober') n")).rows[0].n,4);
  // 3-player Watten: the room functions still work, direct writes do not, and outsiders see nothing.
  await as(db,'authenticated',A);const room=(await db.query('select create_watten3_room() id')).rows[0].id;
  assert.equal((await db.query('select * from watten3_rooms')).rows.length,1);assert.equal((await db.query('select * from watten3_games')).rows.length,1);
  await assert.rejects(db.query("update watten3_rooms set status='playing'"),/permission denied/);
  await assert.rejects(db.query('update watten3_room_players set seat=2'),/permission denied/);
  await assert.rejects(db.query('delete from watten3_room_players'),/permission denied/);
  await as(db,'authenticated',B);await assert.rejects(db.query('insert into watten3_room_players values($1,$2,1)',[room,B]),/permission denied/);
  assert.equal((await db.query('select * from watten3_games')).rows.length,0);
  assert.equal((await db.query('select * from online_games')).rows.length,1);
  await as(db,'authenticated',V);assert.equal((await db.query('select * from online_games')).rows.length,0);
  // Spam limits: 30 friend requests an hour and 30 friend messages a minute, and timestamps cannot be backdated.
  await as(db,'authenticated',A);
  for(let i=0;i<30;i++)await db.query("insert into friend_requests(sender_id,receiver_id,created_at) values($1,gen_random_uuid(),now()-interval '2 hours')",[A]);
  await assert.rejects(db.query('insert into friend_requests(sender_id,receiver_id) values($1,$2)',[A,B]),/Too many friend requests/);
  for(let i=0;i<30;i++)await db.query("insert into friend_messages(sender_id,receiver_id,message_type) values($1,$2,'hey')",[A,B]);
  await assert.rejects(db.query("insert into friend_messages(sender_id,receiver_id,message_type) values($1,$2,'hey')",[A,B]),/Slow down a little/);
  // Another sender is unaffected, and the window reopens once older rows age out.
  await as(db,'authenticated',B);assert.equal((await db.query("insert into friend_messages(sender_id,receiver_id,message_type) values($1,$2,'hey') returning id",[B,A])).rows.length,1);
  await db.exec("reset role;update friend_messages set created_at=now()-interval '2 minutes'");
  await as(db,'authenticated',A);assert.equal((await db.query("insert into friend_messages(sender_id,receiver_id,message_type) values($1,$2,'hey') returning id",[A,B])).rows.length,1);
 }finally{await db.close();}
});
const rooms=await readFile(new URL('../supabase/migrations/20261029000000_private_chess_rooms.sql',import.meta.url),'utf8');
// Chess and variant room tables with their live "any signed-in user" read policies, plus the dependent variant_games policy.
const roomsLegacy=`create role anon;create role authenticated;create role service_role;create schema auth;
 create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('test.uid',true),'')::uuid$$;
 grant usage on schema auth to anon,authenticated;
 create table chess_rooms(id uuid primary key default gen_random_uuid(),code text unique,host_id uuid not null,status text default 'waiting');
 create table chess_room_players(room_id uuid not null,user_id uuid not null,seat smallint,primary key(room_id,user_id));
 create table chess_games(room_id uuid primary key,fen text);
 create table variant_rooms(id uuid primary key default gen_random_uuid(),code text unique,host_id uuid not null,variant text);
 create table variant_room_players(room_id uuid not null,user_id uuid not null,seat integer,primary key(room_id,user_id));
 create table variant_games(room_id uuid primary key,fen text);
 grant select on chess_rooms,chess_room_players,chess_games,variant_rooms,variant_room_players,variant_games to anon,authenticated;
 alter table chess_rooms enable row level security;alter table chess_room_players enable row level security;alter table chess_games enable row level security;
 alter table variant_rooms enable row level security;alter table variant_room_players enable row level security;alter table variant_games enable row level security;
 create policy "Authenticated users can read chess rooms" on chess_rooms for select to authenticated using(true);
 create policy "Authenticated users can read chess players" on chess_room_players for select to authenticated using(true);
 create policy "Authenticated users can read chess games" on chess_games for select to authenticated using(true);
 create policy "variant rooms visible to authenticated users" on variant_rooms for select to authenticated using(true);
 create policy "variant room players visible to authenticated users" on variant_room_players for select to authenticated using(true);
 create policy "variant games visible to room players" on variant_games for select to authenticated using(exists(select 1 from variant_room_players p where p.room_id=variant_games.room_id and p.user_id=auth.uid()));
 create function create_chess_room() returns text language plpgsql security definer set search_path='' as $$declare r uuid;begin
  insert into public.chess_rooms(code,host_id) values('CHESS1',auth.uid()) returning id into r;insert into public.chess_room_players values(r,auth.uid(),0);insert into public.chess_games values(r,'start');return 'CHESS1';end$$;
 create function join_chess_room(p_code text) returns text language plpgsql security definer set search_path='' as $$declare r uuid;begin
  select id into r from public.chess_rooms where code=p_code;if r is null then raise exception 'Room not found';end if;
  insert into public.chess_room_players values(r,auth.uid(),1);return p_code;end$$;
 create function create_variant_room() returns text language plpgsql security definer set search_path='' as $$declare r uuid;begin
  insert into public.variant_rooms(code,host_id,variant) values('VARI01',auth.uid(),'boss') returning id into r;insert into public.variant_room_players values(r,auth.uid(),0);insert into public.variant_games values(r,'start');return 'VARI01';end$$;
 create function join_variant_room(p_code text) returns text language plpgsql security definer set search_path='' as $$declare r uuid;begin
  select id into r from public.variant_rooms where code=p_code;if r is null then raise exception 'Room not found';end if;
  insert into public.variant_room_players values(r,auth.uid(),1);return p_code;end$$;`;
const visible=async db=>Object.fromEntries(await Promise.all(['chess_rooms','chess_room_players','chess_games','variant_rooms','variant_room_players','variant_games'].map(async table=>[table,(await db.query(`select * from ${table}`)).rows.length])));
test('chess and variant rooms are visible only to their players, and joining by code still works',async()=>{
 const db=new PGlite();
 try{
  await db.exec(roomsLegacy);
  await as(db,'authenticated',A);await db.query('select create_chess_room()');await db.query('select create_variant_room()');
  // Before: a stranger can list every room, its code and its players.
  await as(db,'authenticated',V);assert.deepEqual(await visible(db),{chess_rooms:1,chess_room_players:1,chess_games:1,variant_rooms:1,variant_room_players:1,variant_games:0});
  await db.exec('reset role');await db.exec(rooms);
  await as(db,'authenticated',V);assert.deepEqual(await visible(db),{chess_rooms:0,chess_room_players:0,chess_games:0,variant_rooms:0,variant_room_players:0,variant_games:0});
  assert.equal((await db.query("select * from chess_rooms where code='CHESS1'")).rows.length,0);
  await as(db,'anon');await assert.rejects(db.query("select is_chess_room_member(gen_random_uuid())"),/permission denied/);
  // The host sees the whole table before and after an opponent joins by code.
  await as(db,'authenticated',A);assert.deepEqual(await visible(db),{chess_rooms:1,chess_room_players:1,chess_games:1,variant_rooms:1,variant_room_players:1,variant_games:1});
  await as(db,'authenticated',B);await db.query("select join_chess_room('CHESS1')");await db.query("select join_variant_room('VARI01')");
  assert.deepEqual(await visible(db),{chess_rooms:1,chess_room_players:2,chess_games:1,variant_rooms:1,variant_room_players:2,variant_games:1});
  await as(db,'authenticated',A);assert.equal((await db.query('select * from chess_room_players')).rows.length,2);assert.equal((await db.query('select * from variant_room_players')).rows.length,2);
  // A second, unrelated room stays hidden from the first room's players.
  await as(db,'authenticated',V);await db.exec("reset role;insert into chess_rooms(code,host_id) values('OTHER1','"+V+"')");
  await as(db,'authenticated',V);assert.equal((await db.query('select * from chess_rooms')).rows.length,1);
  await as(db,'authenticated',A);assert.deepEqual((await db.query('select code from chess_rooms')).rows,[{code:'CHESS1'}]);
 }finally{await db.close();}
});
