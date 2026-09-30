-- Queue mutations share one short transaction: departure cannot race a claim/start.
alter table public.ranked_chess_queue add column session_id uuid;
create table public.ranked_chess_queue_sessions (
  id uuid primary key, user_id uuid not null references auth.users(id) on delete cascade,
  active boolean not null default true, touched_at timestamptz not null default now()
);
alter table public.ranked_chess_queue_sessions enable row level security;
revoke all on public.ranked_chess_queue_sessions from public, anon, authenticated;
grant select,insert,update,delete on public.ranked_chess_queue_sessions to service_role;

create function public.ranked_queue_action(p_user uuid, p_session uuid, p_op text, p_name text default 'Player')
returns jsonb language plpgsql security definer set search_path = '' as $$
declare own public.ranked_chess_queue%rowtype; candidate public.ranked_chess_queue%rowtype;
  v_rating integer; v_code text; room_id uuid; previous_sub text;
begin
  if coalesce(auth.role(), '') <> 'service_role' then raise exception 'Service only'; end if;
  if p_op not in ('queue', 'queueStatus', 'leaveQueue') then raise exception 'Unknown queue operation'; end if;
  perform pg_advisory_xact_lock(hashtextextended('ranked-queue', 0));
  insert into public.ranked_chess_queue_sessions(id,user_id,active)
    values(p_session,p_user,p_op <> 'leaveQueue') on conflict do nothing;
  if not exists(select 1 from public.ranked_chess_queue_sessions where id=p_session and user_id=p_user) then
    raise exception 'Invalid queue session';
  end if;
  if p_op = 'leaveQueue' then
    update public.ranked_chess_queue_sessions set active=false,touched_at=clock_timestamp() where id=p_session;
    -- A queue record is only a routing receipt once matched. Never delete a game.
    delete from public.ranked_chess_queue where user_id=p_user and session_id=p_session;
    return jsonb_build_object('status','idle');
  end if;
  if not exists(select 1 from public.ranked_chess_queue_sessions where id=p_session and active) then
    return jsonb_build_object('status','idle'); -- delayed join after pagehide
  end if;
  update public.ranked_chess_queue_sessions set touched_at=clock_timestamp() where id=p_session;
  select r.code into v_code from public.chess_rooms r join public.chess_room_players p on p.room_id=r.id
    join public.chess_games g on g.room_id=r.id
    where p.user_id=p_user and r.match_kind='ranked' and g.status='playing' limit 1;
  if v_code is not null then return jsonb_build_object('status','matched','code',v_code); end if;
  delete from public.ranked_chess_queue where claimed_by is null and last_seen_at < clock_timestamp()-interval '12 seconds';
  select * into own from public.ranked_chess_queue where user_id=p_user;
  if own.claimed_by is not null then
    select id into room_id from public.chess_rooms where public.chess_rooms.code=own.room_code and status='playing';
    if room_id is not null then return jsonb_build_object('status','matched','code',own.room_code); end if;
    delete from public.ranked_chess_queue where user_id=p_user;
    own := null;
  end if;
  if own.user_id is not null and own.session_id is distinct from p_session then
    if p_op='queueStatus' then return jsonb_build_object('status','idle'); end if;
    update public.ranked_chess_queue_sessions set active=false where id=own.session_id;
    update public.ranked_chess_queue set session_id=p_session where user_id=p_user;
  end if;
  if own.user_id is null and p_op='queueStatus' then return jsonb_build_object('status','idle'); end if;
  select coalesce((select r.rating from public.chess_ratings r where user_id=p_user),1200) into v_rating;
  previous_sub := current_setting('request.jwt.claim.sub',true);
  perform set_config('request.jwt.claim.sub',p_user::text,true);
  select q.* into candidate from public.ranked_chess_queue q
    join public.ranked_chess_queue_sessions s on s.id=q.session_id and s.active
    where q.user_id<>p_user and q.claimed_by is null and q.last_seen_at>=clock_timestamp()-interval '12 seconds'
    and abs(q.rating-v_rating)<=250+floor(extract(epoch from clock_timestamp()-q.joined_at)/60)*100
    order by q.joined_at limit 1;
  if candidate.user_id is not null then
    perform public.join_chess_room(candidate.room_code,left(coalesce(nullif(btrim(p_name),''),'Player'),30));
    insert into public.ranked_chess_queue(user_id,room_code,rating,session_id,last_seen_at)
      values(p_user,candidate.room_code,v_rating,p_session,clock_timestamp())
      on conflict(user_id) do update set room_code=excluded.room_code,session_id=excluded.session_id,last_seen_at=excluded.last_seen_at;
    update public.ranked_chess_queue set room_code=candidate.room_code,claimed_by=p_user,claimed_at=clock_timestamp()
      where user_id in (p_user,candidate.user_id);
    select r.id into room_id from public.chess_rooms r where r.code=candidate.room_code;
    perform public.start_queued_ranked_chess_game(room_id);
    perform set_config('request.jwt.claim.sub',coalesce(previous_sub,''),true);
    return jsonb_build_object('status','matched','code',candidate.room_code);
  end if;
  if own.user_id is null then
    v_code := public.create_chess_room(left(coalesce(nullif(btrim(p_name),''),'Player'),30));
    update public.chess_rooms set match_kind='ranked' where public.chess_rooms.code=v_code and host_id=p_user;
    insert into public.ranked_chess_queue(user_id,room_code,rating,session_id) values(p_user,v_code,v_rating,p_session);
  end if;
  update public.ranked_chess_queue set last_seen_at=clock_timestamp() where user_id=p_user;
  perform set_config('request.jwt.claim.sub',coalesce(previous_sub,''),true);
  return jsonb_build_object('status','waiting');
