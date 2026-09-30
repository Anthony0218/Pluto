-- Casual chess rooms (classic and two-player variants) are set up in the room:
-- the host defaults to Black and the joiner to White, either player can clear
-- their color so the opponent may take it, and both players must pick a color
-- and press Ready before the host can start. Colors are fixed when the game
-- starts, so nothing has to be chosen on the board. Ranked rooms and Four
-- Player rooms keep their own color assignment.

alter table public.chess_room_players
  add column if not exists ready boolean not null default false;

alter table public.variant_room_players
  add column if not exists ready boolean not null default false;

/* =========================================================
   CLASSIC CHESS ROOMS
   ========================================================= */

create or replace function public.create_chess_room(p_display_name text) returns text
language plpgsql security definer set search_path = 'public' as $$
declare
  v_user_id uuid := auth.uid();
  v_room_id uuid;
  v_code text;
begin
  if v_user_id is null then raise exception 'Authentication required'; end if;

  loop
    v_code := upper(substring(replace(gen_random_uuid()::text, '-', '') from 1 for 6));
    exit when not exists (select 1 from chess_rooms where code = v_code);
  end loop;

  insert into chess_rooms (code, host_id, status)
  values (v_code, v_user_id, 'waiting')
  returning id into v_room_id;

  insert into chess_room_players (room_id, user_id, seat, display_name, preferred_color)
  values (v_room_id, v_user_id, 0, coalesce(nullif(trim(p_display_name), ''), 'White'), 'black');

  insert into chess_games (room_id, status) values (v_room_id, 'waiting');

  return v_code;
end;
$$;

create or replace function public.join_chess_room(p_code text, p_display_name text) returns text
language plpgsql security definer set search_path = 'public' as $$
declare
  v_user_id uuid := auth.uid();
  v_room chess_rooms%rowtype;
  v_host_color text;
begin
  if v_user_id is null then raise exception 'Authentication required'; end if;

  select * into v_room from chess_rooms where code = upper(trim(p_code)) for update;
  if not found then raise exception 'Room not found'; end if;

  if exists (select 1 from chess_room_players where room_id = v_room.id and user_id = v_user_id) then
    return v_room.code;
  end if;

  if v_room.status <> 'waiting' then raise exception 'Room is not available'; end if;
  if (select count(*) from chess_room_players where room_id = v_room.id) >= 2 then
    raise exception 'Room is full';
  end if;

  select preferred_color into v_host_color from chess_room_players where room_id = v_room.id;

  insert into chess_room_players (room_id, user_id, seat, display_name, preferred_color)
  values (
    v_room.id,
    v_user_id,
    1,
    coalesce(nullif(trim(p_display_name), ''), 'Black'),
    case when v_host_color = 'white' then 'black' else 'white' end
  );

  update chess_rooms set status = 'ready' where id = v_room.id;

  return v_room.code;
end;
$$;

create or replace function public.set_chess_room_color(p_room_id uuid, p_color text) returns void
language plpgsql security definer set search_path = '' as $$
declare
  v_room public.chess_rooms%rowtype;
begin
  if auth.uid() is null then raise exception 'Authentication required'; end if;
  if p_color is not null and p_color not in ('white', 'black') then raise exception 'Invalid color'; end if;

  select * into v_room from public.chess_rooms where id = p_room_id for update;
  if not found then raise exception 'Room not found'; end if;
  if v_room.match_kind::text <> 'casual' then raise exception 'Ranked colors are assigned automatically'; end if;
  if v_room.status::text not in ('waiting', 'ready') then raise exception 'The game has already started'; end if;
  if not exists (select 1 from public.chess_room_players where room_id = p_room_id and user_id = auth.uid()) then
    raise exception 'You are not in this room';
  end if;
  if p_color is not null and exists (
    select 1 from public.chess_room_players
    where room_id = p_room_id and user_id <> auth.uid() and preferred_color = p_color
  ) then raise exception 'That color is already taken'; end if;

  -- A new color has to be confirmed again.
  update public.chess_room_players set preferred_color = p_color, ready = false
  where room_id = p_room_id and user_id = auth.uid();
