-- Chess and chess-variant rooms are visible only to the players seated in them.
-- Every signed-in user could previously list all rooms with their join codes, see who was
-- playing whom and follow any live game. Joining still works by code: join_chess_room,
-- join_variant_room, get_chess_room_match_kind and resolve_game_invite look rooms up with
-- their own rights, and spectators read through get_spectate_snapshot.

-- Membership checks run with the owner's rights so the player-table policies do not recurse.
create function public.is_chess_room_member(p_room_id uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.chess_room_players p where p.room_id = p_room_id and p.user_id = auth.uid());
$$;
create function public.is_variant_room_member(p_room_id uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.variant_room_players p where p.room_id = p_room_id and p.user_id = auth.uid());
$$;
revoke all on function public.is_chess_room_member(uuid), public.is_variant_room_member(uuid) from public, anon;
grant execute on function public.is_chess_room_member(uuid), public.is_variant_room_member(uuid) to authenticated, service_role;

drop policy if exists "Authenticated users can read chess rooms" on public.chess_rooms;
create policy "Players can read their chess rooms" on public.chess_rooms for select to authenticated
  using (host_id = auth.uid() or public.is_chess_room_member(id));

drop policy if exists "Authenticated users can read chess players" on public.chess_room_players;
create policy "Players can read their chess room players" on public.chess_room_players for select to authenticated
  using (user_id = auth.uid() or public.is_chess_room_member(room_id));

drop policy if exists "Authenticated users can read chess games" on public.chess_games;
create policy "Players can read their chess games" on public.chess_games for select to authenticated
  using (public.is_chess_room_member(room_id));

drop policy if exists "variant rooms visible to authenticated users" on public.variant_rooms;
create policy "Players can read their variant rooms" on public.variant_rooms for select to authenticated
  using (host_id = auth.uid() or public.is_variant_room_member(id));

drop policy if exists "variant room players visible to authenticated users" on public.variant_room_players;
create policy "Players can read their variant room players" on public.variant_room_players for select to authenticated
  using (user_id = auth.uid() or public.is_variant_room_member(room_id));
