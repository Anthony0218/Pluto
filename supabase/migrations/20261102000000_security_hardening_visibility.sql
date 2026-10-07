-- Third hardening pass: three places where a signed-in player could see or write something
-- that is not theirs.

-- ---------------------------------------------------------------------------
-- Spectating: the accepted room came from the player's own presence route, which the
-- player sets freely through update_presence. A player could point that route at any
-- six-character room code and accept a friend's request, handing the friend the board,
-- moves and player names of a private game neither of them is in. The room is now only
-- accepted, and only shown, while the spectated player is seated in it.
-- ---------------------------------------------------------------------------
create or replace function public.respond_spectate_request(p_request_id uuid, p_accept boolean) returns void
language plpgsql security definer set search_path = '' as $$
declare v_code text;
begin
  if auth.uid() is null then raise exception 'Authentication required'; end if;
  perform 1 from public.spectate_requests
    where id = p_request_id and target_id = auth.uid() and status = 'pending'
      and created_at > now() - interval '15 minutes'
    for update;
  if not found then raise exception 'This spectate request has expired'; end if;
  if p_accept then
    select public.spectatable_room_code(activity_route) into v_code from public.user_presence where user_id = auth.uid();
    if v_code is null or not exists (
      select 1 from public.chess_rooms r join public.chess_room_players p on p.room_id = r.id
      where r.code = v_code and p.user_id = auth.uid()
    ) then raise exception 'Open your game first, then accept'; end if;
  end if;
  update public.spectate_requests
    set status = case when p_accept then 'accepted' else 'declined' end,
        room_code = v_code,
        responded_at = now()
    where id = p_request_id;
end; $$;

create or replace function public.get_spectate_snapshot(p_request_id uuid) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare
  v_request public.spectate_requests%rowtype;
  v_room record;
  result jsonb;
begin
  select * into v_request from public.spectate_requests
    where id = p_request_id and requester_id = auth.uid() and status = 'accepted'
      and responded_at > now() - interval '6 hours';
  if not found then raise exception 'Spectating is not available'; end if;
  select id, code, status, match_kind, time_control into v_room from public.chess_rooms where code = v_request.room_code;
  if not found or not exists (
    select 1 from public.chess_room_players p where p.room_id = v_room.id and p.user_id = v_request.target_id
  ) then raise exception 'The game has ended'; end if;
  select jsonb_build_object(
    'room', jsonb_build_object('code', v_room.code, 'status', v_room.status, 'match_kind', v_room.match_kind, 'time_control', v_room.time_control),
    'target_id', v_request.target_id,
    'players', coalesce((
      select jsonb_agg(jsonb_build_object(
        'user_id', p.user_id, 'seat', p.seat, 'display_name', p.display_name, 'chosen_color', p.chosen_color,
        'username', pr.username, 'avatar_id', pr.avatar_id) order by p.seat)
      from public.chess_room_players p left join public.profiles pr on pr.id = p.user_id
      where p.room_id = v_room.id), '[]'::jsonb),
    'game', (
      select jsonb_build_object('fen', g.fen, 'moves', to_jsonb(g.moves), 'status', g.status, 'winner', g.winner,
        'end_reason', g.end_reason, 'last_move_from', g.last_move_from, 'last_move_to', g.last_move_to,
        'white_time_ms', g.white_time_ms, 'black_time_ms', g.black_time_ms, 'clock_started_at', g.clock_started_at)
      from public.chess_games g where g.room_id = v_room.id)
  ) into result;
  return result;
end; $$;

-- ---------------------------------------------------------------------------
-- Clans are joined by invite code and are visible to their members only, but the member
-- list was readable by every signed-in player (using (true)): who is in which clan, and
-- since when, for all clans. Members now see the members of their own clans. The helper is
-- SECURITY DEFINER so the policy does not recurse into itself.
-- ---------------------------------------------------------------------------
create function public.is_community_group_member(p_group_id uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select auth.uid() is not null and exists (
    select 1 from public.community_group_members where group_id = p_group_id and user_id = auth.uid());
$$;
revoke all on function public.is_community_group_member(uuid) from public, anon;
grant execute on function public.is_community_group_member(uuid) to authenticated;
drop policy if exists "Browse community members" on public.community_group_members;
create policy "Members see their clan's members" on public.community_group_members for select to authenticated
  using (user_id = auth.uid() or public.is_community_group_member(group_id));

-- ---------------------------------------------------------------------------
-- Legacy one-off online games: the client only reads them. Any signed-in player could
-- still insert a game naming any other player as the opponent, and either player could
-- rewrite position, status and winner. Nothing writes these rows any more.
-- ---------------------------------------------------------------------------
drop policy if exists "Authenticated users can create online games" on public.online_games;
drop policy if exists "Players can update their online games" on public.online_games;
revoke insert, update, delete on public.online_games from anon, authenticated;
