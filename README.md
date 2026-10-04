# Swag — browser games collection (with Pluto Party)

A React + Vite + TypeScript site with several browser games (chess variants, Watten, Schafkopf, Go/Shogi,
Atlas Arena, Eat It, …). Accounts, dashboards and some multiplayer modes use a hosted **Supabase**
(PostgreSQL) project.

**Pluto Party** (`/games/pluto-party`) is an original four-player online party board game: lobbies, bots,
two maps (Tropical Islands and Mountain), items, properties, Golden Plutos, duels, rare items, animals and
realtime minigames. It runs on its own small Node.js WebSocket authority and keeps live matches in memory; it
has **no database tables**..

- Game rules: [`GAME_SPEC.md`](GAME_SPEC.md)
- Architecture and development contracts: [`ARCHITECTURE.md`](ARCHITECTURE.md)
- Verified implementation status: [`PROGRESS.md`](PROGRESS.md)

## Technology

| Area               | Stack                                                                                                |
| ------------------ | ---------------------------------------------------------------------------------------------------- |
| Client             | React 19, Vite 8, TypeScript (strict for Pluto Party), Tailwind (site), PixiJS 8 (Pluto Party board) |
| Pluto Party server | Node.js ≥ 24 running TypeScript directly (type stripping), [`ws`](https://github.com/websockets/ws)  |
| Persistence (site) | Supabase (PostgreSQL 17) with SQL migrations in `supabase/migrations/`                               |
| Tests              | `node --test` (`tests/*.test.mjs`), PGlite for the database tests                                    |

## Prerequisites

- Node.js **24 or newer** (the Pluto Party server and tests import `.ts` files directly).
- npm (a `package-lock.json` is committed; a `pnpm-lock.yaml` also exists — use one tool consistently).
- For the Supabase-backed parts only: a Supabase project, and the [Supabase CLI](https://supabase.com/docs/guides/cli) for migrations.

## Install and configure

```bash
git clone <repository-url>
cd swag2
npm install
cp .env.example .env
```

Fill in `.env` (see [`.env.example`](.env.example) for every variable the code reads):

- `VITE_SUPABASE_URL`, `VITE_SUPABASE_PUBLISHABLE_KEY` — needed by the site's Supabase features. Pluto Party
  itself does not need them.
- `PARTY_*` / `VITE_PARTY_SERVER_URL` — optional Pluto Party server settings (defaults work locally).

Never commit `.env` or `.env.local` (both are git-ignored). The service-role key is a server-only secret for
Supabase Edge Functions; it must never be put in a `VITE_` variable.

## Development

Two terminals:

```bash
npm run party:server
```

```bash
npm run dev
```

Open <http://localhost:5173/games/pluto-party>. The Vite dev server proxies `/party-socket` to the authority
on `127.0.0.1:8787`. Separate browser tabs are separate players (the reconnect token is per tab), so you can
play against yourself; empty seats can be filled with bots.

Phone testing on your LAN: `npm run dev -- --host 0.0.0.0` and open your computer's LAN address on the
phone (the authority stays on loopback behind the proxy).

The authority does not hot-reload: restart `npm run party:server` after changing engine or server code.

## Scripts

| Command                                            | What it does                                                               |
| -------------------------------------------------- | -------------------------------------------------------------------------- |
| `npm run dev`                                      | Vite dev server (port 5173)                                                |
| `npm run party:server`                             | Pluto Party WebSocket authority (port 8787, `GET /health`)                 |
| `npm run build`                                    | `tsc -b`, strict Pluto Party typecheck, production Vite build into `dist/` |
| `npm run preview`                                  | Serve the production build locally                                         |
| `npm run test:party`                               | Pluto Party engine, server and integration tests                           |
| `npm run check:party`                              | Strict TypeScript check of Pluto Party (client, engine, server)            |
| `npm run lint`                                     | ESLint for the whole repository                                            |
| `npm run test:natura`                              | Every test file in `tests/` (all games)                                    |
| `npm run test:ranked`, `test:eat-it`, `test:atlas` | Per-game test subsets                                                      |

## Pluto Party in production

The client is static (`dist/`), but the game needs the long-running authority:

```bash
NODE_ENV=production PARTY_HOST=0.0.0.0 PARTY_PORT=8787 \
PARTY_ORIGINS=https://your-site.example PARTY_TRUST_PROXY=1 \
node server/party/index.ts
```

- Put a reverse proxy in front that terminates TLS and forwards WebSocket upgrades on `/party-socket`
  (same origin as the site), or host the authority elsewhere and build the client with
  `VITE_PARTY_SERVER_URL=wss://…/party-socket`.
- `PARTY_ORIGINS` restricts which browser origins may open the socket (the server logs a warning in
  production when it is unset). There are no cookies or credentials; the per-tab session token is sent in the
  first message.
- `GET /health` returns `{ "service", "status", "uptimeSeconds" }` (503 while shutting down).
- `SIGTERM`/`SIGINT` shut down gracefully: new connections are refused, players are told the server is
  restarting, sockets and timers close.
- **Active matches live in memory and do not survive a process restart.** Run a single authority instance
  (or sticky routing per lobby); there is no shared room store.
- Logs are one line per event (`server.start`, `lobby.created`, `match.start`, `match.end`,
  `player.disconnected`, `player.reconnected`, `seat.bot_takeover`, `match.error`, …). Session tokens are
  never logged. Level: `PARTY_LOG_LEVEL`.

Reconnects: a disconnected player keeps their seat for 60 s (`NETWORK_CONFIG.reconnectGraceMs`), then a bot
plays that same seat; the player can take it back within 30 minutes. Refreshing the page reconnects to the
same seat. Details: `ARCHITECTURE.md` section 36.

## Database (Supabase / PostgreSQL)

Pluto Party has no persistent schema. The rest of the site uses Supabase:

- Migrations (source of truth): `supabase/migrations/*.sql`, applied in timestamp order by the Supabase CLI.
- Configuration: `supabase/config.toml` (PostgreSQL 17).

Typical commands (Supabase CLI):

```bash
supabase login
supabase link --project-ref <your-project-ref>
supabase migration list        # migration status: local files vs. the linked database
supabase db push               # apply pending migrations to the linked project
```

Local development database (requires Docker):

```bash
supabase start                 # local Postgres + Supabase services
supabase db reset              # LOCAL ONLY: drops the local database and replays all migrations
```

> **Never run destructive reset commands against production.** `supabase db reset` without `--linked`
> only touches the local stack; do not add `--linked` for a production project.

**Known limitation — not rebuildable from empty:** the migration history starts at
`20260924150000_schafkopf.sql`, but some base tables it and later migrations depend on (for example
`profiles`, `chess_rooms`, `chess_games`) were created on the hosted project before migrations were tracked
and are not in this repository. `supabase db reset` on an empty database therefore fails until a baseline is
added. Fix (needs access to the hosted project): generate a baseline with `supabase db pull` (or
`supabase db dump --schema public`) into a migration timestamped **before** `20260924150000`, review it, and
commit it. The database tests work around this by creating the minimal base contract in PGlite.

## Tests

```bash
npm run test:party
npm run check:party
npm run build
```

Pluto Party tests cover lobbies, maps, turn order, dice, movement, intersections, economy, Golden Plutos,
HP/KO, inventory, items, properties, minigames, duels, rare items, radiation, animals, Mountain mechanics,
reconnects, seat takeover, validation, rate limits, and long seeded all-bot matches on both maps. There is no
browser end-to-end suite (no Playwright in the project); the critical flows are covered by WebSocket-level
integration tests against the real server.

## Project layout (Pluto Party)

```text
src/games/party/          shared engine, content, rules, network contract, Pixi renderer (no React)
  engine/ items/ properties/ minigames/ duels/ animals/ hazards/ status/ events/ content/ network/
  client/                 browser-only systems: audio, preferences
src/pages/games/Party/    React UI (home, lobby, board HUD, minigame screens, settings, results)
server/party/             WebSocket authority: sessions, rooms, ticks, logging, limits
tests/party-*.test.mjs    engine, server and integration tests
```

Assets are original: the board is drawn with vector graphics and all sounds are synthesized at runtime with
the Web Audio API (no audio files).
