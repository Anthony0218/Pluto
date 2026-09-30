# Ranked Chess and Eat It implementation

## Existing work preserved

The starting commits were `49f1be2` (Eat It) and `76cf76a` (ranked chess). The project already had Supabase auth, Edge Functions, versioned database state, Realtime subscriptions, chess.js validation for ranked play, optimistic chess variant clients, ranked ratings, a shared authoritative Eat It simulation, two maps, bots, Canvas rendering, power-ups, prediction/interpolation and tests. Those systems remain in use. The pre-existing pnpm lock changes and unrelated parent-directory `.DS_Store` were preserved.

## Chess

The classic multiplayer page explicitly waited for its request and a subsequent database read before moving a piece. It now validates with chess.js and renders a separate pending position immediately. Complete authoritative snapshots replace that preview, without appending SAN again. A synchronous in-flight guard prevents repeat submission. Stale versions are rejected before board/audio updates; errors drop the preview immediately and refresh authority. Realtime, HTTP-before-Realtime, rejection and delayed-response ordering are tested. Existing variants already used optimistic paths and were inspected rather than rewritten.

Standard casual and ranked move intent now use the existing `ranked-chess` Edge Function. Casual requests never access ranked clocks. The service checks membership, assigned color, turn, version and legality, replays history, and computes results. The legacy client-FEN move RPC is revoked. Existing variant-specific validation/RPCs and undo systems remain unchanged.

Queue operations run in one database transaction under a matchmaking lock. Each page/queue attempt owns a UUID lease. Cleanup uses authenticated keepalive fetch on `pagehide` and component unmount; late responses cannot navigate an unmounted page. Cancelled session tombstones prevent a delayed join from reviving a departed queue. Heartbeats run every 2.5 seconds, leases become ineligible after 12 seconds, and server maintenance removes stale entries. A unique user key prevents duplicates. Match receipts and game records are separate: cleanup never deletes a running game. Refresh can recover a running match by membership.

