# Go Ranked implementation

Go Ranked is implemented in the frontend, verified Edge Function, and database
migration. It shares Chess's lobby, Elo algorithm, tier icons, Top 10 medallion,
leaderboard table, authentication client, player/result card, queue session
registry, mutex, rating-range expansion, and deterministic ranking order.
Chess's FEN-specific tables/triggers remain intact. The existing Go review
component is unchanged. Only its storage integration was extended to preserve
ranked timeout and off-turn resignation results when replaying saved moves.

## Modes and ratings

| Mode | Clock | Board | Komi |
| --- | --- | --- | --- |
| Blitz | 30 seconds + 5 × 10-second periods | 9 × 9 | 6.5 |
| Normal | 5 minutes + 5 × 30-second periods | 9 × 9 | 6.5 |

These use Japanese byo-yomi. Main time runs down first. Once it is exhausted,
a legal placement or pass resets the current period; completely elapsed periods
are permanently consumed. Exhausting the last period loses on time. Clocks and
remaining periods are enforced atomically by PostgreSQL, continue during
disconnection, and are projected in the browser using the server timestamp.
Normal is the default. Removed Bullet/Rapid preferences fall back to Normal.
Configuration lives in `src/games/go/ranked/config.ts`; the migration's database
clock configuration is checked against it by the database tests.

Every existing/new user receives independent 1200 Go ratings for both
modes. Chess ratings are preserved. Elo matches Chess:
`max(100, round(rating + K × (score − expected)))`, where
`expected = 1 / (1 + 10^((opponent − rating)/400))`, with K=32 for the first
20 completed rated games and K=20 thereafter. Wins/losses, jigo/draws, peaks,
and before/after rating history are persisted.

## Commercial use of timing rules

