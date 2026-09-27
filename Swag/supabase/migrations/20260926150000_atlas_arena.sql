-- Atlas Arena rooms are server-authoritative. Clients may observe rooms they
-- belong to, but only the atlas-match Edge Function can change match state.
create table public.atlas_matches (
  id uuid primary key default gen_random_uuid(),
  room_code text not null unique check (room_code ~ '^[A-Z0-9]{6}$'),
  mode text not null check (mode in ('map_battle', 'closest_wins', 'higher_lower', 'territory_battle')),
  host_id uuid not null references auth.users(id) on delete cascade,
  players jsonb not null default '[]'::jsonb check (jsonb_typeof(players) = 'array' and jsonb_array_length(players) between 1 and 2),
  status text not null default 'waiting' check (status in ('waiting', 'ready', 'countdown', 'round_active', 'round_resolving', 'next_round', 'finished')),
  dataset_version text not null,
  seed text not null,
  settings jsonb not null default '{}'::jsonb,
  round_index integer not null default 0 check (round_index >= 0),
  round_started_at timestamptz,
  round_ends_at timestamptz,
  resolve_at timestamptz,
  submissions jsonb not null default '[]'::jsonb check (jsonb_typeof(submissions) = 'array'),
  scores jsonb not null default '{}'::jsonb check (jsonb_typeof(scores) = 'object'),
  ownership jsonb not null default '{}'::jsonb check (jsonb_typeof(ownership) = 'object'),
  round_result jsonb,
  version integer not null default 0 check (version >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.atlas_matches enable row level security;
create policy "atlas participants read" on public.atlas_matches for select to authenticated
  using (exists (select 1 from jsonb_array_elements(players) player where player->>'id' = auth.uid()::text));
revoke insert, update, delete on public.atlas_matches from anon, authenticated;
grant select on public.atlas_matches to authenticated;
grant all on public.atlas_matches to service_role;
create index atlas_matches_host_idx on public.atlas_matches(host_id);
create index atlas_matches_updated_idx on public.atlas_matches(updated_at);
alter publication supabase_realtime add table public.atlas_matches;

-- Keep dashboard visit tracking in sync with games added after the dashboard
-- migration. Without this replacement, visiting Atlas Arena, Go, or Shogi
-- raises "Unknown game" and PostgREST returns HTTP 400.
create or replace function public.record_dashboard_visit(p_game_route text) returns void
language plpgsql security definer set search_path = '' as $$
begin
  if auth.uid() is null then raise exception 'Authentication required'; end if;
  if p_game_route not in (
    '/games/atlas-arena',
    '/games/go',
    '/games/shogi',
    '/games/chess',
    '/games/chess/3dchess',
    '/games/watten',
    '/games/schafkopf',
    '/games/natura',
    '/games/medieval-kingdoms'
  ) then
    raise exception 'Unknown game';
  end if;
  insert into public.dashboard_game_visits (user_id, game_route)
  values (auth.uid(), p_game_route)
  on conflict (user_id, game_route, visited_on)
  do update set last_visited_at = now();
end;
$$;

revoke all on function public.record_dashboard_visit(text) from public, anon;
grant execute on function public.record_dashboard_visit(text) to authenticated;