end;
$$;

create or replace function public.set_chess_room_ready(p_room_id uuid, p_ready boolean) returns void
language plpgsql security definer set search_path = '' as $$
declare
  v_room public.chess_rooms%rowtype;
  v_player public.chess_room_players%rowtype;
begin
  if auth.uid() is null then raise exception 'Authentication required'; end if;

  select * into v_room from public.chess_rooms where id = p_room_id for update;
  if not found then raise exception 'Room not found'; end if;
  if v_room.match_kind::text <> 'casual' then raise exception 'Ranked games start automatically'; end if;
  if v_room.status::text not in ('waiting', 'ready') then raise exception 'The game has already started'; end if;

  select * into v_player from public.chess_room_players where room_id = p_room_id and user_id = auth.uid();
  if not found then raise exception 'You are not in this room'; end if;
  if coalesce(p_ready, false) and v_player.preferred_color is null then
    raise exception 'Choose a color before you get ready';
  end if;

  update public.chess_room_players set ready = coalesce(p_ready, false)
  where room_id = p_room_id and user_id = auth.uid();
end;
$$;

create or replace function public.start_chess_game(p_room_id uuid) returns void
language plpgsql security definer set search_path = 'public' as $$
declare
  v_room chess_rooms%rowtype;
  v_white chess_room_players%rowtype;
  v_black chess_room_players%rowtype;
begin
  select * into v_room from chess_rooms where id = p_room_id for update;
  if not found then raise exception 'Room not found'; end if;
  if v_room.host_id is distinct from auth.uid() then raise exception 'Only the host can start the game'; end if;
  if (select count(*) from chess_room_players where room_id = p_room_id) <> 2 then
    raise exception 'Two players are required';
  end if;

  -- Ranked colors are assigned by start_queued_ranked_chess_game after this call.
  if v_room.match_kind = 'casual' then
    if exists (select 1 from chess_room_players where room_id = p_room_id and not ready) then
      raise exception 'Both players must be ready';
    end if;

    select * into v_white from chess_room_players where room_id = p_room_id and preferred_color = 'white';
    select * into v_black from chess_room_players where room_id = p_room_id and preferred_color = 'black';
    if v_white.user_id is null or v_black.user_id is null then
      raise exception 'Each player needs a different color';
    end if;

    -- Moves are validated by seat (0 = White). Swap seats like choose_chess_side:
    -- (room_id, seat) is unique, so the Black row is reinserted afterwards.
    if v_white.seat <> 0 then
      delete from chess_room_players where room_id = p_room_id and user_id = v_black.user_id;
      update chess_room_players set seat = 0 where room_id = p_room_id and user_id = v_white.user_id;
      v_black.seat := 1;
      insert into chess_room_players select (v_black).*;
    end if;

    update chess_room_players set chosen_color = preferred_color where room_id = p_room_id;
  end if;

  update chess_rooms set status = 'playing' where id = p_room_id;
  update chess_games set status = 'playing' where room_id = p_room_id;
end;
$$;

revoke all on function public.set_chess_room_ready(uuid, boolean) from public, anon;
grant execute on function public.set_chess_room_ready(uuid, boolean) to authenticated;

/* =========================================================
   TWO-PLAYER VARIANT ROOMS
   ========================================================= */

-- Shared join step: the joiner takes the color the host left free (White by
-- default) and the room stays in the waiting phase until the host starts it.
create or replace function public.join_waiting_variant_room(p_code text, p_variant text, p_display_name text)
returns public.variant_rooms
language plpgsql security definer set search_path = '' as $$
declare
  v_user_id uuid := auth.uid();
  v_room public.variant_rooms%rowtype;
  v_other_color text;
  v_seat integer;
