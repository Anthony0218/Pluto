-- Keep departed players' saved results and stage score resets until the next deal.
alter table public.schafkopf_rooms
  add column former_players jsonb not null default '[]'::jsonb,
  add column pending_seats jsonb not null default '[]'::jsonb;

create index schafkopf_rooms_former_players_idx
  on public.schafkopf_rooms using gin (former_players jsonb_path_ops);
