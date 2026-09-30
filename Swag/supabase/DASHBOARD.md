# Dashboard data setup

## September 27 redesign

Apply `migrations/20260927120000_dashboard_redesign.sql` after the existing migrations. This migration is provided locally; it is not automatically deployed.

- Favorites reuse `user_game_favorites` and the atomic `set_favorite_games` RPC. The limit is eight; the first three appear prominently. `set_favorite_games` validates the route shape (`/games/...`) instead of a hard-coded list, so new games need no migration (`20261002000000_favorite_games_all_routes.sql`; apply it if saving fails with "Unknown game"). `dashboard_preferences` records whether a user has saved even an empty selection. `get_favorite_games` returns null for an unconfigured account, allowing Chess → Watten → Schafkopf defaults. Existing selections retain their order. Guests use `pluto-favorite-games` in localStorage; signed-in cache keys include the user ID. Server failures are shown and do not silently replace server storage with a local save.
- The existing `dashboard_challenges` catalog now includes category, destination, and CTA. `get_dashboard_activity` deterministically selects an active row using the UTC date and user ID. Existing streak and recent activity calculations are retained in `get_dashboard_activity_base`. Changing the catalog can change the selection; ordinary refreshes cannot.
- Exploration counts existing daily game visits. Learning and variant goals explicitly ask users to open a resource; `dashboard_resource_visits` records that action, not lesson completion. Social goals count actual room invitations sent via the existing chat. Puzzle goals use the existing `get_completed_chess_puzzles` RPC and count library completions within the selected UTC day. If that RPC is unavailable, progress is marked unavailable rather than fabricated.
- The typed UI supports puzzle, learning, play, win, explore, social, and variant categories. Play/win goals are not seeded because profile totals cannot establish today's match results. No XP is awarded or invented. Friend presence exposes online/offline only, so the dashboard does not invent playing/learning statuses or joinable rooms.
- Desktop sidebar visibility uses `pluto-dashboard-sidebar-{userId}` (or `guest`) in localStorage. Small screens use a modal drawer without changing the desktop preference.
- Existing installations awaiting migration still load their three stored favorites and the original exploration challenge. Saving more than three favorites requires the new migration. New resource tracking also requires it.

Verification after migration: save and reorder six favorites, refresh, sign in on another browser, then save an empty list and verify it stays empty. Confirm daily challenges are unchanged across refreshes. Open a learning destination or send an invitation when selected, then return to the dashboard and allow its 30-second refresh. Complete a library puzzle when the puzzle goal is selected. Verify resets at midnight UTC and test RLS isolation with two accounts.

Apply `migrations/20260925120000_dashboard.sql` to the same Supabase project used by the app, using the Supabase SQL editor or your normal migration workflow. It depends on the existing `profiles`, `friendships`, and authentication schema. This change does not deploy the migration automatically.

The dashboard uses the existing profile username, avatar, rating, games played, wins, losses, and draws. Profile edits refresh the shared auth state. XP, levels, and lesson completion are not shown because this app does not currently record them.

New data:

- `dashboard_game_visits`: one row per account, game, and UTC day. Only the owner can read it. Server functions set the account and timestamp. This tracks exploration, not wins or completed matches; past game activity is not backfilled.
- `dashboard_challenges`: the initial daily challenge asks the user to explore two different games. The title, description, and target are database configuration. Progress counts distinct games visited today and resets at midnight UTC.
- `user_presence`: visible signed-in app sessions send a heartbeat every 30 seconds. Friends count as online for 90 seconds after the latest heartbeat. Only the account and its accepted friends can read its presence. Multiple tabs are supported without one tab marking another offline.

The dashboard refreshes every 30 seconds and on window focus. It also listens for friendship updates when that table is enabled for Supabase Realtime; polling works without it. No Realtime publication change is required for the new tables.

After applying the migration, visit two different game pages and return to the dashboard. Confirm that the challenge shows 2/2, the activity streak starts at 1, and the recent games match those pages. With two accepted friend accounts open in separate sessions, confirm the online count and open chat. A closed or hidden session ages out after 90 seconds plus the dashboard refresh interval.

Navigation and game descriptions use the shared application catalog in `src/data/games.ts`. When adding another game, also update the route allowlist in `record_dashboard_visit` through a new migration.
