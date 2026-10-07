-- Security hardening for tables that predate the migrations in this repository
-- (their original policies were created by hand in the Supabase dashboard).

-- ---------------------------------------------------------------------------
-- Saved chess games: only the owner may read or change a row.
-- The dropped policies let anonymous visitors read, insert, update and delete
-- every saved game, and let any signed-in user edit rows still marked 'waiting'
-- (the column default, so every saved game). The four "Users can ... their own
-- games" policies (auth.uid() = user_id) remain and cover everything the client does.
-- ---------------------------------------------------------------------------
drop policy if exists "Allow anyone to insert games" on public.games;
drop policy if exists "Allow anyone to read games" on public.games;
drop policy if exists "Allow delete games" on public.games;
drop policy if exists "Allow insert games" on public.games;
drop policy if exists "Allow read games" on public.games;
drop policy if exists "Allow update games" on public.games;
drop policy if exists "create game" on public.games;
drop policy if exists "join open game" on public.games;
drop policy if exists "read own or open games" on public.games;
revoke all on public.games, public.game_moves, public.online_games from anon;

-- ---------------------------------------------------------------------------
-- Profiles: a player may rename themselves and pick an avatar, nothing else.
-- Rating, win/loss counters, id and created_at were writable through the API.
-- Rows are created by the handle_new_user trigger, never by the client.
-- ---------------------------------------------------------------------------
revoke insert, update, delete on public.profiles from anon, authenticated;
grant update (username, display_name, avatar_id) on public.profiles to authenticated;
alter table public.profiles
  add constraint profiles_username_length check (char_length(btrim(username)) between 2 and 30),
  add constraint profiles_display_name_length check (display_name is null or char_length(display_name) <= 40);

-- ---------------------------------------------------------------------------
-- Friend requests: answered only through accept_friend_request and
-- decline_friend_request. The receiver could previously rewrite sender_id on a
-- pending request and then accept it, creating a friendship with someone who
-- never asked for one (which unlocks direct messages and presence).
-- ---------------------------------------------------------------------------
drop policy if exists "receiver can update friend request" on public.friend_requests;
revoke update, delete on public.friend_requests from anon, authenticated;
revoke insert on public.friend_requests from anon;
drop policy if exists "users can send friend requests" on public.friend_requests;
create policy "users can send friend requests" on public.friend_requests for insert to authenticated
  with check (sender_id = auth.uid() and receiver_id <> auth.uid() and status = 'pending');