end; $$;
revoke all on function public.ranked_queue_action(uuid,uuid,text,text) from public,anon,authenticated;
grant execute on function public.ranked_queue_action(uuid,uuid,text,text) to service_role;

alter table public.chess_games add column white_time_ms double precision,
  add column black_time_ms double precision, add column clock_started_at timestamptz;
-- Initialize existing ranked games once at rollout; casual clocks remain NULL.
do $$ declare previous_role text:=current_setting('request.jwt.claim.role',true); begin
  perform set_config('request.jwt.claim.role','service_role',true);
  update public.chess_games g set white_time_ms=300000,black_time_ms=300000,
    clock_started_at=case when g.status='playing' then clock_timestamp() else null end
    from public.chess_rooms r where r.id=g.room_id and r.match_kind='ranked';
  perform set_config('request.jwt.claim.role',coalesce(previous_role,''),true);
end $$;
-- Runs in the same transaction as a move, including the compare-and-swap version check.
create function public.ranked_clock_guard() returns trigger language plpgsql security definer set search_path='' as $$
declare stamp timestamptz:=clock_timestamp(); elapsed double precision; remaining double precision; side text;
begin
  -- Casual rematches also restart versions. Reuse the existing round counter
  -- so optimistic clients can distinguish a new game from a delayed snapshot.
  if tg_op='UPDATE' and old.status='finished' and new.status is distinct from old.status then
    new.ranked_round:=old.ranked_round+1;
  end if;
  if not exists(select 1 from public.chess_rooms where id=new.room_id and match_kind='ranked') then
    new.white_time_ms:=null; new.black_time_ms:=null; new.clock_started_at:=null; return new;
  end if;
  if tg_op='INSERT' then
    new.white_time_ms:=300000; new.black_time_ms:=300000;
    new.clock_started_at:=case when new.status='playing' then stamp else null end; return new;
  end if;
  if old.status<>'playing' and new.status='playing' then
    new.white_time_ms:=300000; new.black_time_ms:=300000; new.clock_started_at:=stamp; return new;
  end if;
  new.white_time_ms:=old.white_time_ms; new.black_time_ms:=old.black_time_ms; new.clock_started_at:=old.clock_started_at;
  if old.status<>'playing' or old.clock_started_at is null then return new; end if;
  elapsed:=greatest(0,extract(epoch from stamp-old.clock_started_at)*1000);
  side:=split_part(old.fen,' ',2);
  remaining:=greatest(0,(case side when 'w' then old.white_time_ms else old.black_time_ms end)-elapsed);
  if remaining<=0 then
    -- A move arriving after flag fall cannot resurrect the position or win on mate.
    new.fen:=old.fen; new.moves:=old.moves; new.last_move_from:=old.last_move_from; new.last_move_to:=old.last_move_to;
    new.status:='finished'; new.winner:=case side when 'w' then 'black' else 'white' end;
    new.end_reason:='timeout'; new.version:=old.version+1;
    -- A bare opposing king can never give mate (FIDE 6.9). Dead-material
    -- positions are otherwise ended by chess.js at the preceding valid move.
    if (side='w' and split_part(old.fen,' ',1) !~ '[qrbnp]') or
       (side='b' and split_part(old.fen,' ',1) !~ '[QRBNP]') then
      new.winner:='draw'; new.end_reason:='timeout / insufficient material';
    end if;
    new.undo_requested_by:=null; new.undo_requested_version:=null;
  end if;
  if new.fen is distinct from old.fen or new.status='finished' then
    if side='w' then new.white_time_ms:=remaining; else new.black_time_ms:=remaining; end if;
    new.clock_started_at:=case when new.status='playing' then stamp else null end;
  end if;
  return new;
