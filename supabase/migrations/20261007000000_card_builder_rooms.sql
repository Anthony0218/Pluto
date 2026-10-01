-- Card Builder online rooms. A room is a card_game_sessions row with a share
-- code: it stays 'waiting' while people join with the code, then the host
-- starts it and empty seats are filled with bots. Solo sessions (startSession)
-- have no code. All writes still go through the card-games edge function.

alter table public.card_game_sessions
  add column code text unique check (code ~ '^[A-Z2-9]{6}$');

-- Shown on the table; copied from the profile when the seat is taken.
alter table public.card_game_players
  add column name text not null default 'Player' check (char_length(btrim(name)) between 1 and 40);
