-- Extend existing saved game days to the five difficulty levels.
alter table public.schafkopf_rooms
  drop constraint if exists schafkopf_rooms_ai_difficulty_check;

alter table public.schafkopf_rooms
  add constraint schafkopf_rooms_ai_difficulty_check
  check (ai_difficulty in ('beginner', 'amateur', 'advanced', 'normal', 'pro', 'legend'));

update public.schafkopf_rooms set ai_difficulty = 'amateur' where ai_difficulty = 'normal';
alter table public.schafkopf_rooms alter column ai_difficulty set default 'amateur';

-- Zero keeps the difficulty-based timing until the host chooses a custom delay.
alter table public.schafkopf_rooms
  add column collect_seconds integer not null default 0 check (collect_seconds between 0 and 10);
