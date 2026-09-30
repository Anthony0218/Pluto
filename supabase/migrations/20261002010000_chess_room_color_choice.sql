-- Casual chess rooms: each player can pick a color in the room before the game
-- starts. The choice is stored as a preference; the game page applies it with
-- the existing choose_chess_side RPC as soon as the board opens, so no side
-- selection is needed while playing. Ranked colors stay assigned by the service.
alter table public.chess_room_players
  add column if not exists preferred_color text check (preferred_color in ('white', 'black'));

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

  update public.chess_room_players set preferred_color = p_color
  where room_id = p_room_id and user_id = auth.uid();
end;
$$;
revoke all on function public.set_chess_room_color(uuid, text) from public, anon;
grant execute on function public.set_chess_room_color(uuid, text) to authenticated;
