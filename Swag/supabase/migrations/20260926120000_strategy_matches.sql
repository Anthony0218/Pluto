-- Authoritative, reconnectable Go and Shogi rooms. Clients may read only rooms
-- they belong to; all mutation is performed by the strategy-match Edge Function.
create table public.strategy_matches (
  id uuid primary key default gen_random_uuid(),
  room_code text not null unique check (room_code ~ '^[A-Z0-9]{6}$'),
  game_type text not null check (game_type in ('go', 'shogi')),
  host_id uuid not null references auth.users(id) on delete cascade,
  players jsonb not null default '[]'::jsonb check (jsonb_typeof(players) = 'array' and jsonb_array_length(players) between 1 and 2),
  settings jsonb not null default '{}'::jsonb,
  game_state jsonb,
  version integer not null default 0 check (version >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.strategy_matches enable row level security;
create policy "strategy participants read" on public.strategy_matches for select to authenticated
  using (exists (select 1 from jsonb_array_elements(players) player where player->>'id' = auth.uid()::text));
revoke insert, update, delete on public.strategy_matches from anon, authenticated;
grant select on public.strategy_matches to authenticated;
grant all on public.strategy_matches to service_role;
create index strategy_matches_host_idx on public.strategy_matches(host_id);
alter publication supabase_realtime add table public.strategy_matches;
