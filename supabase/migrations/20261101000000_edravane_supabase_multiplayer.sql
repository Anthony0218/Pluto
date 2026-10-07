-- Authoritative campaigns and hidden battle plans are never readable by browser clients.
create table public.edravane_rooms (
  code text primary key check (code ~ '^[A-Z0-9]{8}$'),
  creator_id uuid not null references auth.users(id) on delete cascade,
  version bigint not null default 0,
  data jsonb not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index edravane_rooms_creator_created on public.edravane_rooms(creator_id, created_at);
create table public.edravane_members (
  code text not null references public.edravane_rooms(code) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  active boolean not null default true,
  last_seen timestamptz not null default now(),
  primary key(code, user_id)
);
create index edravane_members_user on public.edravane_members(user_id, code);
create table public.edravane_room_events (
  code text primary key references public.edravane_rooms(code) on delete cascade,
  version bigint not null
);
alter table public.edravane_rooms enable row level security;
alter table public.edravane_members enable row level security;
alter table public.edravane_room_events enable row level security;
revoke all on public.edravane_rooms, public.edravane_members, public.edravane_room_events from anon, authenticated;
grant all on public.edravane_rooms, public.edravane_members, public.edravane_room_events to service_role;
grant select on public.edravane_members, public.edravane_room_events to authenticated;
create policy "Own council membership" on public.edravane_members for select to authenticated using (user_id = (select auth.uid()));
create policy "Seated players receive council revisions" on public.edravane_room_events for select to authenticated using (
  exists (select 1 from public.edravane_members m where m.code = edravane_room_events.code and m.user_id = (select auth.uid()))
);

-- Compare-and-swap and notification are one transaction. Failed races never overwrite a turn.
create function public.edravane_store_room(p_code text, p_expected bigint, p_room jsonb, p_actor uuid) returns boolean
language plpgsql security definer set search_path = '' as $$
declare
  changed int;
  member jsonb;
begin
  if coalesce(auth.role(), '') <> 'service_role' then raise exception 'Server authority required'; end if;
  if p_room->>'code' <> p_code or jsonb_typeof(p_room->'sessions') <> 'array' or jsonb_array_length(p_room->'sessions') > 8
    or (p_room->>'version')::bigint <> p_expected + 1 then raise exception 'Invalid council snapshot'; end if;
  if p_expected = -1 then
    insert into public.edravane_rooms(code, creator_id, version, data)
      values(p_code, p_actor, 0, p_room) on conflict do nothing;
  else
    update public.edravane_rooms set data = p_room, version = p_expected + 1, updated_at = now()
      where code = p_code and version = p_expected;
  end if;
  get diagnostics changed = row_count;
  if changed = 0 then return false; end if;
  for member in select value from jsonb_array_elements(p_room->'sessions') loop
    insert into public.edravane_members(code, user_id, active, last_seen)
      values(p_code, (member->>'id')::uuid, (member->>'connected')::boolean, now())
    on conflict(code, user_id) do update set active = excluded.active,
      last_seen = case when excluded.user_id = p_actor and excluded.active then now() else edravane_members.last_seen end;
  end loop;
  insert into public.edravane_room_events(code, version) values(p_code, p_expected + 1)
    on conflict(code) do update set version = excluded.version;
  return true;
end;
$$;
revoke all on function public.edravane_store_room(text,bigint,jsonb,uuid) from public, anon, authenticated;
grant execute on function public.edravane_store_room(text,bigint,jsonb,uuid) to service_role;

-- Cheap browser heartbeat: renew only the caller's lease and return a small revision notice.
-- It never reads out a campaign, supplies an order or advances a turn.
create function public.edravane_heartbeat(p_code text) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  revision bigint;
  needs_sync boolean;
begin
  if auth.uid() is null then raise exception 'Login required'; end if;
  update public.edravane_members set last_seen = now() where code = p_code and user_id = auth.uid() and active;
  if not found then raise exception 'Reconnect to this council first'; end if;
  select r.version, exists (
    select 1 from public.edravane_members m, jsonb_array_elements(r.data->'slots') s
    where m.code = r.code and s->>'player' = m.user_id::text and (s->>'connected')::boolean
      and (not m.active or m.last_seen < now() - interval '90 seconds')
  ) into revision, needs_sync from public.edravane_rooms r where r.code = p_code;
  return jsonb_build_object('version', revision, 'needs_sync', needs_sync);
end;
$$;
revoke all on function public.edravane_heartbeat(text) from public, anon;
grant execute on function public.edravane_heartbeat(text) to authenticated;

-- Only tiny revision rows go through Realtime. Each private snapshot comes from the Edge Function.
do $$ begin
  if exists(select 1 from pg_publication where pubname = 'supabase_realtime') and not exists(
    select 1 from pg_publication_tables where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'edravane_room_events'
  ) then alter publication supabase_realtime add table public.edravane_room_events; end if;
end $$;