Only ranked rows receive 300,000 ms per side. A database trigger debits the old active side using database time, switches after the validated move, and stops both clocks on completion. A move reaching the database after the deadline cannot overwrite flag fall. Reads and periodic maintenance adjudicate timeout; neither needs a client countdown. Display samples use `performance.now()`, reconcile on Realtime/HTTP, and resync on focus/visibility. Warnings appear below 60 and 10 seconds. A bare opposing king yields a timeout draw; chess.js retains its existing dead-material detection. The exception follows [FIDE article 6.9](https://handbook.fide.com/chapter/E012023).

## Eat It

The creature is a deep circular mouth with a thin colored lip and tiny eyes. Mouth proportions, fit rules, temporary size and rendering share constants. Growth is smoothly rendered. Expressions cover food, swallowing, chewing, danger, speed, Magnet and player consumption. Menu artwork/previews match the new silhouette.

Edibility uses projected oriented bounds, not mass. A valid object must fit, enter the front lip, clear the sides, be descending or stationary over the opening (or move inward relative to the player), and cross the depth threshold before receiving a reward. Back/eye/body contact cannot trigger consumption. Normal remote attraction was removed. Magnet only attracts fitting props in range; anchored buildings are excluded. Once an object has crossed the entrance, its reserved swallow can settle inward and drop below the mouth. Clip masks, darkening, tilt and shrinking provide depth.

Forty-plus object definitions cover tiny through huge tiers, with dimensions, weight, growth, score, rarity and physics metadata. City and Nature have distinct spawn weights and ground drag. Buildings remain anchored until valid entry, then shake, tilt and collapse into the mouth over 1.15 seconds. Their rewards are significant and scale down above the mass soft cap. Player eating requires at least 1.30× radius (1.69× mass without effects/caps), physical fit, front contact and no shield; elimination and rewards remain atomic and server-owned.

Speed, Shield, Magnet and permanent Growth Boost remain. Temporary Size and Growth Multiplier add durations, icons, HUD countdowns and visual feedback. Timed duplicates refresh duration without stacking strength. Size expiry ejects unfinished objects safely. Bots use the same fit rules and avoid nearby oversized props.

Physics stays in mutable serializable state at 30 Hz; Canvas renders through requestAnimationFrame, and React receives HUD snapshots at 10 Hz. Sleeping props skip integration, a spatial grid limits prop collision queries, simple colliders bound cost, and existing object/particle caps and cached terrain remain. Multiplayer sends only input; the Edge Function owns consumption, size, elimination, powers, rewards and results. Compare-and-swap retries prevent double consumption.

## Rollout and limits

Apply `supabase/migrations/20260929000000_ranked_lifecycle_clocks.sql`, deploy the updated `ranked-chess` and `eat-it-match` functions, then deploy the frontend together. Inspect pending migrations first. The queue protocol and casual move endpoint changed, so mixed old/new clients are not a supported rollout state. Existing active ranked games receive five minutes per side once during migration.

The migration schedules maintenance every five seconds and requires pg_cron with seconds scheduling (1.5+; see [pg_cron documentation](https://github.com/citusdata/pg_cron)). Hard-disconnected queues become ineligible after 12 seconds and are physically removed on maintenance; background timeout persistence can lag by up to one maintenance interval, but late moves are rejected at the exact database deadline. Actual schema/function deployment, hosted Realtime, cron installation and authenticated two-browser/eight-human load tests remain unverified. Local PostgreSQL tests use minimal contracts for historical base tables/RPCs absent from this repository; the new functions/triggers are executed as written.

Eat It retains request-driven server simulation with bounded catch-up and full snapshot writes. Geometry is simplified, not pixel-perfect; ordinary scenery still includes non-edible obstacles. Swallowing is a 2D depth illusion, not structural fracture simulation. Rare chess positions requiring exhaustive proof that no legal mating sequence exists are not solved beyond existing chess.js material rules and the bare-king timeout exception.

The local Eat It arena was visually inspected before browser automation was blocked by an automatic approval-review usage-limit failure. Further browser checks were not bypassed.

## Changed files

- Chess: `src/pages/games/Chess/ChessRankedLobby.tsx`, `ChessMultiplayerGame.tsx`; `src/components/chess/multiplayer/RankedClock.tsx`; `src/games/chess/ranked/{client,clock}.ts`; `src/games/chess/multiplayer/position.ts`.
- Backend: `supabase/functions/ranked-chess/index.ts`; `supabase/migrations/20260929000000_ranked_lifecycle_clocks.sql`. Eat It server imports the updated shared engine directly.
- Eat It: `src/games/eat-it/{config,types,rules,engine,physics,spawn,bots,renderer,presentation}.ts`, `README.md`; `src/pages/games/EatIt/{EatItPage,EatItArena}.tsx`, `eat-it.css`; `public/images/eat-it.svg`; `src/i18n/eatItTranslations.json`.
- Tests: `tests/chess-ranked-{client,database,endpoint,queue-client}.test.mjs`, `tests/eat-it-mouth.test.mjs`, `tests/eat-it.test.mjs`, `tests/eat-it-multiplayer.test.mjs`.
- Tooling/documentation: `package.json`, `package-lock.json`, `pnpm-lock.yaml`, this report. PGlite is a development-only PostgreSQL regression-test dependency.

## Continuation audit — 2026-09-28

### Repository and scope

The previous implementation was intact: 23 tracked files were modified, with the report, new Chess modules, lifecycle migration and regression tests still untracked. HEAD was `49f1be2` (Eat It), following `76cf76a` (Ranked Chess). Existing lockfile edits and the parent-directory `.DS_Store` were preserved. The original full suite independently passed 234/234 and the original production build passed. A Vite server was already running on port 5173. Prior-session command exit statuses cannot be recovered from these files; the checks, including `git diff --check`, were rerun. No commits, resets, deployment or hosted data mutations were performed in this continuation.

### Additional fixes

- Ranked clock snapshots now take the per-room advisory lock before locking the game row, matching the actual Elo settlement function. The previous opposite order could deadlock simultaneous clock reads and result settlement.
- Ranked undo requests and declines advance the compare-and-swap version. Previously an already-validated move could commit after an undo request and leave an undo prompt referring to the wrong position. Declines preserve the one-request-per-move restriction.
- Board/preview/clock reconciliation compares the round before the version. The existing rematch contract permits resetting versions, so version-only comparisons could freeze the previous finished board and clocks. Casual rematches now also advance the existing round field while keeping every clock column NULL. Move/control requests include the round, and server writes compare both round and version; a delayed move from a previous round cannot enter the next game.
- A stale HTTP move acknowledgement cannot replay an end sound after its board snapshot has been rejected. Ranked undo request completion no longer writes a speculative prompt into the authoritative client snapshot.
- Eat It now resolves arena/scenery bounds immediately when a shrinking mouth releases an unfinished swallow. This fixes anchored buildings being ejected outside the arena and remaining there because they skip normal integration.

### Database and authority audit

Queue operations use a global transaction-scoped matchmaking advisory lock, the unique user primary key, session ownership checks, inactive-session tombstones, and a 12-second lease. Departure deletes only the caller's matching queue receipt; it does not delete game membership or a running match. RLS is enabled and queue/session mutations and lifecycle RPC execution are unavailable to `anon` and `authenticated`; only the service can call them. The Edge Function derives the user from `auth.getUser`, not request identity fields. Security-definer routines use an empty search path and schema-qualified application objects.

Clock initialization remains 300,000 ms per side, no increment. Database timestamps debit only the previous active side. The move trigger preserves the old board/history and produces timeout if the deadline has passed; row/version/round comparisons prevent conflicting writes. Reconnect reads and Realtime reconcile display samples; browser counters do not adjudicate results. Casual games remain untimed. Timeout's bare-king draw exception remains; exhaustive legal mating-possibility analysis is still outside this implementation.

The PostgreSQL test fixture now runs the real ranked foundation, guard, queue, color assignment, lifecycle and Elo settlement SQL, rather than a stub settlement function. Added checks exercise SQL privileges, cross-user lease ownership, idempotent ratings, rematches and casual clock isolation. Historical base room/create/join/start contracts are still minimal local fixtures. PGlite is single-connection: these tests do not establish real multi-connection PostgreSQL race behavior. Lock ordering was additionally reviewed against the actual settlement SQL. pg_cron installation/scheduling is still excluded from PGlite.

### Verification results

- Full suite: `node --test --test-concurrency=2 tests/*.test.mjs` — **243 passed, 0 failed, 0 skipped** (40.816 s). The concurrency limit keeps local compiler/test contention bounded.
- `npm run test:ranked` — **19 passed, 0 failed** (12.897 s). Coverage includes optimistic reconciliation, rejection, round reset, undo/move races, prior-round requests, database queue/clock/permissions/Elo and page lifecycle behavior. The six database tests were rerun after adding the historical autostart migration in chronological order and its execute-permission assertion.
- `npm run test:eat-it` — **66 passed, 0 failed** (19.432 s), including contact/fit/orientation, Magnet, building release, client/server state and bot simulations.
- `git diff --check` — passed.
- Final `npm run build` — passed (`tsc -b && vite build`), including the final round-aware request changes. Vite bundling took 5.17 s. Existing large-chunk and Vite configuration warnings remain. Deno is not installed; Edge handler behavior is exercised through transpiled endpoint tests, not a native Deno runtime/typecheck.
- Full ESLint: 167 errors and 69 warnings. Comparing all modified tracked TypeScript/TSX files against HEAD found no new diagnostics. `ChessMultiplayerGame.tsx` has the same 7 errors and 6 warnings as HEAD; the other affected modules/pages and all new TypeScript modules pass targeted lint (0 diagnostics). Unrelated legacy errors were left in place.
- Standalone eight-bot benchmark, seed 42, with numerical/object-cap/progress checks: City completed 7,216 ticks / 240.533 simulated seconds, mean 0.427 ms, p99 3.137 ms, maximum 10.588 ms per tick. Nature completed 8,480 ticks / 282.667 seconds, mean 0.388 ms, p99 2.401 ms, maximum 14.235 ms. Both stayed at or below 170 food objects and 7 powers; no invalid numeric state, endless match or bot stuck at its initial position. This does not prove bots never temporarily stall or navigate poorly.
- Timing under concurrent full tests, compiler and lint was substantially worse (p99 45–64 ms, maximum 658 ms). The isolated measurements above distinguish engine cost from local contention; these are not hosted Edge CPU/load measurements.

### Hosted and browser verification — actual observations

The configured frontend and server URLs point to the same hosted Supabase project. A read-only request using the existing service credential successfully retrieved its REST schema (HTTP 200). The hosted `chess_games` table has `ranked_round` but lacks `white_time_ms`, `black_time_ms` and `clock_started_at`. The queue lacks `session_id`; the schema exposes none of `ranked_queue_action`, `ranked_clock_snapshot` or `maintain_ranked_chess`. Existing ranked settlement/start functions are present. The deployed Edge Function rejects an unauthenticated request with HTTP 401 and the older message, `Sign in to play ranked chess.`

Thus the new lifecycle migration and current Edge behavior are **not deployed/verified on that target**. CLI project/migration listing attempts stalled without output, including retries; no migration history inspection or rollout succeeded. This is not a claim that credentials are entirely absent: the service credential works for REST, but successful management/database deployment access was not established. No hosted users, rooms, ratings or functions were changed. The coordinated migration + both Edge Function + frontend rollout in the earlier section remains outstanding.

Browser automation worked. The actual local Eat It menu and an eight-player City arena (one idle human plus seven bots) were inspected. The mouth dominates the character, eyes remain small, large scenery and differently sized props are visible, the HUD advances and bots grow over a minute of play; the browser reported no console errors during this check. Full eight-bot simulation was tested directly against the shared engine, not eight browser users. The Ranked page loads and shows its sign-in gate. There was no authenticated pair of browser clients, and the target lacks the migration, so queue-to-game handoff, hosted Realtime, clocks and casual validation were **not** verified live. Magnet, contact/orientation, oversize rejection, building consumption and size expiry have deterministic engine coverage, not a complete manual browser scenario matrix.

### Files changed in this continuation only

- `src/games/chess/multiplayer/position.ts`
- `src/games/chess/ranked/clock.ts`
- `src/pages/games/Chess/ChessMultiplayerGame.tsx`
- `supabase/functions/ranked-chess/index.ts`
- `supabase/migrations/20260929000000_ranked_lifecycle_clocks.sql`
- `src/games/eat-it/engine.ts`
- `tests/chess-ranked-client.test.mjs`
- `tests/chess-ranked-database.test.mjs`
- `tests/chess-ranked-endpoint.test.mjs`
- `tests/eat-it-mouth.test.mjs`
- `tests/eat-it-simulation.test.mjs` (new)
- `IMPLEMENTATION_REPORT.md`

All prior work remains uncommitted alongside these fixes. A clean Git index was not manufactured by discarding or committing the prior session's work.