begin
  if v_user_id is null then raise exception 'Authentication required'; end if;

  select * into v_room from public.variant_rooms where upper(code) = upper(trim(p_code)) for update;
  if not found then raise exception 'Room not found'; end if;
  if v_room.variant <> p_variant then raise exception 'This room belongs to another chess variant'; end if;

  if exists (select 1 from public.variant_room_players where room_id = v_room.id and user_id = v_user_id) then
    return v_room;
  end if;

  if v_room.status <> 'waiting' then raise exception 'Room is no longer accepting players'; end if;
  if (select count(*) from public.variant_room_players where room_id = v_room.id) >= 2 then
    raise exception 'Room is full';
  end if;

  select chosen_color into v_other_color from public.variant_room_players where room_id = v_room.id order by seat limit 1;
  select coalesce(max(seat), -1) + 1 into v_seat from public.variant_room_players where room_id = v_room.id;

  insert into public.variant_room_players (room_id, user_id, seat, display_name, chosen_color)
  values (
    v_room.id,
    v_user_id,
    v_seat,
    coalesce(nullif(trim(p_display_name), ''), 'Player'),
    case when v_other_color = 'white' then 'black' else 'white' end
  );

  return v_room;
end;
$$;
revoke all on function public.join_waiting_variant_room(text, text, text) from public, anon, authenticated;

create or replace function public.join_variant_room(p_code text, p_expected_variant text, p_display_name text default 'Player')
returns text language plpgsql security definer set search_path = '' as $$
begin
  return (public.join_waiting_variant_room(p_code, p_expected_variant, p_display_name)).code;
end;
$$;

create or replace function public.join_boss_variant_room(p_code text, p_display_name text default 'Player')
returns uuid language plpgsql security definer set search_path = '' as $$
begin
  return (public.join_waiting_variant_room(p_code, 'boss', p_display_name)).id;
end;
$$;

create or replace function public.join_capitalism_variant_room(p_code text, p_display_name text default 'Player')
returns uuid language plpgsql security definer set search_path = '' as $$
begin
  return (public.join_waiting_variant_room(p_code, 'capitalism', p_display_name)).id;
end;
$$;

create or replace function public.join_collapse_variant_room(p_code text, p_display_name text default 'Player')
returns uuid language plpgsql security definer set search_path = '' as $$
begin
  return (public.join_waiting_variant_room(p_code, 'collapse', p_display_name)).id;
end;
$$;

create or replace function public.join_horror_variant_room(p_code text, p_display_name text default 'Player')
returns uuid language plpgsql security definer set search_path = '' as $$
begin
  return (public.join_waiting_variant_room(p_code, 'horror', p_display_name)).id;
end;
$$;

create or replace function public.join_hot_potato_variant_room(p_code text, p_display_name text default 'Player')
returns uuid language plpgsql security definer set search_path = '' as $$
begin
  return (public.join_waiting_variant_room(p_code, 'hot-potato', p_display_name)).id;
end;
$$;

-- Draft armies are created by start_variant_room once both colors are final.
create or replace function public.join_draft_variant_room(p_code text, p_display_name text default 'Player')
returns text language plpgsql security definer set search_path = '' as $$
begin
  return (public.join_waiting_variant_room(p_code, 'draft', p_display_name)).code;
end;
$$;

create or replace function public.set_variant_room_color(p_room_id uuid, p_color text) returns void
language plpgsql security definer set search_path = '' as $$
declare
  v_room public.variant_rooms%rowtype;
begin
  if auth.uid() is null then raise exception 'Authentication required'; end if;
  if p_color is not null and p_color not in ('white', 'black') then raise exception 'Invalid color'; end if;

  select * into v_room from public.variant_rooms where id = p_room_id for update;
  if not found then raise exception 'Room not found'; end if;
  if v_room.max_players <> 2 then raise exception 'This room does not use White and Black'; end if;
  if v_room.status <> 'waiting' then raise exception 'The game has already started'; end if;
  if not exists (select 1 from public.variant_room_players where room_id = p_room_id and user_id = auth.uid()) then
    raise exception 'You are not in this room';
  end if;
  if p_color is not null and exists (
    select 1 from public.variant_room_players
    where room_id = p_room_id and user_id <> auth.uid() and chosen_color = p_color
  ) then raise exception 'That color is already taken'; end if;

  update public.variant_room_players set chosen_color = p_color, ready = false
  where room_id = p_room_id and user_id = auth.uid();
