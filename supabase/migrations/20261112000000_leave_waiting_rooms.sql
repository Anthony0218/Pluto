-- Accepting an invite while sitting in another room gives that seat up. A
-- player can leave a room that has not started yet: the seat opens again, the
-- next player becomes the host, and a room without players is removed. Once a
-- game runs the seat stays reserved for reconnecting, so these functions then
-- do nothing.
--
-- Every function also updates the room row, because the waiting rooms listen
-- for room updates and deleted player rows are not delivered to them.

/* =========================================================
   CLASSIC CHESS ROOMS
   ========================================================= */

create or replace function public.leave_chess_room(p_code text) returns void
language plpgsql security definer set search_path = '' as $$
declare
  v_room public.chess_rooms%rowtype;
begin
  if auth.uid() is null then raise exception 'Authentication required'; end if;

  select * into v_room from public.chess_rooms where code = upper(trim(p_code)) for update;
  if not found or v_room.match_kind::text <> 'casual' or v_room.status::text not in ('waiting', 'ready') then return; end if;

  delete from public.chess_room_players where room_id = v_room.id and user_id = auth.uid();
  if not found then return; end if;

  if not exists (select 1 from public.chess_room_players where room_id = v_room.id) then
    delete from public.chess_rooms where id = v_room.id;
    return;
  end if;

  -- The remaining player hosts from seat 0, so the next player joins in seat 1 again.
  update public.chess_room_players set seat = 0, ready = false where room_id = v_room.id;
  update public.chess_rooms
  set status = 'waiting',
      host_id = (select user_id from public.chess_room_players where room_id = v_room.id)
  where id = v_room.id;
end;
$$;

/* =========================================================
   CHESS VARIANT ROOMS (two players and Four Player)
   ========================================================= */

create or replace function public.leave_variant_room(p_code text) returns void
language plpgsql security definer set search_path = '' as $$
declare
  v_room public.variant_rooms%rowtype;
begin
  if auth.uid() is null then raise exception 'Authentication required'; end if;

  select * into v_room from public.variant_rooms where upper(code) = upper(trim(p_code)) for update;
  if not found or v_room.status <> 'waiting' then return; end if;

  delete from public.variant_room_players where room_id = v_room.id and user_id = auth.uid();
  if not found then return; end if;

  if not exists (select 1 from public.variant_room_players where room_id = v_room.id) then
    delete from public.variant_rooms where id = v_room.id;
    return;
  end if;

  -- Two-player rooms seat the joiner behind the host, so the remaining player moves up to seat 0.
  -- Four Player seats belong to a color and stay where they are.
  if v_room.max_players = 2 then
    update public.variant_room_players set seat = 0, ready = false where room_id = v_room.id;
  end if;
  update public.variant_rooms
  set host_id = (select user_id from public.variant_room_players where room_id = v_room.id order by seat limit 1)
  where id = v_room.id;
end;
$$;

/* =========================================================
   WATTEN ROOMS
   ========================================================= */

create or replace function public.leave_watten_room(p_code text) returns void
language plpgsql security definer set search_path = '' as $$
declare
  v_room public.watten_rooms%rowtype;
begin
  if auth.uid() is null then raise exception 'Authentication required'; end if;

  select * into v_room from public.watten_rooms where code = upper(trim(p_code)) for update;
  if not found or v_room.status <> 'waiting' then return; end if;

  delete from public.watten_room_players where room_id = v_room.id and user_id = auth.uid();
  if not found then return; end if;
  delete from public.watten_hands where room_id = v_room.id and user_id = auth.uid();

  if not exists (select 1 from public.watten_room_players where room_id = v_room.id) then
    delete from public.watten_rooms where id = v_room.id;
    return;
  end if;

  update public.watten_rooms
  set host_id = (select user_id from public.watten_room_players where room_id = v_room.id order by seat limit 1)
  where id = v_room.id;
end;
$$;

-- A third player joining deals the first round again, so a seat that opens here needs no further cleanup.
create or replace function public.leave_watten3_room(p_code text) returns void
language plpgsql security definer set search_path = '' as $$
declare
  v_room public.watten3_rooms%rowtype;
begin
  if auth.uid() is null then raise exception 'Authentication required'; end if;

  select * into v_room from public.watten3_rooms where code = upper(trim(p_code)) for update;
  if not found or v_room.status <> 'waiting' then return; end if;

  delete from public.watten3_room_players where room_id = v_room.id and user_id = auth.uid();
  if not found then return; end if;
  delete from public.watten3_hands where room_id = v_room.id and user_id = auth.uid();

  if not exists (select 1 from public.watten3_room_players where room_id = v_room.id) then
    delete from public.watten3_rooms where id = v_room.id;
    return;
  end if;

  update public.watten3_rooms
  set host_id = (select user_id from public.watten3_room_players where room_id = v_room.id order by seat limit 1)
  where id = v_room.id;
end;
$$;

revoke all on function public.leave_chess_room(text) from public, anon;
revoke all on function public.leave_variant_room(text) from public, anon;
revoke all on function public.leave_watten_room(text) from public, anon;
revoke all on function public.leave_watten3_room(text) from public, anon;
grant execute on function public.leave_chess_room(text) to authenticated;
grant execute on function public.leave_variant_room(text) to authenticated;
grant execute on function public.leave_watten_room(text) to authenticated;
grant execute on function public.leave_watten3_room(text) to authenticated;
