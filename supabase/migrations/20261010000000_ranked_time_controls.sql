-- Ranked chess offers four time controls: Bullet 1+0, Blitz 3+0, Rapid 5+0 and
-- Classical 10+0. Each has its own queue, clock and Elo. Existing rooms,
-- ratings and matches were all played at Rapid 5+0.
alter table public.chess_rooms add column time_control text not null default 'rapid'
  check (time_control in ('bullet','blitz','rapid','classical'));

alter table public.chess_ratings add column time_control text not null default 'rapid'
  check (time_control in ('bullet','blitz','rapid','classical'));
alter table public.chess_ratings drop constraint chess_ratings_pkey;
alter table public.chess_ratings add primary key (user_id, time_control);
drop index public.chess_ratings_leaderboard_idx;
create index chess_ratings_leaderboard_idx on public.chess_ratings(time_control, rating desc, rated_games desc, user_id);

alter table public.ranked_chess_matches add column time_control text not null default 'rapid'
  check (time_control in ('bullet','blitz','rapid','classical'));

alter table public.ranked_chess_queue add column time_control text not null default 'rapid'
  check (time_control in ('bullet','blitz','rapid','classical'));

create function public.ranked_initial_clock_ms(p_time_control text) returns double precision
language sql immutable set search_path = '' as $$
  select (case p_time_control when 'bullet' then 60000 when 'blitz' then 180000
    when 'classical' then 600000 else 300000 end)::double precision;
$$;

-- Same guard as before; a new round starts with the room's time control.
create or replace function public.ranked_clock_guard() returns trigger language plpgsql security definer set search_path='' as $$
declare stamp timestamptz:=clock_timestamp(); elapsed double precision; remaining double precision; side text;
  v_initial double precision;
begin
  -- Casual rematches also restart versions. Reuse the existing round counter
  -- so optimistic clients can distinguish a new game from a delayed snapshot.
  if tg_op='UPDATE' and old.status='finished' and new.status is distinct from old.status then
    new.ranked_round:=old.ranked_round+1;
  end if;
  select public.ranked_initial_clock_ms(r.time_control) into v_initial
    from public.chess_rooms r where r.id=new.room_id and r.match_kind='ranked';
  if v_initial is null then
    new.white_time_ms:=null; new.black_time_ms:=null; new.clock_started_at:=null;
    new.ranked_cards_drawn:='{}'; new.ranked_draw_deadline:=null; return new;
  end if;
  -- A new ranked round starts with both clocks full and paused until the cards are drawn.
  if tg_op='INSERT' or (old.status<>'playing' and new.status='playing') then
    new.white_time_ms:=v_initial; new.black_time_ms:=v_initial; new.clock_started_at:=null;
    new.ranked_cards_drawn:='{}';
    new.ranked_draw_deadline:=case when new.status='playing' then stamp+interval '30 seconds' else null end;
    return new;
  end if;
  new.white_time_ms:=old.white_time_ms; new.black_time_ms:=old.black_time_ms; new.clock_started_at:=old.clock_started_at;
  new.ranked_draw_deadline:=old.ranked_draw_deadline;
  -- Only the game service records drawn cards.
  if coalesce(auth.role(),'')<>'service_role' then new.ranked_cards_drawn:=old.ranked_cards_drawn; end if;
  if old.status='playing' and old.clock_started_at is null then
    -- No time runs while the cards are face down. Both cards, the deadline or a move start it.
    if new.status='playing' and (cardinality(new.ranked_cards_drawn)>=2
      or stamp>=coalesce(old.ranked_draw_deadline,stamp) or new.fen is distinct from old.fen) then
      new.clock_started_at:=stamp;
    end if;
    return new;
  end if;
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
revoke all on function public.ranked_clock_guard() from public,anon,authenticated;

-- Ratings move only within the room's time control.
create or replace function public.apply_verified_ranked_chess_result(p_room_id uuid) returns void
language plpgsql security definer set search_path = '' as $$
declare g public.chess_games%rowtype; w uuid; b uuid; wr public.chess_ratings%rowtype;
  br public.chess_ratings%rowtype; w_score numeric; b_score numeric;
  w_next integer; b_next integer; v_source text; v_time_control text;
