-- Ensure the ranked game column exists before replacing the guard that reads it.
alter table public.chess_games add column if not exists ranked_round integer not null default 1
  check (ranked_round >= 1);

create or replace function public.guard_ranked_chess_game() returns trigger
language plpgsql security definer set search_path = '' as $$
declare
  v_old_round integer;
begin
  -- Reading the row as JSON avoids a stale trigger row descriptor raising
  -- "record old has no field ranked_round" during a schema change.
  v_old_round := coalesce((to_jsonb(old)->>'ranked_round')::integer, 1);

  if old.status = 'playing'
    and exists (select 1 from public.chess_rooms r where r.id = old.room_id and r.match_kind = 'ranked')
    and coalesce(auth.role(), '') <> 'service_role' then
    raise exception 'Ranked game changes must use the verified game service';
  end if;
  if old.status = 'finished' and new.status is distinct from old.status
    and exists (select 1 from public.chess_rooms r where r.id = old.room_id and r.match_kind = 'ranked')
    and not exists (select 1 from public.ranked_chess_matches m
      where m.source_id = old.room_id::text || ':' || v_old_round::text) then
    raise exception 'Settle the ranked result before starting a rematch';
  end if;
  if old.status = 'finished' and new.status is distinct from old.status
    and exists (select 1 from public.chess_rooms r where r.id = old.room_id and r.match_kind = 'ranked') then
    new.ranked_round := v_old_round + 1;
  end if;
  if old.status = 'finished' and new.status = 'finished'
    and exists (select 1 from public.chess_rooms r where r.id = old.room_id and r.match_kind = 'ranked')
    and coalesce(auth.role(), '') <> 'service_role'
    and (new.version is distinct from old.version or new.ranked_round is distinct from v_old_round
      or new.fen is distinct from old.fen
      or new.moves is distinct from old.moves or new.winner is distinct from old.winner
      or new.end_reason is distinct from old.end_reason) then
    raise exception 'Completed ranked result is immutable';
  end if;
  return new;
end; $$;
