# Dashboard data setup

Apply `migrations/20260925120000_dashboard.sql` to the same Supabase project used by the app, using the Supabase SQL editor or your normal migration workflow. It depends on the existing `profiles`, `friendships`, and authentication schema. This change does not deploy the migration automatically.

The dashboard uses the existing profile username, avatar, rating, games played, wins, losses, and draws. Profile edits refresh the shared auth state. XP, levels, and lesson completion are not shown because this app does not currently record them.

New data:

- `dashboard_game_visits`: one row per account, game, and UTC day. Only the owner can read it. Server functions set the account and timestamp. This tracks exploration, not wins or completed matches; past game activity is not backfilled.
- `dashboard_challenges`: the initial daily challenge asks the user to explore two different games. The title, description, and target are database configuration. Progress counts distinct games visited today and resets at midnight UTC.
- `user_presence`: visible signed-in app sessions send a heartbeat every 30 seconds. Friends count as online for 90 seconds after the latest heartbeat. Only the account and its accepted friends can read its presence. Multiple tabs are supported without one tab marking another offline.

The dashboard refreshes every 30 seconds and on window focus. It also listens for friendship updates when that table is enabled for Supabase Realtime; polling works without it. No Realtime publication change is required for the new tables.

After applying the migration, visit two different game pages and return to the dashboard. Confirm that the challenge shows 2/2, the activity streak starts at 1, and the recent games match those pages. With two accepted friend accounts open in separate sessions, confirm the online count and open chat. A closed or hidden session ages out after 90 seconds plus the dashboard refresh interval.

Navigation and game descriptions use the shared application catalog in `src/data/games.ts`. When adding another game, also update the route allowlist in `record_dashboard_visit` through a new migration.
