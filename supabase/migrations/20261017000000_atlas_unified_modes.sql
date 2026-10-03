-- Atlas Arena: every mode can be played online.
-- Races (Speed Run, Map Fill and the former Atlas Trials modes) run the same seed on every device and collect
-- live scores; Stat Battle is a two-player card duel. Both keep their live state in `state`.
alter table public.atlas_matches drop constraint if exists atlas_matches_mode_check;
alter table public.atlas_matches add constraint atlas_matches_mode_check
  check (mode in (
    'map_battle', 'closest_wins', 'higher_lower', 'territory_battle', 'flag_battle', 'guess_country',
    'speed_run', 'map_fill', 'stat_ranking', 'region_builder', 'stat_detective', 'country_guesser', 'extreme_geography',
    'stat_battle'
  ));

alter table public.atlas_matches add column if not exists state jsonb not null default '{}'::jsonb
  check (jsonb_typeof(state) = 'object');
