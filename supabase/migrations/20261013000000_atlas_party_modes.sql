-- Atlas Arena: Flag Battle and Guess the Country, and rooms for two to four players.
-- Guess the Country reveals one tip per round; tip_index tracks the tip of the current country.
alter table public.atlas_matches drop constraint if exists atlas_matches_mode_check;
alter table public.atlas_matches add constraint atlas_matches_mode_check
  check (mode in ('map_battle', 'closest_wins', 'higher_lower', 'territory_battle', 'flag_battle', 'guess_country'));

alter table public.atlas_matches drop constraint if exists atlas_matches_players_check;
alter table public.atlas_matches add constraint atlas_matches_players_check
  check (jsonb_typeof(players) = 'array' and jsonb_array_length(players) between 1 and 4);

alter table public.atlas_matches add column if not exists tip_index integer not null default 0 check (tip_index >= 0);
