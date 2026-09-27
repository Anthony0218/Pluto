-- Private authoritative state. Never add this table to the realtime publication:
-- it contains all four hands. Clients only receive redacted Edge Function views.
create table public.schafkopf_rooms (
  id uuid primary key default gen_random_uuid(),
  code text not null unique check (code ~ '^[A-Z0-9]{6}$'),
  host_id uuid not null references auth.users(id) on delete cascade,
  players jsonb not null default '[]'::jsonb check (jsonb_typeof(players) = 'array' and jsonb_array_length(players) between 1 and 4),
  game jsonb,
  version integer not null default 0 check (version >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.schafkopf_rooms enable row level security;
revoke all on table public.schafkopf_rooms from anon, authenticated;
grant all on table public.schafkopf_rooms to service_role;
create index schafkopf_rooms_host_idx on public.schafkopf_rooms(host_id);
