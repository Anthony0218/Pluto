alter table public.community_game_invites drop constraint community_game_invites_game_check;
alter table public.community_game_invites add constraint community_game_invites_game_check
  check (game in ('chess', 'go', 'shogi'));

create function public.share_community_strategy_room(p_group_id uuid, p_game text, p_room_code text) returns uuid
language plpgsql security definer set search_path = '' as $$
declare result uuid; v_room public.strategy_matches%rowtype;
begin
  if p_game is null or p_game not in ('go','shogi') then raise exception 'Unsupported game'; end if;
  if not exists (select 1 from public.community_group_members where group_id = p_group_id and user_id = auth.uid()) then
    raise exception 'Join this group first';
  end if;
  select * into v_room from public.strategy_matches where room_code = upper(btrim(p_room_code)) and game_type = p_game;
  if not found or v_room.game_state is not null or jsonb_array_length(v_room.players) >= 2 then
    raise exception 'Game lobby is unavailable';
  end if;
  if not exists (select 1 from jsonb_array_elements(v_room.players) player where player->>'id' = auth.uid()::text) then
    raise exception 'Join the lobby before sharing it';
  end if;
  insert into public.community_game_invites(group_id, sender_id, game, mode, room_code)
    values (p_group_id, auth.uid(), p_game, 'casual', upper(btrim(p_room_code)))
    on conflict (group_id, game, room_code) do update set created_at = now(), expires_at = now() + interval '1 day'
    returning id into result;
  return result;
end; $$;
revoke all on function public.share_community_strategy_room(uuid,text,text) from public, anon;
grant execute on function public.share_community_strategy_room(uuid,text,text) to authenticated;

alter function public.get_community_chess_invites(uuid) rename to get_community_game_invites;
create or replace function public.get_community_game_invites(p_group_id uuid) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare result jsonb;
begin
  if not exists (select 1 from public.community_group_members where group_id = p_group_id and user_id = auth.uid()) then
    raise exception 'Join this group first';
  end if;
  select coalesce(jsonb_agg(jsonb_build_object('id', i.id, 'sender_id', i.sender_id,
    'sender_name', coalesce(p.display_name, p.username, 'Player'), 'sender_avatar_id', p.avatar_id,
    'game', i.game, 'mode', i.mode, 'room_code', i.room_code, 'created_at', i.created_at,
    'status', case
      when i.expires_at < now() then 'ended'
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
