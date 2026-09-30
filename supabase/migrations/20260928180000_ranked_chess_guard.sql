-- Existing casual RPCs accept a client-supplied FEN/result. Ranked positions and
-- results may only be written by the validating ranked-chess Edge Function.
create function public.guard_ranked_chess_game() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if old.status = 'playing'
    and exists (select 1 from public.chess_rooms r where r.id = old.room_id and r.match_kind = 'ranked')
    and coalesce(auth.role(), '') <> 'service_role' then
    raise exception 'Ranked game changes must use the verified game service';
  end if;
  if old.status = 'finished' and new.status is distinct from old.status
    and exists (select 1 from public.chess_rooms r where r.id = old.room_id and r.match_kind = 'ranked')
    and not exists (select 1 from public.ranked_chess_matches m
      where m.source_id = old.room_id::text || ':' || old.ranked_round::text) then
    raise exception 'Settle the ranked result before starting a rematch';
  end if;
  if old.status = 'finished' and new.status is distinct from old.status
    and exists (select 1 from public.chess_rooms r where r.id = old.room_id and r.match_kind = 'ranked') then
    new.ranked_round := old.ranked_round + 1;
  end if;
  if old.status = 'finished' and new.status = 'finished'
    and exists (select 1 from public.chess_rooms r where r.id = old.room_id and r.match_kind = 'ranked')
    and coalesce(auth.role(), '') <> 'service_role'
    and (new.version is distinct from old.version or new.ranked_round is distinct from old.ranked_round
      or new.fen is distinct from old.fen
      or new.moves is distinct from old.moves or new.winner is distinct from old.winner
      or new.end_reason is distinct from old.end_reason) then
    raise exception 'Completed ranked result is immutable';
  end if;
  return new;
end; $$;
create trigger guard_ranked_chess_game_before_update before update on public.chess_games
  for each row execute function public.guard_ranked_chess_game();
revoke all on function public.guard_ranked_chess_game() from public, anon, authenticated;

create function public.guard_chess_room_match_kind() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if coalesce(auth.role(), '') <> 'service_role' then
    if tg_op = 'INSERT' and new.match_kind = 'ranked' then
      raise exception 'Only the ranked game service may create ranked rooms';
    elsif tg_op = 'UPDATE' and new.match_kind is distinct from old.match_kind then
      raise exception 'Only the ranked game service may change room kind';
    end if;
  end if;
  return new;
end; $$;
create trigger guard_chess_room_match_kind_before_update before update on public.chess_rooms
  for each row execute function public.guard_chess_room_match_kind();
create trigger guard_chess_room_match_kind_before_insert before insert on public.chess_rooms
  for each row execute function public.guard_chess_room_match_kind();
revoke all on function public.guard_chess_room_match_kind() from public, anon, authenticated;

-- Room-kind lookup lets the existing casual lobby reject ranked codes without
-- depending on the ranked Edge Function being deployed.
create function public.get_chess_room_match_kind(p_code text) returns text
language sql stable security definer set search_path = '' as $$
  select match_kind from public.chess_rooms
  where code = upper(btrim(p_code)) and status in ('waiting', 'ready')
  limit 1;
$$;
revoke all on function public.get_chess_room_match_kind(text) from public, anon;
grant execute on function public.get_chess_room_match_kind(text) to authenticated;
