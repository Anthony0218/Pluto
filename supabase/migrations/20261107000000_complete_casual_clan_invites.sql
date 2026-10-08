-- Complete casual clan invites: Card Builder lobbies and canonical Pluto server codes.
alter table public.community_game_invites drop constraint if exists community_game_invites_game_check;
alter table public.community_game_invites add constraint community_game_invites_game_check
  check (game in ('chess', 'go', 'shogi', 'watten', 'schafkopf', 'atlas-arena', 'eat-it', 'pluto-party', 'chess-variant', 'chess-custom', 'card-builder'));
alter table public.community_game_invites drop constraint if exists community_game_invites_room_code_check;
alter table public.community_game_invites add constraint community_game_invites_room_code_check
  check ((game = 'pluto-party' and room_code ~ '^(PLUTO-)?[0-9]{6}$')
    or (game <> 'pluto-party' and room_code ~ '^[A-Z0-9]{6}$'));

create or replace function public.community_lobby_status(p_game text, p_code text) returns text
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
  elsif p_game = 'card-builder' then
    select r.status, coalesce((r.state_json->'room'->>'capacity')::integer, 2),
      (select count(*)::integer from public.card_game_players p where p.session_id = r.id and p.user_id is not null and p.status <> 'left')
      into v_status, v_capacity, v_players from public.card_game_sessions r where r.code = v_code;
    if not found or v_status = 'finished' then return 'ended'; end if;
    return case when v_status <> 'waiting' or v_players >= v_capacity then 'full' else 'open' end;
  elsif p_game = 'chess-custom' then
    select cardinality(player_ids), jsonb_array_length(variant->'teams'), status into v_players, v_capacity, v_status
      from public.chess_custom_matches where code = v_code;
    if not found or v_status = 'finished' then return 'ended'; end if;
    return case when v_status <> 'waiting' or v_players >= v_capacity then 'full' else 'open' end;
  elsif p_game = 'chess-variant' then
    select r.status, case when r.variant = 'four-player' then 4 else 2 end, (select count(*)::integer from public.variant_room_players p where p.room_id = r.id)
      into v_status, v_capacity, v_players from public.variant_rooms r where upper(r.code) = v_code;
    if not found or v_status = 'finished' then return 'ended'; end if;
    return case when v_status <> 'waiting' or v_players >= v_capacity then 'full' else 'open' end;
  end if;
  return 'open';
end; $$;
revoke all on function public.community_lobby_status(text, text) from public, anon, authenticated;

create or replace function public.share_community_game_room(p_group_id uuid, p_game text, p_game_route text, p_room_code text) returns uuid
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
    when 'card-builder' then '^/games/card-builder/room$'
    when 'chess-variant' then '^/games/chess/variants/[a-z0-9-]+/multiplayer$'
    when 'chess-custom' then '^/chess-custom/play/multiplayer$'
    else null end;
  if v_route_pattern is null or p_game_route is null or p_game_route !~ v_route_pattern then raise exception 'Unsupported game'; end if;
  if p_game = 'pluto-party' then
    if v_code ~ '^[0-9]{6}$' then v_code := 'PLUTO-' || v_code; end if;
    if v_code is null or v_code !~ '^PLUTO-[0-9]{6}$' then raise exception 'Enter a Pluto lobby code'; end if;
  elsif v_code is null or v_code !~ '^[A-Z0-9]{6}$' then
    raise exception 'Enter a six-character lobby code';
  end if;
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

