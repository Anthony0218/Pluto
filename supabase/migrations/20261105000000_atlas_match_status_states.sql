-- Atlas rooms could not be saved in two of their states. The live status check still listed
-- only the eight original states, without 'draft' (a Ranked match while bans are chosen) and
-- 'intermission' (the break between games of a best-of-three). The 20261019 migration defines
-- both, but the constraint on the live table did not match it. Every update that moved a
-- room into one of those states failed, so atlas-match answered "Could not save match."
-- (HTTP 400) and the room stayed in its previous state. This restates the full list.
alter table public.atlas_matches drop constraint if exists atlas_matches_status_check;
alter table public.atlas_matches add constraint atlas_matches_status_check
  check (status in ('waiting', 'draft', 'ready', 'intermission', 'countdown', 'round_active', 'round_resolving', 'next_round', 'finished', 'cancelled'));
