-- Social layer: public profiles, pixel avatars, live friend activity,
-- spectate requests and clan (community group) chat.

-- ---------------------------------------------------------------------------
-- Pixel avatars are stored inline in profiles.avatar_id as 'px1:' followed by
-- 256 hex palette indices (16×16), so every avatar renderer picks them up.
-- ---------------------------------------------------------------------------
do $$
declare c record;
begin
  for c in
    select conname from pg_constraint
    where conrelid = 'public.profiles'::regclass and contype = 'c'
      and pg_get_constraintdef(oid) ilike '%avatar_id%'
  loop
    execute format('alter table public.profiles drop constraint %I', c.conname);
  end loop;
end $$;
alter table public.profiles add constraint profiles_avatar_id_format check (
  avatar_id is null
  or avatar_id ~ '^[A-Za-z0-9_-]{1,40}$'
  -- 256 digits; Postgres caps a single repetition count at 255.
  or avatar_id ~ '^px1:([0-9a-f]{16}){16}$'
) not valid;

-- ---------------------------------------------------------------------------
-- Presence: friends see which game and mode you are in, never the room.
-- ---------------------------------------------------------------------------
alter table public.user_presence
  add column if not exists activity_game text check (activity_game is null or char_length(activity_game) <= 40),
  add column if not exists activity_mode text check (activity_mode is null or char_length(activity_mode) <= 40),
  add column if not exists activity_route text check (activity_route is null or char_length(activity_route) <= 200);

-- Only live chess rooms (casual or ranked) can be watched for now.
create function public.spectatable_room_code(p_route text) returns text
language sql immutable set search_path = '' as $$
  select upper((regexp_match(p_route, '^/games/chess/(?:classic/multiplayer|ranked)/([A-Za-z0-9]{6})(?:/game)?$'))[1]);
$$;

alter table public.user_presence
  add column if not exists spectatable boolean
  generated always as (public.spectatable_room_code(activity_route) is not null) stored;

revoke select on public.user_presence from anon, authenticated;
grant select (user_id, last_seen_at, activity_game, activity_mode, spectatable) on public.user_presence to authenticated;

create or replace function public.update_presence(p_game text default null, p_mode text default null, p_route text default null)
returns void
language plpgsql security definer set search_path = '' as $$
begin
  if auth.uid() is null then raise exception 'Authentication required'; end if;
  insert into public.user_presence (user_id, last_seen_at, activity_game, activity_mode, activity_route)
  values (
    auth.uid(), now(),
    left(nullif(btrim(p_game), ''), 40),
    left(nullif(btrim(p_mode), ''), 40),
    case when p_route ~ '^/games/[A-Za-z0-9/_-]{1,190}$' then p_route end
  )
  on conflict (user_id) do update set
    last_seen_at = excluded.last_seen_at,
    activity_game = excluded.activity_game,
    activity_mode = excluded.activity_mode,
    activity_route = excluded.activity_route;
end; $$;
revoke all on function public.update_presence(text, text, text) from public, anon;
grant execute on function public.update_presence(text, text, text) to authenticated;

-- ---------------------------------------------------------------------------
-- Spectate requests. The room is revealed to the requester only after the
-- player accepts, and only through get_spectate_snapshot.
-- ---------------------------------------------------------------------------
create table public.spectate_requests (
  id uuid primary key default gen_random_uuid(),
  requester_id uuid not null references auth.users(id) on delete cascade,
  target_id uuid not null references auth.users(id) on delete cascade,
  game text not null check (char_length(game) <= 40),
  mode text check (mode is null or char_length(mode) <= 40),
  status text not null default 'pending' check (status in ('pending', 'accepted', 'declined')),
  room_code text,
  created_at timestamptz not null default now(),
  responded_at timestamptz,
  check (requester_id <> target_id)
);
create index spectate_requests_target_idx on public.spectate_requests(target_id, created_at desc);
create index spectate_requests_requester_idx on public.spectate_requests(requester_id, created_at desc);
alter table public.spectate_requests enable row level security;
create policy "Read own spectate requests" on public.spectate_requests for select to authenticated
  using (requester_id = auth.uid() or target_id = auth.uid());
grant select on public.spectate_requests to authenticated;
revoke insert, update, delete on public.spectate_requests from anon, authenticated;

create function public.request_spectate(p_target_id uuid) returns uuid
language plpgsql security definer set search_path = '' as $$
declare
  v_presence public.user_presence%rowtype;
  v_id uuid;
begin
  if auth.uid() is null then raise exception 'Sign in to spectate'; end if;
  if not exists (
    select 1 from public.friendships f
    where (f.user_a = auth.uid() and f.user_b = p_target_id) or (f.user_b = auth.uid() and f.user_a = p_target_id)
  ) then raise exception 'You can only spectate friends'; end if;
  select * into v_presence from public.user_presence where user_id = p_target_id;
  if not found or v_presence.last_seen_at < now() - interval '90 seconds' then
    raise exception 'Your friend is offline';
  end if;
  if public.spectatable_room_code(v_presence.activity_route) is null then
    raise exception 'This game cannot be spectated';
  end if;
  update public.spectate_requests set created_at = now(), game = v_presence.activity_game, mode = v_presence.activity_mode
    where requester_id = auth.uid() and target_id = p_target_id and status = 'pending'
    returning id into v_id;
  if v_id is null then
    insert into public.spectate_requests (requester_id, target_id, game, mode)
    values (auth.uid(), p_target_id, coalesce(v_presence.activity_game, 'Chess'), v_presence.activity_mode)
    returning id into v_id;
  end if;
  return v_id;
