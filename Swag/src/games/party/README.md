# Pluto Party — milestones 1–10

An isolated addition to the existing React/Vite app at `/games/pluto-party` (also linked from Games).

## Run

Use Node 24+ with native TypeScript support and install dependencies with `npm install`.

In separate terminals:

```sh
npm run party:server
npm run dev
```

Open `http://localhost:5173/games/pluto-party`. The Vite proxy forwards `/party-socket` to the authority on port 8787. Create a lobby, choose **Golden Plutos** or **Coins** as the victory condition, ready up and set sail. The default fills vacant seats with bots. Separate browser tabs have independent sessions and can join by code.

For phone testing on the same LAN, run Vite with `npm run dev -- --host 0.0.0.0` and open the computer’s LAN address on the phone. The backend remains bound to loopback behind the Vite proxy.

Production requires a long-running Node service and a reverse proxy with WebSocket upgrades at `/party-socket`; static hosting alone is insufficient. `PARTY_PORT` and `PARTY_HOST` configure the server. Set `PARTY_ORIGINS` to a comma-separated list of allowed frontend origins for a public deployment. If hosting the service separately, set `VITE_PARTY_SERVER_URL` to its `wss://…/party-socket` URL at build time. Matches are in memory and are lost on restart. Do not run multiple independent authorities behind a load balancer without sticky routing and shared room discovery.

## Implemented

- Public/private rooms, exact-code private discovery, name/code search, four slots, host migration, bot add/remove/difficulty, kicking, ready checks and settings.
- Server-generated session secrets, authoritative snapshots, reconnect after reload, a 60-second disconnect grace period followed by bot takeover. A returning player can reclaim their seat for 30 minutes. Empty or abandoned rooms expire; matches pause when no connected humans remain.
- Cryptographic server randomness, message validation, payload/rate bounds, no client-submitted outcomes.
- Original PixiJS tropical board: exactly 60 spaces, six islands, reciprocal graph edges, connected loops, bridges and intersections. Map definition is registered independently from rules and rendering.
- Animated pawns and dice, pan by scrolling/dragging the zoomed map, zoom/fit/find-pawn controls, large accessible HTML route choices, HUD, tile inspection and action feed.
- Starting rolls with group-preserving tie rerolls; 0–10 dice; server-paced movement; no immediate backtracking; zero skips tile resolution; bots select legal routes; four turns advance the round.
- Initial fields: coins, deposits, jackpot, heal, hazard/KO, ferry, and a simple island-breeze event.
- Two server-randomized Golden Pluto overlays. Exact landing resolves the base tile first, then pauses for Buy / Leave. Each costs 20 coins (removed from the economy, not deposited in the bank). Passing through or rolling zero never opens an offer. Insufficient funds disable Buy but still allow Leave.
- Purchases immediately respawn only the bought Pluto at a different eligible location, with a global announcement and a short camera visit before returning to the active pawn. Start, rare item, jackpot, active Pluto, irradiated, and map-excluded special nodes cannot receive a spawn. Ferry and boost spaces are excluded on this map.
- Bots plan legal exact landings and buy affordable Plutos when pursuing Pluto victory; coin-victory bots save their coins. Both conditions end immediately when reached, with results ordered by the chosen goal, then secondary currency, then turn order. Simultaneous coin awards check the active player first, then the current round order.

## Milestone 4: HP, inventory and items

`engine/combat.ts` owns damage, healing, KO and respawn. `items/` holds the item registry (Mega Medkit, Turbo Boots, Comet Melon) and inventory helpers (three slots, replace/discard when full). Items are used only in the item phase before rolling, validated by the server. Temporary turn data lives in `match.turn`; notifications in `match.events`. See `PROGRESS.md` and `ARCHITECTURE.md` section 30.

## Milestone 5: properties

Outposts (Mountain Camps on the Mountain map) can be claimed, upgraded to Level 4 and charge tolls; see `properties/` and `PROGRESS.md`.

## Milestone 6: minigames

After every board round the server picks a main minigame from `minigames/` (`minigameRegistry`), runs it (intro → play → results), pays 10 / 5 / 3 / 0 coins and puts the winner first in the next round. The first minigame is Target Panic (`minigames/targetPanic/`). Clients only send `MINIGAME_INPUT` intent; the server validates every hit and computes rankings. See `ARCHITECTURE.md` section 32.

## Milestone 7: weapons and duels

Scatterblaster (graph-distance bands, spread aim) and Lucky Six (global precision shot) start a short server-seeded aiming challenge (`items/aim.ts`, phase `ITEM_AIM`); clients send only a bounded reticle position and release time, the server scores it and applies damage through `engine/combat.ts`. Duel Saber (`duels/`) challenges any opponent for 5/10/20/custom coins or 1 Golden Pluto and runs a random duel minigame from `minigameRegistry.pool("duel")` — Paddle Panic (`minigames/paddlePanic/`) or Street Cross (`minigames/streetCross/`) — inside the challenger's turn (`DUEL_INTRO → DUEL_MINIGAME → DUEL_RESULTS → ITEM_PHASE`). The winner takes the escrowed pot or the loser's Pluto; nothing is created. See `ARCHITECTURE.md` section 33.

