-- Ranked clocks wait until both players have drawn their color card. A short
-- deadline still starts the clock, so an absent player cannot stall the match.
alter table public.chess_games
  add column ranked_cards_drawn uuid[] not null default '{}',
  add column ranked_draw_deadline timestamptz;

create or replace function public.ranked_clock_guard() returns trigger language plpgsql security definer set search_path='' as $$
declare stamp timestamptz:=clock_timestamp(); elapsed double precision; remaining double precision; side text;
begin
  -- Casual rematches also restart versions. Reuse the existing round counter
  -- so optimistic clients can distinguish a new game from a delayed snapshot.
  if tg_op='UPDATE' and old.status='finished' and new.status is distinct from old.status then
    new.ranked_round:=old.ranked_round+1;
  end if;
  if not exists(select 1 from public.chess_rooms where id=new.room_id and match_kind='ranked') then
    new.white_time_ms:=null; new.black_time_ms:=null; new.clock_started_at:=null;
    new.ranked_cards_drawn:='{}'; new.ranked_draw_deadline:=null; return new;
  end if;
  -- A new ranked round starts with both clocks full and paused until the cards are drawn.
  if tg_op='INSERT' or (old.status<>'playing' and new.status='playing') then
    new.white_time_ms:=300000; new.black_time_ms:=300000; new.clock_started_at:=null;
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

create or replace function public.ranked_clock_snapshot(p_room_id uuid) returns jsonb
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
  -- A card left face down past the deadline no longer holds the clock.
  if g.status='playing' and g.clock_started_at is null and stamp>=coalesce(g.ranked_draw_deadline,stamp) then
    update public.chess_games set version=version+1 where room_id=p_room_id returning * into g;
  end if;
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

-- Records a player's card. The second card starts the clock through the guard.
create function public.ranked_draw_card(p_room_id uuid, p_user uuid) returns jsonb
language plpgsql security definer set search_path='' as $$
declare g public.chess_games%rowtype;
begin
  if coalesce(auth.role(),'')<>'service_role' then raise exception 'Service only'; end if;
  perform pg_advisory_xact_lock(hashtextextended(p_room_id::text, 0));
  if not exists(select 1 from public.chess_room_players where room_id=p_room_id and user_id=p_user) then
    raise exception 'Join the room before playing';
  end if;
  -- Once the clock runs, a late card changes nothing and must not bump the move version.
  update public.chess_games set ranked_cards_drawn=array_append(ranked_cards_drawn,p_user), version=version+1
    where room_id=p_room_id and status='playing' and clock_started_at is null and not (p_user=any(ranked_cards_drawn))
    returning * into g;
  if not found then
    select * into g from public.chess_games where room_id=p_room_id;
    if not found then raise exception 'Game not started'; end if;
  end if;
  return jsonb_build_object('game',to_jsonb(g),'serverNow',clock_timestamp());
end; $$;
revoke all on function public.ranked_draw_card(uuid,uuid) from public,anon,authenticated;
grant execute on function public.ranked_draw_card(uuid,uuid) to service_role;

-- Independent maintenance handles absent browsers; reads/moves also enforce deadlines.
create or replace function public.maintain_ranked_chess() returns void language plpgsql security definer set search_path='' as $$
declare item record; previous_role text:=current_setting('request.jwt.claim.role',true);
begin
  perform set_config('request.jwt.claim.role','service_role',true);
  perform pg_advisory_xact_lock(hashtextextended('ranked-queue',0));
  delete from public.ranked_chess_queue where last_seen_at<clock_timestamp()-interval '12 seconds';
  delete from public.ranked_chess_queue_sessions where touched_at<clock_timestamp()-interval '1 day';
  for item in select g.room_id from public.chess_games g join public.chess_rooms r on r.id=g.room_id
    where r.match_kind='ranked' and g.status='playing' and (
      (g.clock_started_at is null and clock_timestamp()>=coalesce(g.ranked_draw_deadline,clock_timestamp()))
      or (g.clock_started_at is not null and extract(epoch from clock_timestamp()-g.clock_started_at)*1000 >=
        case split_part(g.fen,' ',2) when 'w' then g.white_time_ms else g.black_time_ms end))
  loop perform public.ranked_clock_snapshot(item.room_id); end loop;
  perform set_config('request.jwt.claim.role',coalesce(previous_role,''),true);
end; $$;
revoke all on function public.maintain_ranked_chess() from public,anon,authenticated;
grant execute on function public.maintain_ranked_chess() to service_role;
