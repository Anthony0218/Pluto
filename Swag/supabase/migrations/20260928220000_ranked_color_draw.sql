-- Ranked colors are assigned once by the game service. The two face-down
-- cards reveal that assignment to each player; client RPCs cannot change it.
create or replace function public.start_queued_ranked_chess_game(p_room_id uuid) returns void
language plpgsql security definer set search_path = '' as $$
declare
  v_room public.chess_rooms%rowtype;
  v_player_count integer;
  v_previous_sub text;
  v_status text;
  v_first_white boolean;
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

  v_previous_sub := current_setting('request.jwt.claim.sub', true);
  perform set_config('request.jwt.claim.sub', v_room.host_id::text, true);
  perform public.start_chess_game(p_room_id);
  perform set_config('request.jwt.claim.sub', coalesce(v_previous_sub, ''), true);

  -- Keep seats stable because several existing room controls use seat numbers.
  -- The validated ranked game service uses chosen_color for move ownership.
  v_first_white := random() < 0.5;
  update public.chess_room_players set chosen_color = null where room_id = p_room_id;
  update public.chess_room_players
  set chosen_color = case
    when seat = 0 then case when v_first_white then 'white' else 'black' end
    else case when v_first_white then 'black' else 'white' end
  end
  where room_id = p_room_id;

  select status into v_status from public.chess_rooms where id = p_room_id;
  if v_status <> 'playing' then
    raise exception 'Ranked game did not start (status: %)', v_status;
  end if;
end; $$;

create function public.guard_ranked_chess_colors() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if (new.chosen_color is distinct from old.chosen_color or new.seat is distinct from old.seat)
    and exists (select 1 from public.chess_rooms r where r.id = old.room_id and r.match_kind = 'ranked')
    and coalesce(auth.role(), '') <> 'service_role' then
    raise exception 'Ranked colors are assigned by the game service';
  end if;
  return new;
end; $$;
create trigger guard_ranked_chess_colors_before_update before update on public.chess_room_players
  for each row execute function public.guard_ranked_chess_colors();
revoke all on function public.guard_ranked_chess_colors() from public, anon, authenticated;
