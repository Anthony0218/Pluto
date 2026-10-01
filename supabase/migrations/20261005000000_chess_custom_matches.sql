-- Chess Custom online rooms. All writes go through chess-custom-match, which
-- imports the same declarative rule engine as the browser and validates moves.
create table public.chess_custom_matches (
  id uuid primary key default gen_random_uuid(),
  code text not null unique check (code ~ '^[A-Z2-9]{6}$'),
  host_id uuid not null references auth.users(id) on delete cascade,
  guest_id uuid references auth.users(id) on delete set null,
  variant_id text not null,
  schema_version integer not null,
  revision integer not null,
  configuration_hash text not null check (configuration_hash ~ '^[0-9a-f]{64}$'),
  variant jsonb not null check (jsonb_typeof(variant) = 'object' and pg_column_size(variant) <= 524288),
  state jsonb not null check (jsonb_typeof(state) = 'object' and pg_column_size(state) <= 524288),
  history jsonb not null default '[]'::jsonb check (jsonb_typeof(history) = 'array' and pg_column_size(history) <= 524288),
  status text not null default 'waiting' check (status in ('waiting', 'playing', 'finished')),
  version integer not null default 1,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index chess_custom_matches_host_idx on public.chess_custom_matches(host_id, updated_at desc);
create index chess_custom_matches_guest_idx on public.chess_custom_matches(guest_id, updated_at desc);
alter table public.chess_custom_matches enable row level security;
revoke all on public.chess_custom_matches from anon, authenticated;
