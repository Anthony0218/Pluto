-- Follow-up hardening: spam limits for friend requests and friend messages, direct writes to
-- 3-player Watten rooms, and privileged functions that logged-out visitors could call.

-- ---------------------------------------------------------------------------
-- Friend requests and friend messages (preset chat lines and game invites) are inserted
-- directly by the client, so their limits live in triggers. Clan chat already limits itself
-- inside send_community_group_message. created_at is stamped by the server so a sender
-- cannot backdate rows to slip under the limit.
-- ---------------------------------------------------------------------------
create function public.limit_friend_requests() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  new.created_at := now();
  if (select count(*) from public.friend_requests r
      where r.sender_id = new.sender_id and r.created_at > now() - interval '1 hour') >= 30 then
    raise exception 'Too many friend requests. Try again later.';
  end if;
  return new;
end $$;

create function public.limit_friend_messages() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  new.created_at := now();
  if (select count(*) from public.friend_messages m
      where m.sender_id = new.sender_id and m.created_at > now() - interval '1 minute') >= 30 then
    raise exception 'Slow down a little';
  end if;
  return new;
end $$;

revoke all on function public.limit_friend_requests(), public.limit_friend_messages() from public, anon, authenticated;
create index if not exists friend_requests_sender_created_idx on public.friend_requests (sender_id, created_at);
create trigger friend_requests_rate_limit before insert on public.friend_requests
  for each row execute function public.limit_friend_requests();
create trigger friend_messages_rate_limit before insert on public.friend_messages
  for each row execute function public.limit_friend_messages();

-- ---------------------------------------------------------------------------
-- 3-player Watten: rooms and seats change only through create_watten3_room,
-- join_watten3_room and start_watten3_game. The dropped policies let a host rewrite the
-- room row and let any player insert or move their own seat row directly. Game state is
-- now readable by the players at the table only, like the 4-player tables.
-- ---------------------------------------------------------------------------
drop policy if exists "watten3 users can create rooms" on public.watten3_rooms;
drop policy if exists "watten3 host can update room" on public.watten3_rooms;
drop policy if exists "watten3 host can delete room" on public.watten3_rooms;
drop policy if exists "watten3 users can insert themselves" on public.watten3_room_players;
drop policy if exists "watten3 users can update themselves" on public.watten3_room_players;
drop policy if exists "watten3 users can delete themselves" on public.watten3_room_players;
revoke insert, update, delete on public.watten3_rooms, public.watten3_room_players from anon, authenticated;
drop policy if exists "watten3 games authenticated read" on public.watten3_games;

-- Legacy one-off online games: only the two players may read a game.
drop policy if exists "Authenticated users can view online games" on public.online_games;
create policy "Players can view their online games" on public.online_games for select to authenticated
  using (auth.uid() = white_player or auth.uid() = black_player);

-- ---------------------------------------------------------------------------
-- SECURITY DEFINER functions run with the owner's rights. Supabase grants EXECUTE on every
-- new function to anon by default, so logged-out visitors could call all of them. Only the
-- three public read functions below are meant for visitors; every other one keeps exactly
-- the access it already had for signed-in users and the service role. Trigger functions are
-- left alone: they cannot be called through the API.
-- ---------------------------------------------------------------------------
do $$
declare f record;
begin
  for f in
    select p.oid::regprocedure as signature,
      has_function_privilege('authenticated', p.oid, 'execute') as for_authenticated,
      has_function_privilege('service_role', p.oid, 'execute') as for_service
    from pg_catalog.pg_proc p join pg_catalog.pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.prokind = 'f' and p.prosecdef
      and p.prorettype <> 'trigger'::regtype
      and has_function_privilege('anon', p.oid, 'execute')
      and p.proname not in ('get_atlas_ranked_leaderboard', 'list_chess_catalog_votes', 'list_chess_custom_community')
  loop
    execute format('revoke execute on function %s from public, anon', f.signature);
    if f.for_authenticated then execute format('grant execute on function %s to authenticated', f.signature); end if;
    if f.for_service then execute format('grant execute on function %s to service_role', f.signature); end if;
  end loop;
end $$;

-- Pin the search path of the remaining helper functions (the Watten card-rank helpers) to the
-- schemas they already resolve through, so a caller's session settings cannot redirect them.
do $$
declare f record;
begin
  for f in
    select p.oid::regprocedure as signature
    from pg_catalog.pg_proc p join pg_catalog.pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.prokind = 'f'
      and not exists (select 1 from unnest(coalesce(p.proconfig, '{}')) setting where setting like 'search_path=%')
      and not exists (select 1 from pg_catalog.pg_depend d where d.objid = p.oid and d.deptype = 'e')
  loop
    execute format('alter function %s set search_path = public, extensions, pg_temp', f.signature);
  end loop;
end $$;
