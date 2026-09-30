-- Public communities. A unique owner_id is the concurrency-safe one-group rule.
create table public.community_groups (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(btrim(name)) between 3 and 48),
  description text not null default '' check (char_length(description) <= 500),
  avatar_id text not null default 'chess-king' check (avatar_id = any (array[
    'chess-king','chess-knight','chess-queen','chess-board','cards','card-king','dice',
    'castle','shield','dragon','forest','wolf','eagle','fox','ocean','mountain',
    'globe','compass','arena','crown','galaxy','planet','fire','ice','lightning',
    'treasure','map','geometry'
  ])),
  owner_id uuid not null unique references auth.users(id) on delete cascade,
  invite_code text not null unique default upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 8)),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create table public.community_group_members (
  group_id uuid not null references public.community_groups(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  joined_at timestamptz not null default now(),
  primary key (group_id, user_id)
);
create index community_group_members_user_idx on public.community_group_members(user_id);
create table public.community_game_invites (
  id uuid primary key default gen_random_uuid(),
  group_id uuid not null references public.community_groups(id) on delete cascade,
  sender_id uuid not null references auth.users(id) on delete cascade,
  game text not null check (game = 'chess'),
  mode text not null check (mode = 'casual'),
  room_code text not null check (room_code ~ '^[A-Z0-9]{6}$'),
  created_at timestamptz not null default now(),
  expires_at timestamptz not null default (now() + interval '1 day'),
  unique (group_id, game, room_code)
);
create index community_game_invites_group_idx on public.community_game_invites(group_id, created_at desc);

alter table public.community_groups enable row level security;
alter table public.community_group_members enable row level security;
alter table public.community_game_invites enable row level security;
create policy "Browse communities" on public.community_groups for select to authenticated
  using (owner_id = auth.uid() or exists (
    select 1 from public.community_group_members m
    where m.group_id = community_groups.id and m.user_id = auth.uid()
  ));
create policy "Browse community members" on public.community_group_members for select to authenticated using (true);
create policy "Browse community invites" on public.community_game_invites for select to authenticated
  using (exists (select 1 from public.community_group_members m where m.group_id = community_game_invites.group_id and m.user_id = auth.uid()));
grant select on public.community_groups, public.community_group_members, public.community_game_invites to authenticated;
revoke insert, update, delete on public.community_groups, public.community_group_members, public.community_game_invites from anon, authenticated;

create function public.create_community_group(p_name text, p_description text, p_avatar_id text) returns uuid
language plpgsql security definer set search_path = '' as $$
declare result uuid;
begin
  if auth.uid() is null then raise exception 'Sign in to create a group'; end if;
  insert into public.community_groups(name, description, avatar_id, owner_id)
  values (btrim(p_name), btrim(coalesce(p_description, '')), p_avatar_id, auth.uid()) returning id into result;
  insert into public.community_group_members(group_id, user_id) values (result, auth.uid());
  return result;
end; $$;

create function public.join_community_group(p_invite_code text) returns uuid
language plpgsql security definer set search_path = '' as $$
declare result uuid;
begin
  if auth.uid() is null then raise exception 'Sign in to join a group'; end if;
  select id into result from public.community_groups where invite_code = upper(btrim(p_invite_code));
  if result is null then raise exception 'Group code not found'; end if;
  insert into public.community_group_members(group_id, user_id) values (result, auth.uid()) on conflict do nothing;
  return result;
end; $$;

create function public.leave_community_group(p_group_id uuid) returns void
language plpgsql security definer set search_path = '' as $$
begin
  if exists (select 1 from public.community_groups where id = p_group_id and owner_id = auth.uid()) then
    raise exception 'Disband your group instead of leaving it';
  end if;
  delete from public.community_group_members where group_id = p_group_id and user_id = auth.uid();
end; $$;

create function public.update_community_group(p_group_id uuid, p_name text, p_description text, p_avatar_id text) returns void
language plpgsql security definer set search_path = '' as $$
begin
  update public.community_groups set name = btrim(p_name), description = btrim(coalesce(p_description, '')),
    avatar_id = p_avatar_id, updated_at = now()
  where id = p_group_id and owner_id = auth.uid();
  if not found then raise exception 'Only the owner can edit this group'; end if;
end; $$;

create function public.delete_community_group(p_group_id uuid) returns void
language plpgsql security definer set search_path = '' as $$
begin
  delete from public.community_groups where id = p_group_id and owner_id = auth.uid();
  if not found then raise exception 'Only the owner can disband this group'; end if;
end; $$;

create function public.remove_community_member(p_group_id uuid, p_user_id uuid) returns void
language plpgsql security definer set search_path = '' as $$
begin
  if not exists (select 1 from public.community_groups where id = p_group_id and owner_id = auth.uid()) then
    raise exception 'Only the owner can remove members';
  end if;
  if p_user_id = auth.uid() then raise exception 'The owner cannot be removed'; end if;
  delete from public.community_group_members where group_id = p_group_id and user_id = p_user_id;
end; $$;

-- An invite is a reference to an existing room. Joining still goes through join_chess_room.
create function public.share_community_chess_room(p_group_id uuid, p_room_code text) returns uuid
language plpgsql security definer set search_path = '' as $$
declare result uuid; v_room_id uuid;
begin
  if not exists (select 1 from public.community_group_members where group_id = p_group_id and user_id = auth.uid()) then
    raise exception 'Join this group first';
  end if;
  select id into v_room_id from public.chess_rooms where code = upper(btrim(p_room_code)) and status in ('waiting', 'ready');
  if v_room_id is null then raise exception 'Chess lobby is unavailable'; end if;
  if not exists (select 1 from public.chess_room_players where room_id = v_room_id and user_id = auth.uid()) then
    raise exception 'Join the chess lobby before sharing it';
  end if;
  if (select count(*) from public.chess_room_players p where p.room_id = v_room_id) >= 2 then
    raise exception 'Chess lobby is full';
  end if;
  insert into public.community_game_invites(group_id, sender_id, game, mode, room_code)
    values (p_group_id, auth.uid(), 'chess', 'casual', upper(btrim(p_room_code)))
    on conflict (group_id, game, room_code) do update set created_at = now(), expires_at = now() + interval '1 day'
    returning id into result;
  return result;
end; $$;

create function public.get_community_chess_invites(p_group_id uuid) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare result jsonb;
begin
  if not exists (select 1 from public.community_group_members where group_id = p_group_id and user_id = auth.uid()) then
    raise exception 'Join this group first';
  end if;
  select coalesce(jsonb_agg(jsonb_build_object('id', i.id, 'sender_id', i.sender_id,
    'sender_name', coalesce(p.display_name, p.username, 'Player'), 'sender_avatar_id', p.avatar_id,
    'game', i.game, 'mode', i.mode, 'room_code', i.room_code, 'created_at', i.created_at,
    'status', case when i.expires_at < now() or r.id is null or r.status not in ('waiting', 'ready') then 'ended'
      when (select count(*) from public.chess_room_players cp where cp.room_id = r.id) >= 2 then 'full' else 'open' end)
    order by i.created_at desc), '[]'::jsonb) into result
  from (select * from public.community_game_invites where group_id = p_group_id order by created_at desc limit 30) i
  left join public.chess_rooms r on r.code = i.room_code
  left join public.profiles p on p.id = i.sender_id;
  return result;
end; $$;

revoke all on function public.create_community_group(text,text,text), public.join_community_group(text),
  public.leave_community_group(uuid), public.update_community_group(uuid,text,text,text),
  public.delete_community_group(uuid), public.remove_community_member(uuid,uuid),
  public.share_community_chess_room(uuid,text), public.get_community_chess_invites(uuid) from public, anon;
grant execute on function public.create_community_group(text,text,text), public.join_community_group(text),
  public.leave_community_group(uuid), public.update_community_group(uuid,text,text,text),
  public.delete_community_group(uuid), public.remove_community_member(uuid,uuid),
  public.share_community_chess_room(uuid,text), public.get_community_chess_invites(uuid) to authenticated;