end; $$;
create trigger z_ranked_clock_guard before insert or update on public.chess_games for each row execute function public.ranked_clock_guard();
revoke all on function public.ranked_clock_guard() from public,anon,authenticated;

create function public.ranked_clock_snapshot(p_room_id uuid) returns jsonb
language plpgsql security definer set search_path='' as $$
declare g public.chess_games%rowtype; stamp timestamptz; elapsed double precision;
begin
  if coalesce(auth.role(),'')<>'service_role' then raise exception 'Service only'; end if;
  -- Result settlement takes this advisory lock before the game row. Keep the
  -- same order so a clock read and a concurrent settlement cannot deadlock.
  perform pg_advisory_xact_lock(hashtextextended(p_room_id::text, 0));
  select * into g from public.chess_games where room_id=p_room_id for update;
  if not found then raise exception 'Game not started'; end if;
  stamp:=clock_timestamp();
  if g.status='playing' and g.clock_started_at is not null then
    elapsed:=greatest(0,extract(epoch from stamp-g.clock_started_at)*1000);
    if elapsed >= (case split_part(g.fen,' ',2) when 'w' then g.white_time_ms else g.black_time_ms end) then
      update public.chess_games set version=version+1 where room_id=p_room_id returning * into g;
    end if;
  end if;
  if g.status='finished' then
    update public.chess_rooms set status='finished' where id=p_room_id and status<>'finished';
    perform public.apply_verified_ranked_chess_result(p_room_id);
  end if;
  return jsonb_build_object('game',to_jsonb(g),'serverNow',stamp);
end; $$;
revoke all on function public.ranked_clock_snapshot(uuid) from public,anon,authenticated;
grant execute on function public.ranked_clock_snapshot(uuid) to service_role;

-- Independent maintenance handles absent browsers; reads/moves also enforce deadlines.
create function public.maintain_ranked_chess() returns void language plpgsql security definer set search_path='' as $$
declare item record; previous_role text:=current_setting('request.jwt.claim.role',true);
begin
  perform set_config('request.jwt.claim.role','service_role',true);
  perform pg_advisory_xact_lock(hashtextextended('ranked-queue',0));
  delete from public.ranked_chess_queue where last_seen_at<clock_timestamp()-interval '12 seconds';
  delete from public.ranked_chess_queue_sessions where touched_at<clock_timestamp()-interval '1 day';
  for item in select g.room_id from public.chess_games g join public.chess_rooms r on r.id=g.room_id
    where r.match_kind='ranked' and g.status='playing' and g.clock_started_at is not null
    and extract(epoch from clock_timestamp()-g.clock_started_at)*1000 >=
      case split_part(g.fen,' ',2) when 'w' then g.white_time_ms else g.black_time_ms end
  loop perform public.ranked_clock_snapshot(item.room_id); end loop;
  perform set_config('request.jwt.claim.role',coalesce(previous_role,''),true);
end; $$;
revoke all on function public.maintain_ranked_chess() from public,anon,authenticated;
grant execute on function public.maintain_ranked_chess() to service_role;
create extension if not exists pg_cron;
select cron.schedule('ranked-chess-maintenance','5 seconds','select public.maintain_ranked_chess()');

-- Standard multiplayer now sends move intent to the existing validating service.
-- Retire the legacy client-supplied FEN move RPC without affecting undo/rooms/variants.
do $$ declare f record; begin
  for f in select p.oid::regprocedure as signature from pg_proc p join pg_namespace n on n.oid=p.pronamespace
    where n.nspname='public' and p.proname='play_chess_move'
  loop execute format('revoke execute on function %s from public, anon, authenticated',f.signature); end loop;
end $$;
