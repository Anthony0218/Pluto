-- Private, account-scoped Go game library. The full verified record is kept
-- together so passes, captures, adjudicated dead stones and metadata survive.
create table if not exists public.go_saved_games (
  id uuid primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  saved_at timestamptz not null,
  record jsonb not null check (
    jsonb_typeof(record) = 'object'
    and record->>'id' = id::text
    and record->>'ownerId' = user_id::text
    and octet_length(record::text) <= 1500000
  ),
  created_at timestamptz not null default now()
);
create index if not exists go_saved_games_owner_date on public.go_saved_games (user_id, saved_at desc);
alter table public.go_saved_games enable row level security;
create policy "Owners manage their Go games" on public.go_saved_games
  for all to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
grant select, insert, update, delete on public.go_saved_games to authenticated;
