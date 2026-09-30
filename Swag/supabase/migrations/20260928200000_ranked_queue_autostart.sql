-- A ranked match should start as soon as matchmaking fills both seats.
-- The Edge Function alone may invoke this wrapper. It uses the existing Chess
-- start routine so color assignment and game initialization stay in one place.
create function public.start_queued_ranked_chess_game(p_room_id uuid) returns void
language plpgsql security definer set search_path = '' as $$
declare
  v_room public.chess_rooms%rowtype;
  v_player_count integer;
  v_previous_sub text;
  v_status text;
begin
  if coalesce(auth.role(), '') <> 'service_role' then
    raise exception 'Only the ranked game service may start a queued match';
  end if;

  select * into v_room from public.chess_rooms where id = p_room_id for update;
  if not found or v_room.match_kind <> 'ranked' then
    raise exception 'Ranked room not found';
  end if;
  if v_room.status = 'playing' then return; end if;
  if v_room.status <> 'ready' then
    raise exception 'Ranked room is not ready (status: %)', v_room.status;
  end if;

  select count(*) into v_player_count from public.chess_room_players where room_id = p_room_id;
  if v_player_count <> 2 then
    raise exception 'Ranked room needs two players (found %)', v_player_count;
  end if;

  -- start_chess_game is the established initializer and checks the host with
  -- auth.uid(). Supply that identity only within this service-role transaction.
  v_previous_sub := current_setting('request.jwt.claim.sub', true);
  perform set_config('request.jwt.claim.sub', v_room.host_id::text, true);
  perform public.start_chess_game(p_room_id);
  perform set_config('request.jwt.claim.sub', coalesce(v_previous_sub, ''), true);

  select status into v_status from public.chess_rooms where id = p_room_id;
  if v_status <> 'playing' then
    raise exception 'Ranked game did not start (status: %)', v_status;
  end if;
end; $$;

revoke all on function public.start_queued_ranked_chess_game(uuid) from public, anon, authenticated;
grant execute on function public.start_queued_ranked_chess_game(uuid) to service_role;