The numeric presets and traditional byo-yomi rules are used as game mechanics.
The U.S. Copyright Office states that game ideas and methods of play are not
protected by copyright ([Games](https://www.copyright.gov/register/tx-games.html));
Germany's copyright law likewise excludes underlying software ideas/principles
([UrhG §69a(2)](https://www.gesetze-im-internet.de/urhg/__69a.html)).
The clock code and UI explanation were independently written in this repository;
no OGS code, assets, written descriptions, package, or service was imported.
These timing changes therefore add no third-party licence or attribution requirement.
This assessment concerns these timing mechanics, not a legal clearance of the
website's other dependencies/assets or a worldwide patent/trademark audit.
The presets are documented in the [OGS wiki](https://github.com/online-go/online-go.com/wiki/Finding-%26-Starting-a-Game#automatch-time-controls).

## Match lifecycle and settlement

- Match only Go players in the same mode. The search range starts at ±250 Elo
  and expands by 100 per waiting minute, matching Chess.
- A user has one Go queue entry. Mode/session changes replace it. Shared queue
  leases/mutex exclude simultaneous Chess and Go searches or live ranked games.
- Polling, cancellation, pagehide, navigation, stale-session tombstones and
  12-second leases use the existing Chess lifecycle. Shared lease garbage
  collection safely cascades expired Go queue entries without breaking Chess.
- Opponents open the same persisted game, see colors, names/avatars, Go Elo,
  tier emblems, exact ranks and Top 10 badges. Both must connect within 30
  seconds; failure to start abandons the game without rating or history changes.
- Clocks run once both connect. Reconnect restores the authoritative position
  and remaining times. Disconnect does not pause the clock; flag fall is a loss.
  A scheduled 10-second database maintenance job handles absent browsers.
- The Edge Function verifies the bearer token, membership, turn, legal integer
  coordinates and optimistic version. The shared Go rules decide score/results;
  clients cannot declare wins or draws. Off-turn resignation is supported.
- Database row locks serialize moves with flag fall. A move after the deadline
  cannot overwrite a timeout. Result, both rating changes and both immutable
  `user_game_results` rows commit together. A unique result key and ordered
  rating locks make settlement idempotent across requests/reloads/retries.
- Ranked rematches return to matchmaking, like Chess.

## Leaderboard, profiles and history

Order: rating DESC, rated games DESC, user ID ASC, exactly as Chess. Eligible
players have at least one completed rated game and an existing profile.
`get_go_elo_leaderboard` provides database row numbers with bounded pagination.
`get_go_ranked_profile` counts indexed predecessors using that same ordering;
no complete leaderboard is downloaded to calculate a user's position.

The shared table preserves podium colors and uses the actual Chess SVG tier
emblems and animated Top 10 medallion. Top 10 is strictly positions 1–10
inclusive. Exact positions remain visible in badges/cards and an off-page
current-user row stays pinned. Pagination continues 51, 52, etc.

Both Go ratings, tiers, exact positions, games, wins/losses/jigo and peaks
appear on private/public profiles. Rankings reload after result settlement, on
focus and every 15 seconds while displayed. Game history uses the existing
result ledger and profile history integration, with Black/White players, mode,
board/komi, result/reason, date, rating delta and persisted Game Review links.
Zero-move finishes link to the result because the existing review requires moves.

## Migration and deployment

Added `supabase/migrations/20261020000000_go_ranked.sql` and
`supabase/functions/ranked-go/index.ts`, registered in `supabase/config.toml`.
The Go migration has not been deployed, so its original schema now defines only
Blitz and Normal, including persisted main time, period duration, and per-player
period counts. The actual Chess and Go migration chain ran successfully in PGlite against the
repository's hosted base-schema test contract. The pg_cron schedule is excluded
from WASM because that extension is unavailable there; its exact maintenance
function is tested directly.

**Hosted deployment is pending.** Local `supabase status` cannot inspect a local
stack because Docker/Podman is unavailable. No hosted schema or Edge Function
was deployed. Apply the migration and deploy `ranked-go` before using the new
ranked routes against Supabase. The migration depends on the already-established
Chess, profile and immutable game-result schema.

## Validation

Updated checks after replacing the three sudden-death modes with two byo-yomi modes:

- `npm run test:ranked`: **57 passed**, including both Go modes, unchanged Chess
  modes, restored/removed saved preferences, exact period boundaries, legal move
  and pass resets, multiple consumed periods, independent player clocks, snapshot
  and maintenance behavior, reconnects, deadline races, and duplicate settlement.
- `npm run test:go`: **49 passed**, including Go rules, bots, review/storage,
  existing ranked integration, and the new byo-yomi coverage.
- Database/browser clock parity is checked across both presets, partially used
  periods, exact main/overtime deadlines, and very long disconnections.
- `npx tsc -b` and `npm run build`: passed, including application/party typechecks
  and Vite production build. The existing chunk-size warning remains.
- Focused ESLint across all ranked Go code, the shared lobby, global leaderboard,
  and Go Edge Function: passed. `git diff --check`: passed.
- The earlier full repository suite passed **996 tests** before this timing change;
  it was not rerun for this update. Earlier full lint found **154 existing errors
  and 70 warnings**; the edited/new ranked files pass focused lint.
- Database tests apply the actual Chess and Go migrations in embedded PostgreSQL.
  Authenticated requests execute the actual Go Edge Function against that database.
  Hosted deployment, cron installation and two-account browser play remain pending.

The existing ranked tests continue to cover default/backfilled ratings, Chess
independence, queue/session changes, auth/membership and RLS, wins/losses/draws,
resignation, abandonment, duplicate settlement, atomic rollback, leaderboard ties
and pagination, exact/off-page positions, Top 10 boundaries, real SVG tiers,
pinned rows and review storage.

## Files changed or added

- `GO_RANKED_IMPLEMENTATION.md`
- `package.json`
- `src/components/ranked/GoRankedHistory.tsx`
- `src/components/ranked/GoRankedLeaderboard.tsx`
- `src/components/ranked/GoRankedProfile.tsx`
- `src/components/ranked/RankedPlayerBar.tsx`
- `src/components/social/LeaderboardTable.tsx`
- `src/components/strategy/StrategyModeMenu.tsx`
- `src/games/chess/ranked/client.ts`
- `src/games/go/README.md`
- `src/games/go/ranked/clock.ts`
- `src/games/go/ranked/config.ts`
- `src/games/go/ranked/leaderboard.ts`
- `src/games/go/ranked/profile.ts`
- `src/games/go/ranked/types.ts`
- `src/games/go/storage.ts`
- `src/main.tsx`
- `src/pages/games/Chess/ChessMultiplayerGame.tsx`
- `src/pages/games/Chess/ChessRankedLobby.tsx`
- `src/pages/games/Go/GoRankedGamePage.tsx`
- `src/pages/social/LeaderboardsPage.tsx`
- `src/pages/social/ProfilePage.tsx`
- `src/pages/social/PublicProfilePage.tsx`
- `supabase/config.toml`
- `supabase/functions/ranked-go/index.ts`
- `supabase/migrations/20261020000000_go_ranked.sql`
- `tests/chess-ranked-database.test.mjs`
- `tests/chess-ranked-queue-client.test.mjs`
- `tests/go-ranked-byoyomi.test.mjs`
- `tests/go-ranked-client.test.mjs`
- `tests/go-ranked-database.test.mjs`
- `tests/go-ranked-endpoint.test.mjs`
- `tests/go-review-availability.test.mjs`
- `tests/helpers/ranked-database.mjs`
- `tests/helpers/typescript-paths.mjs`
