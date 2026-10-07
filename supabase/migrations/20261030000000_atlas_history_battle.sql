-- History Battle takes Territory Battle's place in Atlas Arena. 'territory_battle' stays in the list so rooms
-- finished before the change still satisfy the constraint; the match function no longer creates them.
alter table public.atlas_matches drop constraint if exists atlas_matches_mode_check;
alter table public.atlas_matches add constraint atlas_matches_mode_check
  check (mode in (
    'map_battle', 'closest_wins', 'higher_lower', 'territory_battle', 'flag_battle', 'guess_country',
    'speed_run', 'map_fill', 'stat_ranking', 'region_builder', 'stat_detective', 'country_guesser', 'extreme_geography',
    'stat_battle', 'language_guesser', 'history_battle'
  ));