end; $$;

create function public.respond_spectate_request(p_request_id uuid, p_accept boolean) returns void
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
    if v_code is null then raise exception 'Open your game first, then accept'; end if;
  end if;
  update public.spectate_requests
    set status = case when p_accept then 'accepted' else 'declined' end,
        room_code = v_code,
        responded_at = now()
    where id = p_request_id;
end; $$;

-- Read-only view of the accepted room for the approved spectator.
create function public.get_spectate_snapshot(p_request_id uuid) returns jsonb
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
  if not found then raise exception 'The game has ended'; end if;
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

revoke all on function public.request_spectate(uuid), public.respond_spectate_request(uuid, boolean),
  public.get_spectate_snapshot(uuid) from public, anon;
grant execute on function public.request_spectate(uuid), public.respond_spectate_request(uuid, boolean),
  public.get_spectate_snapshot(uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- Public profiles: name, avatar, most played games and chess rank only.
-- ---------------------------------------------------------------------------
create function public.get_public_profile(p_user_id uuid) returns jsonb
language sql stable security definer set search_path = '' as $$
  select jsonb_build_object(
    'id', p.id,
    'username', p.username,
    'display_name', p.display_name,
    'avatar_id', p.avatar_id,
    'most_played', coalesce((
      select jsonb_agg(t.game order by t.games desc, t.game)
      from (
        select r.game, count(*) as games from public.user_game_results r
        where r.user_id = p.id group by r.game order by count(*) desc, r.game limit 3
      ) t), '[]'::jsonb),
    'chess_rating', (
      select jsonb_build_object('rating', c.rating, 'time_control', c.time_control)
      from public.chess_ratings c
      where c.user_id = p.id and c.rated_games > 0
      order by c.rating desc limit 1)
  )
  from public.profiles p where p.id = p_user_id;
$$;

create function public.find_profile_by_username(p_username text) returns uuid
language sql stable security definer set search_path = '' as $$
  select id from public.profiles
  where lower(username) = lower(btrim(p_username)) or lower(display_name) = lower(btrim(p_username))
  order by (lower(username) = lower(btrim(p_username))) desc nulls last, id
  limit 1;
$$;

revoke all on function public.get_public_profile(uuid), public.find_profile_by_username(text) from public, anon;
grant execute on function public.get_public_profile(uuid), public.find_profile_by_username(text) to authenticated;

-- ---------------------------------------------------------------------------
-- Clan chat (community groups are shown as "Clans" in the app).
-- ---------------------------------------------------------------------------
create table public.community_group_messages (
  id uuid primary key default gen_random_uuid(),
  group_id uuid not null references public.community_groups(id) on delete cascade,
  sender_id uuid not null references auth.users(id) on delete cascade,
  body text not null check (char_length(btrim(body)) between 1 and 500),
  created_at timestamptz not null default now()
);
create index community_group_messages_group_idx on public.community_group_messages(group_id, created_at desc);
alter table public.community_group_messages enable row level security;
create policy "Read clan messages" on public.community_group_messages for select to authenticated
  using (exists (
    select 1 from public.community_group_members m
    where m.group_id = community_group_messages.group_id and m.user_id = auth.uid()
  ));
grant select on public.community_group_messages to authenticated;
revoke insert, update, delete on public.community_group_messages from anon, authenticated;

create function public.send_community_group_message(p_group_id uuid, p_body text) returns uuid
language plpgsql security definer set search_path = '' as $$
declare result uuid;
begin
  if auth.uid() is null then raise exception 'Sign in to chat'; end if;
  if not exists (select 1 from public.community_group_members where group_id = p_group_id and user_id = auth.uid()) then
    raise exception 'Join this clan first';
  end if;
  if (select count(*) from public.community_group_messages
      where sender_id = auth.uid() and created_at > now() - interval '30 seconds') >= 10 then
    raise exception 'Slow down a little';
  end if;
  insert into public.community_group_messages (group_id, sender_id, body)
  values (p_group_id, auth.uid(), btrim(p_body)) returning id into result;
  return result;
end; $$;
revoke all on function public.send_community_group_message(uuid, text) from public, anon;
grant execute on function public.send_community_group_message(uuid, text) to authenticated;

-- Live updates for pop-ups.
do $$
declare t text;
begin
  foreach t in array array['community_group_messages', 'community_game_invites', 'spectate_requests'] loop
    if not exists (
      select 1 from pg_publication_tables
      where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = t
    ) then
      execute format('alter publication supabase_realtime add table public.%I', t);
    end if;
  end loop;
end $$;