## Milestone 8: rare items, radiation and animals

The Rare Item field awards a weighted random rare item (`RARE_ITEM_WEIGHTS`): **Pocket Duel** (a wager-free duel through the Milestone 7 duel flow; the winner gets one brand-new Golden Pluto), **Fallout Core** (KOs everyone else on a space and its directly connected spaces, irradiates them and leaves a radiation zone for the rest of the round plus 3 full rounds; `hazards/radiation.ts`) and **Wild Totem** (summons a Cheetah or Crocodile; `animals/`). Radiation is a generic status effect (`status/effects.ts`): −10 HP at each of the next 3 turn starts and no items. After the last board turn of each round the Animal Phase moves every summoned animal toward the nearest opponent along the shortest legal path (`engine/graph.ts` `findShortestPath`) and resolves bites before the minigame starts. See `ARCHITECTURE.md` section 34.

## Milestone 9: Mountain map

Hosts choose **Tropical Islands** (`sunspill`, 2 Golden Plutos) or **Mountain** (`mountain`, 1 Golden Pluto) in the lobby; the server stores the choice as `match.mapId` and every rule reads the map from the match (`mapOf`). Mountain is a second `BoardMap` in the same registry (`content/mountain.ts`): 60 spaces, eight regions, two rope-bridge chokepoints, Mountain Camps instead of Outposts and map-specific mechanics that are data on the map: a Cable Car and a Mine Cart (`transports`), two Frozen Slides (`slides`), tunnel warps (`warps`) and Avalanche-eligible connections (`blockableEdges`). Random Event fields now go through an event registry (`events/`, per-map `allowedMaps`): Avalanche, Mine Collapse and Cable Car Breakdown are Mountain-only. Temporarily closed routes are match state (`match.blockedConnections`, `engine/routes.ts`) fed into the shared graph helpers. `content/validate.ts` validates every registered map. See `ARCHITECTURE.md` section 35.

## Deliberately deferred

Other events (Snowstorm, Mountain Goats, Frozen Winds, Ice Melt), the `duel` board tile, and audio (10). Their spaces are explicitly labeled as upcoming and have no hidden effects.

## Architecture

- `types.ts`, `config.ts`: shared strict typed contracts and tuning.
- `content/`: generic registry, map graph and presentation metadata. Add maps through `mapRegistry.register`.
- `engine/`: pure state transitions with injected randomness; independent of React, Pixi and networking. Server calls `advance`; clients can only request validated actions.
- `board/`: Pixi rendering of received state; no rules or random outcomes.
- `network/`: runtime input validation and reconnecting React connection adapter.
- `src/pages/games/Party/`: responsive React home/lobby/HUD and board host.
- `server/party/`: rooms/session lifecycle and WebSocket adapter. `PartyRooms` can be tested without a socket and is the future persistence boundary.

Future content should use registries of typed rule handlers rather than embedding rules in components. The engine currently exposes small explicit transitions; add item, event, animal and minigame handlers at the phase boundaries as each milestone is implemented. Minigame clients must submit inputs, never authoritative rankings.

## Checks

```sh
npm run test:party
npm run check:party
npx eslint src/games/party src/pages/games/Party server/party
npm run build
```

`tsconfig.party.json` enforces strict mode for this feature and server without changing the existing application's TypeScript policy. Tests cover graph topology/distribution, resources, dice/ties, movement/phase security, fields, KO, round progression, victory, bot simulations, protocol validation, host controls, private discovery, reconnection and a real WebSocket roundtrip. Economy tests additionally cover spawn restrictions, atomic purchases, rejection/decline, landing versus passing, offer reconnection, two-client socket synchronization, victory, and complete seeded bot matches. Milestone 4 tests live in `tests/party-items.test.mjs`. Property tests live in `tests/party-properties.test.mjs`, minigame tests in `tests/party-minigame.test.mjs`, and Milestone 7 tests in `tests/party-weapons.test.mjs`, `tests/party-duel.test.mjs` and `tests/party-duel-minigames.test.mjs`, and Milestone 8 tests in `tests/party-rare-items.test.mjs` and `tests/party-animals.test.mjs`, and Milestone 9 tests in `tests/party-mountain.test.mjs`.

## Milestone 10: hardening, reconnects, mobile polish

Sessions are per browser tab; refreshing reconnects to the same seat, the newest connection replaces an older one, and a disconnected seat is held for 60 s (`NETWORK_CONFIG`) before a bot plays it (the player can take it back). The server isolates errors per room, falls back to a safe bot action instead of stalling, validates names/codes/tokens, rate-limits lobby creation and code lookups, exposes `GET /health`, logs one line per event and shuts down gracefully. The client adds a connection overlay, loading and error states, an error boundary, a settings sheet (volumes, mute, motion, hints, fullscreen), synthesized audio, a mobile turn dock, safe-area support, final results with Return to lobby. See `PROGRESS.md` (Milestone 10) and `ARCHITECTURE.md` section 36.
