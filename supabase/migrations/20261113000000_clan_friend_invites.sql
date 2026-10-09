-- Clan invitations: a member invites a friend, who accepts or declines.
-- The clan's name is only shown to the invited player through get_clan_invites.
create table public.community_group_invites (
  id uuid primary key default gen_random_uuid(),
  group_id uuid not null references public.community_groups(id) on delete cascade,
  sender_id uuid not null references auth.users(id) on delete cascade,
  receiver_id uuid not null references auth.users(id) on delete cascade,
  status text not null default 'pending' check (status in ('pending', 'accepted', 'declined')),
  created_at timestamptz not null default now(),
  responded_at timestamptz,
  check (sender_id <> receiver_id)
);
-- One open invitation per clan and player, whoever sent it.
create unique index community_group_invites_pending_idx on public.community_group_invites(group_id, receiver_id) where status = 'pending';
create index community_group_invites_receiver_idx on public.community_group_invites(receiver_id, created_at desc);
create index community_group_invites_sender_idx on public.community_group_invites(sender_id, created_at desc);
alter table public.community_group_invites enable row level security;
create policy "Read own clan invitations" on public.community_group_invites for select to authenticated
  using (sender_id = auth.uid() or receiver_id = auth.uid());
grant select on public.community_group_invites to authenticated;
revoke insert, update, delete on public.community_group_invites from anon, authenticated;

create function public.invite_friend_to_clan(p_group_id uuid, p_friend_id uuid) returns uuid
language plpgsql security definer set search_path = '' as $$
declare result uuid;
begin
  if auth.uid() is null then raise exception 'Sign in to invite friends'; end if;
  if not exists (select 1 from public.community_group_members where group_id = p_group_id and user_id = auth.uid()) then
    raise exception 'Join this clan first';
  end if;
  if not exists (
    select 1 from public.friendships f
    where (f.user_a = auth.uid() and f.user_b = p_friend_id) or (f.user_b = auth.uid() and f.user_a = p_friend_id)
  ) then raise exception 'You can only invite friends'; end if;
  if exists (select 1 from public.community_group_members where group_id = p_group_id and user_id = p_friend_id) then
    raise exception 'Already a member of this clan';
  end if;
  select id into result from public.community_group_invites
  where group_id = p_group_id and receiver_id = p_friend_id and status = 'pending';
  if result is not null then return result; end if;
  if (select count(*) from public.community_group_invites
      where sender_id = auth.uid() and created_at > now() - interval '1 hour') >= 30 then
    raise exception 'Slow down a little';
  end if;
  insert into public.community_group_invites (group_id, sender_id, receiver_id)
  values (p_group_id, auth.uid(), p_friend_id)
  on conflict (group_id, receiver_id) where status = 'pending' do nothing
  returning id into result;
  if result is null then
    select id into result from public.community_group_invites
    where group_id = p_group_id and receiver_id = p_friend_id and status = 'pending';
  end if;
  return result;
end; $$;

-- Returns the clan joined, or null when the invitation was declined.
create function public.respond_clan_invite(p_invite_id uuid, p_accept boolean) returns uuid
language plpgsql security definer set search_path = '' as $$
declare v_invite public.community_group_invites%rowtype;
begin
  if auth.uid() is null then raise exception 'Sign in to answer invitations'; end if;
  select * into v_invite from public.community_group_invites
  where id = p_invite_id and receiver_id = auth.uid() and status = 'pending' for update;
  if not found then raise exception 'This invitation is no longer open'; end if;
  update public.community_group_invites
  set status = case when p_accept then 'accepted' else 'declined' end, responded_at = now()
  where id = v_invite.id;
  if not p_accept then return null; end if;
  insert into public.community_group_members (group_id, user_id) values (v_invite.group_id, auth.uid()) on conflict do nothing;
  return v_invite.group_id;
end; $$;

-- Open invitations for the signed-in player, newest first.
create function public.get_clan_invites() returns table (
  id uuid, group_id uuid, group_name text, group_avatar_id text, member_count bigint,
  sender_id uuid, sender_name text, sender_avatar_id text, created_at timestamptz
)
language sql stable security definer set search_path = '' as $$
  select i.id, g.id, g.name, g.avatar_id,
    (select count(*) from public.community_group_members m where m.group_id = g.id),
    i.sender_id, coalesce(nullif(btrim(p.display_name), ''), p.username, 'Player'), p.avatar_id, i.created_at
  from public.community_group_invites i
  join public.community_groups g on g.id = i.group_id
  left join public.profiles p on p.id = i.sender_id
  where i.receiver_id = auth.uid() and i.status = 'pending'
    and not exists (select 1 from public.community_group_members m where m.group_id = i.group_id and m.user_id = auth.uid())
  order by i.created_at desc
  limit 50;
$$;

revoke all on function public.invite_friend_to_clan(uuid, uuid), public.respond_clan_invite(uuid, boolean),
  public.get_clan_invites() from public, anon;
grant execute on function public.invite_friend_to_clan(uuid, uuid), public.respond_clan_invite(uuid, boolean),
  public.get_clan_invites() to authenticated;

-- Live updates for the invitation pop-up.
do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'community_group_invites'
  ) then
    alter publication supabase_realtime add table public.community_group_invites;
  end if;
end $$;