end;
$$;

create or replace function public.set_variant_room_ready(p_room_id uuid, p_ready boolean) returns void
language plpgsql security definer set search_path = '' as $$
declare
  v_room public.variant_rooms%rowtype;
  v_player public.variant_room_players%rowtype;
begin
  if auth.uid() is null then raise exception 'Authentication required'; end if;

  select * into v_room from public.variant_rooms where id = p_room_id for update;
  if not found then raise exception 'Room not found'; end if;
  if v_room.max_players <> 2 then raise exception 'This room does not use White and Black'; end if;
  if v_room.status <> 'waiting' then raise exception 'The game has already started'; end if;

  select * into v_player from public.variant_room_players where room_id = p_room_id and user_id = auth.uid();
  if not found then raise exception 'You are not in this room'; end if;
  if coalesce(p_ready, false) and v_player.chosen_color is null then
    raise exception 'Choose a color before you get ready';
  end if;

  update public.variant_room_players set ready = coalesce(p_ready, false)
  where room_id = p_room_id and user_id = auth.uid();
end;
$$;

create or replace function public.start_variant_room(p_room_id uuid) returns void
language plpgsql security definer set search_path = '' as $$
declare
  v_room public.variant_rooms%rowtype;
begin
  if auth.uid() is null then raise exception 'Authentication required'; end if;

  select * into v_room from public.variant_rooms where id = p_room_id for update;
  if not found then raise exception 'Room not found'; end if;
  if v_room.host_id <> auth.uid() then raise exception 'Only the host can start the game'; end if;
  if v_room.max_players <> 2 then raise exception 'This room does not use White and Black'; end if;
  if v_room.status <> 'waiting' then raise exception 'The game has already started'; end if;
  if (select count(*) from public.variant_room_players where room_id = p_room_id) <> 2 then
    raise exception 'Two players are required';
  end if;
  if exists (select 1 from public.variant_room_players where room_id = p_room_id and not ready) then
    raise exception 'Both players must be ready';
  end if;
  if (
    select count(distinct chosen_color) from public.variant_room_players
    where room_id = p_room_id and chosen_color in ('white', 'black')
  ) <> 2 then
    raise exception 'Each player needs a different color';
  end if;

  update public.variant_rooms set status = 'playing' where id = p_room_id;

  if v_room.variant = 'draft' then
    -- Draft stays in its setup phase; each player drafts the army of their final color.
    delete from public.variant_draft_private where room_id = p_room_id;
    insert into public.variant_draft_private (room_id, user_id, side, placements, confirmed)
    select room_id, user_id, case when chosen_color = 'white' then 'w' else 'b' end, '[]'::jsonb, false
    from public.variant_room_players where room_id = p_room_id;
  elsif v_room.variant = 'fog-of-war' then
    update public.fog_multiplayer_games set status = 'playing', updated_at = now() where room_id = p_room_id;
  else
    update public.variant_games set status = 'playing', updated_at = now() where room_id = p_room_id;
  end if;
end;
$$;

revoke all on function public.set_variant_room_color(uuid, text) from public, anon;
revoke all on function public.set_variant_room_ready(uuid, boolean) from public, anon;
revoke all on function public.start_variant_room(uuid) from public, anon;
grant execute on function public.set_variant_room_color(uuid, text) to authenticated;
grant execute on function public.set_variant_room_ready(uuid, boolean) to authenticated;
grant execute on function public.start_variant_room(uuid) to authenticated;
