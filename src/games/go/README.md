# Browser Go analysis

Go review, hints and the singleplayer opponent run in a Web Worker, like the
chess Stockfish integration. No analysis API, Render service, native KataGo
installation, Supabase function, migration, or cross-origin isolation is needed.
Deploy the normal frontend build.

The browser engine is the MIT-licensed Web KaTrain TypeScript/TensorFlow.js
implementation of KataGo model evaluation and MCTS, not the native KataGo binary.
It prefers WebGPU, falls back to WebAssembly, then JavaScript CPU. The UI stays
on the main thread. Search is capped at 64 visits and three seconds after model
initialization. First use downloads the bundled 10.6 MiB b10 model and worker.
The browser caches static assets normally; this is not a full offline PWA.

The b10 model is a compact older trained network, not a current full-strength
model. Review estimates and point-loss bands are coaching guidance, not ranks.
Search speed and achieved visits vary by device. Model loading has a two-minute
deadline; cancellation stops search, cached results are bounded, and an idle
worker is released after two minutes.

## Assets and build

- public/go-engine/katago-b10.bin.gz is committed with the site.
- predev/prebuild copy the installed TensorFlow WASM binaries into public/tfjs.
- All model/WASM requests stay on the website's origin.
- npm run build produces everything needed in dist.
- npm run preview serves the static build, without an analysis backend.

The adapter supplies full repetition history, previous boards, and recent moves.
The vendored Chinese rules entry is adapted to this app: positional superko,
area scoring, no suicide, no handicap bonus, 6.5 komi, and capture dead stones
before passing. Engine candidates and variations are checked against the app's
rules. Finished games after two passes use the exact local area score.

See src/vendor/browser-katago/README.md for source provenance and modifications.

## Ranked Go

Open `/games/go/ranked` or choose Go in the Chess ranked lobby. Ranked games use
9 × 9 Chinese area rules and 6.5 komi. Two independent queues/ratings offer
Blitz (30 seconds + 5 × 10-second byo-yomi periods) and Normal (5 minutes +
5 × 30-second periods), configured in `ranked/config.ts` and mirrored
by the contract-tested database clock configuration. A legal move resets the
current period after main time is exhausted; consumed periods stay consumed.
The server enforces overtime and timeout, including during disconnection.

Go uses Chess's Elo formula (1200 default; K=32 for the first 20 games, then 20;
100 floor), tier emblems, Top 10 medallion, lobby, table, and player/result cards.
Leaderboard and profile positions use rating DESC, rated games DESC, user ID ASC.
Only players with a completed rated game and a profile enter the leaderboard.
Profile ranks count predecessors in the same database ordering; pages retain
absolute positions. Top 10 means the actual positions #1 through #10.

Apply `supabase/migrations/20261020000000_go_ranked.sql` and deploy the
`ranked-go` Edge Function before using the ranked frontend. This extends the
hosted schema already used by Chess and casual Go; it does not replace either.
The migration registers a 10-second `pg_cron` maintenance job, like Chess.
Queue leases expire after 12 seconds; compatible rating range expands by 100
Elo per minute after an initial 250. Players have 30 seconds to connect before
an unrated abandonment. Both connections start the clocks. Once started,
disconnections do not pause clocks: the absent player loses on flag fall.
Resignation may occur on either turn. Ranked rematches return to matchmaking.

The Edge Function verifies auth, participant identity, integer coordinates,
legal moves, turn, and version. Database row locks serialize clock/move updates;
results, rating changes, and both `user_game_results` history entries commit in
one transaction. The unique game result key and ordered rating locks prevent
retry/double-settlement races. Clients cannot write ratings, games or results.

Rankings refresh after a result, on focus, and every 15 seconds. Ranked history
links directly to the persisted game and the existing Game Review. The review
component is unchanged; storage preserves external timeout/resignation results
when replaying the verified board history.

Validation: `npm run test:ranked`, `npm run test:go`, `npm test`, and `npm run build`.
`npm test` includes a small Node resolver for the project's existing Vite `@/`
TypeScript alias. Database tests apply the real Chess and Go migrations in
PGlite against the documented hosted base-schema contract; cron scheduling is
excluded because that PostgreSQL extension is unavailable in WASM.
