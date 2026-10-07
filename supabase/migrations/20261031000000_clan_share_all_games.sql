-- Clans can share a lobby of any multiplayer game, not only chess and Go. The invite card shows "Lobby full"
-- (and cannot be joined) once the lobby has no seat left or the game has started.
alter table public.community_game_invites drop constraint if exists community_game_invites_game_check;
alter table public.community_game_invites add constraint community_game_invites_game_check
  check (game in ('chess', 'go', 'shogi', 'watten', 'schafkopf', 'atlas-arena', 'eat-it', 'pluto-party', 'chess-variant', 'chess-custom'));
-- Where the lobby lives, so members join through the game's own join route (which still checks seats itself).
alter table public.community_game_invites add column if not exists game_route text
  check (game_route is null or game_route ~ '^/[a-z0-9/_-]{1,80}$');

-- "open" while someone can still take a seat, "full" when nobody can, "ended" when the room is gone or finished.
-- Games whose rooms are not readable here (Watten, Pluto Party) stay "open": their lobby refuses joins itself.
create function public.community_lobby_status(p_game text, p_code text) returns text
language plpgsql security definer set search_path = '' as $$
declare
  v_code text := upper(btrim(p_code));
  v_players integer;
  v_status text;
  v_capacity integer;
begin
  if p_game = 'schafkopf' then
    select jsonb_array_length(players), case when game is not null then 'playing' else 'waiting' end into v_players, v_status
      from public.schafkopf_rooms where code = v_code;
    if not found then return 'ended'; end if;
    return case when v_status <> 'waiting' or v_players >= 4 then 'full' else 'open' end;
  elsif p_game = 'atlas-arena' then
    select jsonb_array_length(players), status, coalesce((settings->>'maxPlayers')::integer, 2) into v_players, v_status, v_capacity
      from public.atlas_matches where room_code = v_code;
    if not found or v_status in ('finished', 'cancelled') then return 'ended'; end if;
    return case when v_status <> 'waiting' or v_players >= v_capacity then 'full' else 'open' end;
  elsif p_game = 'eat-it' then
    select jsonb_array_length(players), status, coalesce((settings->>'count')::integer, 8) into v_players, v_status, v_capacity
      from public.eat_it_matches where room_code = v_code;
    if not found or v_status = 'finished' then return 'ended'; end if;
    return case when v_status <> 'waiting' or v_players >= v_capacity then 'full' else 'open' end;
  elsif p_game = 'chess-custom' then
    select case when guest_id is not null then 1 else 0 end, status into v_players, v_status
      from public.chess_custom_matches where code = v_code;
    if not found or v_status = 'finished' then return 'ended'; end if;
    return case when v_status <> 'waiting' or v_players >= 1 then 'full' else 'open' end;
  elsif p_game = 'chess-variant' then
    select r.status, case when r.variant = 'four-player' then 4 else 2 end, (select count(*)::integer from public.variant_room_players p where p.room_id = r.id)
      into v_status, v_capacity, v_players from public.variant_rooms r where upper(r.code) = v_code;
    if not found or v_status = 'finished' then return 'ended'; end if;
    return case when v_status <> 'waiting' or v_players >= v_capacity then 'full' else 'open' end;
  end if;
  return 'open';
end; $$;
revoke all on function public.community_lobby_status(text, text) from public, anon, authenticated;

create function public.share_community_game_room(p_group_id uuid, p_game text, p_game_route text, p_room_code text) returns uuid
language plpgsql security definer set search_path = '' as $$
declare
  result uuid;
  v_code text := upper(btrim(p_room_code));
  v_route_pattern text;
begin
  v_route_pattern := case p_game
    when 'watten' then '^/games/watten/multiplayer/[34]$'
    when 'schafkopf' then '^/games/schafkopf/multiplayer$'
    when 'atlas-arena' then '^/games/atlas-arena/multiplayer$'
    when 'eat-it' then '^/games/eat-it/multiplayer$'
    when 'pluto-party' then '^/games/pluto-party$'
    when 'chess-variant' then '^/games/chess/variants/[a-z0-9-]+/multiplayer$'
    when 'chess-custom' then '^/chess-custom/play/multiplayer$'
    else null end;
  if v_route_pattern is null or p_game_route is null or p_game_route !~ v_route_pattern then raise exception 'Unsupported game'; end if;
  if v_code is null or v_code !~ '^[A-Z0-9]{6}$' then raise exception 'Enter a six-character lobby code'; end if;
  if not exists (select 1 from public.community_group_members where group_id = p_group_id and user_id = auth.uid()) then
    raise exception 'Join this group first';
  end if;
  -- Pluto Party rooms live on the party server; every other room must exist and belong to this game.
  if p_game <> 'pluto-party' and not exists (select 1 from public.resolve_game_invite(v_code) r where r.game_route = p_game_route) then
    raise exception 'Game lobby is unavailable';
  end if;
  if public.community_lobby_status(p_game, v_code) <> 'open' then raise exception 'Game lobby is unavailable'; end if;
  insert into public.community_game_invites(group_id, sender_id, game, mode, room_code, game_route)
    values (p_group_id, auth.uid(), p_game, 'casual', v_code, p_game_route)
    on conflict (group_id, game, room_code) do update set created_at = now(), expires_at = now() + interval '1 day', game_route = excluded.game_route
    returning id into result;
  return result;
end; $$;
revoke all on function public.share_community_game_room(uuid, text, text, text) from public, anon;
grant execute on function public.share_community_game_room(uuid, text, text, text) to authenticated;

create or replace function public.get_community_game_invites(p_group_id uuid) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare result jsonb;
begin
  if not exists (select 1 from public.community_group_members where group_id = p_group_id and user_id = auth.uid()) then
    raise exception 'Join this group first';
  end if;
  select coalesce(jsonb_agg(jsonb_build_object('id', i.id, 'sender_id', i.sender_id,
    'sender_name', coalesce(p.display_name, p.username, 'Player'), 'sender_avatar_id', p.avatar_id,
    'game', i.game, 'game_route', i.game_route, 'mode', i.mode, 'room_code', i.room_code, 'created_at', i.created_at,
    'status', case
      when i.expires_at < now() then 'ended'
      when i.game_route is not null then public.community_lobby_status(i.game, i.room_code)
      when i.game = 'chess' then case
        when c.id is null or c.status not in ('waiting', 'ready') then 'ended'
        when (select count(*) from public.chess_room_players cp where cp.room_id = c.id) >= 2 then 'full'
        else 'open' end
      else case
        when s.id is null or s.game_state->>'status' = 'finished' then 'ended'
        when jsonb_array_length(s.players) >= 2 or s.game_state is not null then 'full'
        else 'open' end end)
    order by i.created_at desc), '[]'::jsonb) into result
  from (select * from public.community_game_invites where group_id = p_group_id order by created_at desc limit 30) i
  left join public.chess_rooms c on i.game = 'chess' and c.code = i.room_code
  left join public.strategy_matches s on i.game in ('go','shogi') and s.room_code = i.room_code and s.game_type = i.game
  left join public.profiles p on p.id = i.sender_id;
  return result;
end; $$;
