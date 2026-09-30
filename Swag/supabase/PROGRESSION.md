# Progression and community expansion

The linked project reports migrations through `20260928200000` as applied.
Check the migration list again before any future database push.

## Current result contract

`user_game_results` stores one result per player and source match/round. Database
triggers populate it on the first transition to a finished state. Its primary
key prevents duplicate processing after reconnects or repeated updates. Profile
statistics aggregate this ledger in `get_my_game_stats`; opening a lobby never
counts. Legacy profile counters remain untouched. No historical backfill is
attempted because the previous schema does not retain a verified result for
every older match.

- Classic Chess: one finished room game per player, including rematches. Winner
  comes from the existing `chess_games` record. Casual matches do not change
  Elo.
- Schafkopfen: one completed scored round per human player. `score_difference`
  is that seat's signed `game.result.deltas[seat]` from the existing scoring
  engine. A positive delta counts as a win; a negative delta as a loss. It is
  multiplayer when at least two humans occupy the room.
- Four-player Watten: one finished match per player. `score_difference` is the
  player's final team score minus the opposing team's final score. Even seats
  are Team A, odd seats Team B, matching the current game UI.
- Three-player Watten: one finished match per player. The solo seat's score is
  compared with the higher of the two partner scores, matching the match
  scoreboard; each player's side receives the signed difference.
- Atlas Arena: one finished online match per player; winner compares the
  server-stored final scores.
- Go/Shogi: one finished online match per player; winner comes from the server
  game state's black/white result.

Natura, Medieval Kingdoms, local/AI Chess, and local
Go/Shogi are not recorded. Their current paths do not expose a durable,
per-account result with the needed scoring and identity. The corresponding
profile tabs show that verified completion data is unavailable rather than
inventing totals.

## Quests and facts

The 60 quest definitions extend `dashboard_challenges`. Only entries with a
persisted progress source have `active = true`. `get_daily_quests` chooses one
general, one Chess/puzzle, and one discovery/other-game quest per UTC day.
Result and visit progress is calculated in SQL from durable rows. Puzzle
progress is calculated in SQL from saved completions and their real difficulty,
category, timestamp, and mistake count. Profile puzzle totals use a separate
SQL aggregate so they are not capped by a client list query. A refresh does not
create progress. The existing puzzle completion RPC accepts client-submitted
mistake counts; puzzle precision is therefore not suitable for competitive
ranking until the server verifies attempts itself.
Disabled quests document the event contract needed before activation. If the
new quest RPC is unavailable, the dashboard reports quests as unavailable
instead of showing an older challenge with a mismatched progress rule.

The 60 dashboard facts live in `src/data/didYouKnow.ts`. The carousel shows a
deterministic set of five per UTC day, so reloads keep the same set while
consecutive days rotate. They require no database writes.

## Groups and invitations

`community_groups.owner_id` is unique, enforcing at most one owned group even
under concurrent requests. Memberships have a composite unique key and no
count limit. Authenticated RPCs perform create, join, edit, leave, remove,
disband, and share operations. Game invites reference existing Chess, Go, or
Shogi room codes. The server checks lobby status and that the sender occupies
the room before sharing. Joining still calls the existing game RPC or Edge
Function, which makes the final capacity and authorization decision. Invites
expire after one day and display full or ended status on refresh.

The avatar manifest uses 28 stable IDs. Five themes have original generated
PNG art; the remaining themes use the project's Lucide icon system with themed
color treatments. All art is project-local, and no remote image URL is accepted.

## Ranked foundation

`chess_ratings` and `ranked_chess_matches` are isolated from the old generic
`profiles.rating`. The Elo calculation starts at 1200, uses K=32 for the first
20 rated games and K=20 afterward, and rounds to integers. The service-only
`apply_verified_ranked_chess_result` routine reads a finished ranked room and
updates both players and match history in one transaction. Players enter an
automatic Elo-aware matchmaking queue. A service-only wrapper now runs the
existing Chess start routine as soon as both players are seated. The
`ranked-chess` Edge Function replays stored moves with chess.js, validates
new moves and outcomes, handles undo requests and resignations, and calls
the service-only Elo routine. The guard migration blocks legacy client RPCs
from changing active ranked games. Each room's `ranked_round` gives rematches
a unique rating key even if its move version restarts. The Edge Function was
deployed to the linked project on 2026-09-28. Its browser preflight returned
HTTP 200 and an unauthenticated POST returned the expected HTTP 401 response.
A two-account test then reported `record "old" has no field "ranked_round"`
while starting the match. Migration `20260928210000` was applied to the linked
database on 2026-09-28 to restore the column if needed and replace the guard
trigger. A fresh two-account retest now starts and plays without that error.
The ranked
function now checks `chess_games.status` before resuming a claimed queue entry
and clears both queue entries after a finished match is settled. That fixes a
completed game reopening from the ranked menu while its room remains marked
`playing`. The multiplayer board asks a player to choose a side when they
click their piece before choosing a color in casual games. A two-account retest
confirmed both the side prompt and staying on the ranked menu after a completed
game. Ranked colors are now assigned at random by the start service and revealed
through two face-down cards on each player's game screen; the old client side
selector is hidden for ranked games. Migration `20260928220000` protects those
colors from client changes. The ranked leave confirmation quotes the Elo loss
and submits a resignation before navigating away. The server's existing
settlement applies the rating loss; the user confirmed ordinary ranked
resignation now decreases Elo. The completed two-card and leave flow still
needs a two-account UI retest.

The ELO leaderboard queries only the top ten rated players, ordered by rating,
rated game count, then user ID. Profile visibility is enforced by the
invoker's existing profile RLS. The perfect puzzle board is intentionally
unranked until the server independently verifies complete puzzle attempts and
mistake counts; current clients submit those counts to the existing RPC.

## Deployment checks

1. Verify a ranked queue match with two signed-in accounts, including automatic
   game start, completion, rating update, and queue cancellation.
2. With two test accounts, create, join, and disband groups; check the owner
   unique constraint and membership isolation.
3. Finish and rematch a Chess game, a four-player Watten match, a scored
   Schafkopfen round, and an Atlas/Go/Shogi match. Confirm one result per player
   per completion and that repeat updates do not add rows.
4. Check daily quest rotation across a UTC date boundary and puzzle counts by
   difficulty and mistakes.
5. With two test accounts, play ranked wins, losses, draws, resignation, undo
   acceptance/decline, and the leave confirmation. Confirm each completed game changes Elo
   exactly once and that the leaderboard and rating deltas agree.

The ranked queue, auto-start, guard repair, and color draw migrations were
applied to the linked database; the `ranked-chess` Edge Function was deployed
there with the forfeit quote endpoint.
