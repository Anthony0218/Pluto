alter table public.atlas_matches drop constraint if exists atlas_matches_mode_check;
alter table public.atlas_matches add constraint atlas_matches_mode_check
  check (mode in (
    'map_battle', 'closest_wins', 'higher_lower', 'territory_battle', 'flag_battle', 'guess_country',
    'speed_run', 'map_fill', 'stat_ranking', 'region_builder', 'stat_detective', 'country_guesser', 'extreme_geography',
    'stat_battle', 'language_guesser'
  ));