begin
  perform pg_advisory_xact_lock(hashtextextended(p_room_id::text, 0));
  select time_control into v_time_control from public.chess_rooms where id = p_room_id and match_kind = 'ranked';
  if v_time_control is null then raise exception 'Not a ranked room'; end if;
  select * into g from public.chess_games where room_id = p_room_id for update;
  if not found or g.status <> 'finished' or g.winner not in ('white','black','draw') then
    raise exception 'Ranked game is not eligible';
  end if;
  select user_id into w from public.chess_room_players where room_id = p_room_id and chosen_color = 'white';
  select user_id into b from public.chess_room_players where room_id = p_room_id and chosen_color = 'black';
  if w is null or b is null or w = b then raise exception 'Ranked game needs two players'; end if;
  v_source := p_room_id::text || ':' || g.ranked_round::text;
  if exists (select 1 from public.ranked_chess_matches where source_id = v_source) then return; end if;
  insert into public.chess_ratings(user_id, time_control) values (w, v_time_control), (b, v_time_control) on conflict do nothing;
  perform 1 from public.chess_ratings where user_id in (w,b) and time_control = v_time_control order by user_id for update;
  select * into wr from public.chess_ratings where user_id = w and time_control = v_time_control;
  select * into br from public.chess_ratings where user_id = b and time_control = v_time_control;
  w_score := case g.winner when 'white' then 1 when 'draw' then 0.5 else 0 end;
  b_score := 1 - w_score;
  w_next := greatest(100, round(wr.rating + (case when wr.rated_games < 20 then 32 else 20 end) *
    (w_score - 1 / (1 + power(10, (br.rating - wr.rating)::numeric / 400)))))::integer;
  b_next := greatest(100, round(br.rating + (case when br.rated_games < 20 then 32 else 20 end) *
    (b_score - 1 / (1 + power(10, (wr.rating - br.rating)::numeric / 400)))))::integer;
  insert into public.ranked_chess_matches(source_id, room_id, white_id, black_id, result,
    white_before, white_after, black_before, black_after, time_control)
    values (v_source, p_room_id, w, b, g.winner, wr.rating, w_next, br.rating, b_next, v_time_control);
  update public.chess_ratings set rating = w_next, peak_rating = greatest(peak_rating, w_next),
    rated_games = rated_games + 1, updated_at = now() where user_id = w and time_control = v_time_control;
  update public.chess_ratings set rating = b_next, peak_rating = greatest(peak_rating, b_next),
    rated_games = rated_games + 1, updated_at = now() where user_id = b and time_control = v_time_control;
end; $$;
revoke all on function public.apply_verified_ranked_chess_result(uuid) from public, anon, authenticated;
grant execute on function public.apply_verified_ranked_chess_result(uuid) to service_role;

drop function public.get_chess_elo_leaderboard();
create function public.get_chess_elo_leaderboard(p_time_control text default 'rapid') returns table
  (rank bigint, user_id uuid, username text, avatar_id text, rating integer, rated_games integer)
language sql stable security invoker set search_path = '' as $$
  select row_number() over (order by r.rating desc, r.rated_games desc, r.user_id)::bigint,
    r.user_id, coalesce(p.display_name, p.username, 'Player')::text,
    p.avatar_id::text, r.rating, r.rated_games
  from public.chess_ratings r join public.profiles p on p.id = r.user_id
  where r.rated_games > 0 and r.time_control = p_time_control
  order by r.rating desc, r.rated_games desc, r.user_id limit 10;
$$;
revoke all on function public.get_chess_elo_leaderboard(text) from public, anon;
grant execute on function public.get_chess_elo_leaderboard(text) to authenticated;

-- Players are paired only within one time control, by that control's Elo.
-- Queueing again with another control moves the waiting entry to it.
drop function public.ranked_queue_action(uuid,uuid,text,text);
create function public.ranked_queue_action(p_user uuid, p_session uuid, p_op text, p_name text default 'Player',
  p_time_control text default 'rapid')
returns jsonb language plpgsql security definer set search_path = '' as $$
declare own public.ranked_chess_queue%rowtype; candidate public.ranked_chess_queue%rowtype;
  v_rating integer; v_code text; room_id uuid; previous_sub text; v_time_control text;
