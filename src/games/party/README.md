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
- Full-screen React Three Fiber boards: Sunspill Islands has 96 spaces across six islands; Mountain has 92 spaces with climbing routes and intact avalanche choke points. Animated water, palm trees, a volcano, ruins, a pirate boat, village cabins, a mine, an ice lake and a summit decorate the maps. Reciprocal graph edges and existing board rules remain authoritative.
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

After every board round the server picks a main minigame from `minigames/` (`minigameRegistry`), runs it (intro → play → results), pays 10 / 5 / 3 / 0 coins and puts the winner first in the next round. The pool contains One Wrong Step, Pickup Shootout, Echo Wall, Triple Trail, Pluto Pulse, Circle Quickshot and Hell Knockout. Target Panic remains registered for legacy fixtures but is excluded from selection. Clients only send `MINIGAME_INPUT` intent; the server validates actions and computes rankings. See `ARCHITECTURE.md` section 32.

## Additional main minigames

**One Wrong Step** (`minigames/arrowMemory/`) randomly chooses an ice or hell 10×10 grid. Four private 5×5 quadrants receive different arrow sequences, with opponents' moves hidden until each hazard. There are exactly three survival rounds, with everyone returning between rounds. First, second and third earn 3 / 2 / 1 points each round; cumulative points determine the final ranking. Within each survival round, sequences grow from 3 arrows to 4 at levels 2–3, 5 at levels 4–6, 6 at levels 7–10 and one additional arrow at each later level. A round ends with one survivor or after two minutes; survival, correct steps and response time determine placements. Icicles shatter wrong ice tiles above water; wrong hell platforms fall into lava. Future paths and bot recollections never leave the server.

**Pickup Shootout** (`minigames/pickupArena/`) is a 120-second first-person free-for-all. The server randomly chooses Neon Play Arcade (three floors, four stairways, arcade machines and tables) or Pluto City Blocks (buildings, cars and crates). Everyone starts unarmed; available pickups provide a knife, pistol, shotgun, rifle or Desert Eagle (50 damage, seven-round magazine). Walk over a pickup while unarmed or out of ammo; E / Swap exchanges an equipped weapon. Pickups return after 10 seconds. Each kill awards exactly 1 point, with fewer deaths and server randomness breaking ties. Players respawn unarmed after 3 seconds with a 1.5-second shield that also delays firing. Movement, stairs, collisions, line of sight, ammo, fire cadence, damage and kills are all authoritative. Confirmed hits produce particles, a character reaction, a hit marker and floating actual damage numbers; misses and shields produce no damage feedback. A health box shows your HP, and visible opponents have health bars. Weapon pickups have rotating models and nearby labels; equipped weapons recoil or swing. Bots use validated inputs and navigate the same surfaces, with slower movement, reaction delays, imperfect aim and pauses between bursts at each difficulty. Desktop controls are WASD, mouse, click and E; touch controls include movement, drag-to-look, Fire and Swap.

**Street Cross** draws normalized movement with bounded prediction and smooths corrections between 100 ms server snapshots. Checkpoint hits and finishes snap immediately to the authoritative position. Spawn immunity uses a steady ring instead of flashing the character.

**Shooter updates:** Every seat can spawn on all three arcade floors. Health packs restore up to 40 HP and ammo boxes refill a magazine, with a three-magazine ceiling; both respawn after 12 seconds. Gun headshots deal double damage, so the Desert Eagle's 50-damage shot becomes a 100-damage headshot. An elimination overlay identifies the killer and counts down to respawn. Local movement prediction shares collision and stair physics with the authority, and city windows use instanced meshes to reduce rendering work.

**Echo Wall** (`minigames/patternWall/`) shows a shared sequence on a 3×3 wall, then accepts taps or keys 1–9 to repeat it. Lengths are 3 at level 1, 4 at levels 2–3, 5 at levels 4–7, then one more at every later level. Wrong or incomplete recall eliminates a player. Only the current light is broadcast; the answer and other players' taps remain private.

**Triple Trail** (`minigames/trailRun/`) runs three 45-second races across different ice, jungle and cloud courses. Four separate lanes, jumps, ice inertia, sky wind and checkpoints are server simulated. Each race awards 3 / 2 / 1 placement points; totals determine the final winner. Use A / D and Space or the on-screen run and jump buttons.

**Pluto Pulse** (`minigames/rhythm/`) gives everyone the same seeded six-lane W / A / S / D / Space / Shift chart. Tap a key or its screen button as a note reaches its target circle. Exact circle overlap is multiplied by its value: usually 1, occasionally 3 and rarely 5. Judgement and points are authoritative, and each note can score only once.

**Circle Quickshot** (`minigames/circleShot/`) is a 60-second timing shooter with all four players visible in a 2×2 display. Each player has a weapon, a target ring and exactly one falling circle at a time. Click, Space or Fire takes one shot at that circle. The exact intersection area divided by circle area is multiplied by its value (1, 3 or 5), without rounding the accumulated score: 80% × 3 earns 2.4. The shared chart, shot validation, expiration and scoring run on the server; only current circles appear in snapshots.

**Hell Knockout** (`minigames/lavaKnockback/`) places players on varied-size basalt islands and narrow paths over lava. Everyone starts with 200 HP. Fists deal 10 HP per hit, apply knockback and have a 450 ms cooldown. Lava contact or zero HP eliminates permanently. WASD/arrows move, the mouse aims, click/F punches and Space jumps; touch arrows aim and move, with Jump and Punch buttons. The last survivor wins; at 120 seconds, survivors rank by remaining HP then punches landed, and eliminated players rank by survival time. Bots use the same physics and inputs, travelling through the central island. Both new games use normal rewards and round ordering, and have buttons in the local minigame playground.

All boards and minigames fill the viewport. Player cards sit at the board edges; the turn dock provides Roll, Use item and See board. Both boards support drag, zoom, fit, find-pawn and an accessible space selector. The phone layout keeps action buttons visible and the platform-race camera follows the player's lane.

Both games join the existing main minigame pool and use the usual intro, results, coin rewards and next-round order. Their map choices are independent on every appearance. For direct local play against three bots, run the frontend and open `/tests/party-minigames-preview.html`. Rule, security, bot, staircase and flow checks live in `tests/party-new-minigames.test.mjs`.

The minigames use original React Three Fiber worlds and characters. Frostfall Lagoon has moving water, snow, crystals, falling icicles and shattering ice; the Ember Vault has flowing lava, fire, embers and tumbling basalt platforms. Memory players can switch between the full map and a closer view of their quadrant. The shooter arcade has animated cabinet screens, air hockey tables, neon trims and stair lighting; the city has shop fronts, windows, detailed cars, crosswalks, rooftop fans and moving flags. Avatar seats map to a fox, bunny, explorer and ghost with team scarves, blinking, idle breathing, walk cycles and ghost hovering. Frame animations follow the server clock for gameplay events. Ambient motion respects reduced-motion preferences. All models and textures are generated locally without external asset downloads. The playground also includes a character gallery, weapon practice and an arcade tour.

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