begin
  if coalesce(auth.role(), '') <> 'service_role' then raise exception 'Service only'; end if;
  if p_op not in ('queue', 'queueStatus', 'leaveQueue') then raise exception 'Unknown queue operation'; end if;
  if p_time_control is null or p_time_control not in ('bullet','blitz','rapid','classical') then
    raise exception 'Unknown time control';
  end if;
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
  select r.code, r.time_control into v_code, v_time_control from public.chess_rooms r
    join public.chess_room_players p on p.room_id=r.id
    join public.chess_games g on g.room_id=r.id
    where p.user_id=p_user and r.match_kind='ranked' and g.status='playing' limit 1;
  if v_code is not null then return jsonb_build_object('status','matched','code',v_code,'timeControl',v_time_control); end if;
  delete from public.ranked_chess_queue where claimed_by is null and last_seen_at < clock_timestamp()-interval '12 seconds';
  select * into own from public.ranked_chess_queue where user_id=p_user;
  if own.claimed_by is not null then
    select id into room_id from public.chess_rooms where public.chess_rooms.code=own.room_code and status='playing';
    if room_id is not null then
      return jsonb_build_object('status','matched','code',own.room_code,'timeControl',own.time_control);
    end if;
    delete from public.ranked_chess_queue where user_id=p_user;
    own := null;
  end if;
  if own.user_id is not null and own.session_id is distinct from p_session then
    if p_op='queueStatus' then return jsonb_build_object('status','idle'); end if;
    update public.ranked_chess_queue_sessions set active=false where id=own.session_id;
    update public.ranked_chess_queue set session_id=p_session where user_id=p_user;
  end if;
  if own.user_id is null and p_op='queueStatus' then return jsonb_build_object('status','idle'); end if;
  -- A status poll keeps searching in the control the player queued for.
  v_time_control := case when own.user_id is not null and p_op='queueStatus' then own.time_control else p_time_control end;
  select coalesce((select r.rating from public.chess_ratings r where user_id=p_user and time_control=v_time_control),1200) into v_rating;
  if own.user_id is not null and own.time_control <> v_time_control then
    update public.chess_rooms set time_control=v_time_control where code=own.room_code and host_id=p_user;
    update public.ranked_chess_queue set time_control=v_time_control, rating=v_rating, joined_at=clock_timestamp()
      where user_id=p_user;
  end if;
  previous_sub := current_setting('request.jwt.claim.sub',true);
  perform set_config('request.jwt.claim.sub',p_user::text,true);
  select q.* into candidate from public.ranked_chess_queue q
    join public.ranked_chess_queue_sessions s on s.id=q.session_id and s.active
    where q.user_id<>p_user and q.claimed_by is null and q.time_control=v_time_control
    and q.last_seen_at>=clock_timestamp()-interval '12 seconds'
    and abs(q.rating-v_rating)<=250+floor(extract(epoch from clock_timestamp()-q.joined_at)/60)*100
    order by q.joined_at limit 1;
  if candidate.user_id is not null then
    perform public.join_chess_room(candidate.room_code,left(coalesce(nullif(btrim(p_name),''),'Player'),30));
    insert into public.ranked_chess_queue(user_id,room_code,rating,session_id,last_seen_at,time_control)
      values(p_user,candidate.room_code,v_rating,p_session,clock_timestamp(),v_time_control)
      on conflict(user_id) do update set room_code=excluded.room_code,session_id=excluded.session_id,
        last_seen_at=excluded.last_seen_at,time_control=excluded.time_control;
    update public.ranked_chess_queue set room_code=candidate.room_code,claimed_by=p_user,claimed_at=clock_timestamp()
      where user_id in (p_user,candidate.user_id);
    select r.id into room_id from public.chess_rooms r where r.code=candidate.room_code;
    perform public.start_queued_ranked_chess_game(room_id);
    perform set_config('request.jwt.claim.sub',coalesce(previous_sub,''),true);
    return jsonb_build_object('status','matched','code',candidate.room_code,'timeControl',v_time_control);
  end if;
  if own.user_id is null then
    v_code := public.create_chess_room(left(coalesce(nullif(btrim(p_name),''),'Player'),30));
    update public.chess_rooms set match_kind='ranked', time_control=v_time_control
      where public.chess_rooms.code=v_code and host_id=p_user;
    insert into public.ranked_chess_queue(user_id,room_code,rating,session_id,time_control)
      values(p_user,v_code,v_rating,p_session,v_time_control);
  end if;
  update public.ranked_chess_queue set last_seen_at=clock_timestamp() where user_id=p_user;
  perform set_config('request.jwt.claim.sub',coalesce(previous_sub,''),true);
  return jsonb_build_object('status','waiting','timeControl',v_time_control);
end; $$;
revoke all on function public.ranked_queue_action(uuid,uuid,text,text,text) from public,anon,authenticated;
grant execute on function public.ranked_queue_action(uuid,uuid,text,text,text) to service_role;
