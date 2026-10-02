# Architecture

## 1. Purpose

This document contains the technical architecture and development contracts for the multiplayer party-game project.

It exists so development can safely continue across:

- different AI coding tools
- different chat sessions
- different developers
- different milestones

No AI agent should rely on previous chat history.

The repository is the source of truth.

---

# 2. Required Reading Before Changes

Before making changes, every development agent must read:

1. `GAME_SPEC.md`
2. `ARCHITECTURE.md`
3. `PROGRESS.md`
4. `README.md`
5. relevant existing source files

The agent must inspect the existing implementation before introducing new architecture.

Do not assume a feature does not exist without searching the repository.

---

# 3. Technology Direction

Frontend:

- React
- Vite
- TypeScript

Recommended realtime rendering:

- Phaser 3 or PixiJS

React should primarily handle:

- menus
- lobby screens
- HUD
- inventory
- dialogs
- settings
- results
- navigation

Realtime rendering systems may handle:

- board animation
- player pawns
- attacks
- particles
- realtime minigames

Backend:

- Node.js
- TypeScript
- WebSockets
- Socket.IO or Colyseus unless the repository already uses another suitable solution

Persistent database:

- PostgreSQL

Database tooling:

- preferably Drizzle ORM
- if another ORM has already been established, preserve it unless there is a strong documented reason to migrate

---

# 4. Separation of Responsibilities

Keep these concerns separate:

```text
React UI
↓
Client game presentation
↓
Network actions
↓
Authoritative server
↓
Game engine
↓
Match state
```

Persistent storage is separate from the realtime match engine.

Do not place core gameplay logic inside React components.

---

# 5. Suggested Project Structure

Adapt to the existing repository rather than blindly replacing it.

Conceptually:

```text
/
├── GAME_SPEC.md
├── ARCHITECTURE.md
├── PROGRESS.md
├── README.md
├── package.json
│
├── src/
│   ├── app/
│   ├── components/
│   ├── screens/
│   ├── game/
│   │   ├── engine/
│   │   ├── board/
│   │   ├── items/
│   │   ├── events/
│   │   ├── properties/
│   │   ├── combat/
│   │   ├── animals/
│   │   ├── statusEffects/
│   │   ├── economy/
│   │   ├── minigames/
│   │   ├── bots/
│   │   └── types/
│   └── maps/
│       ├── tropical/
│       └── mountain/
│
├── server/
│   ├── rooms/
│   ├── game/
│   ├── networking/
│   └── persistence/
│
└── db/
    ├── schema/
    └── migrations/
```

Do not restructure working code solely to match this example.

---

# 6. Server Authority

The server is authoritative for gameplay.

Clients submit requests.

Examples:

```ts
{
  type: "ROLL_DICE";
}
```

or:

```ts
{
  type: "USE_ITEM",
  itemInstanceId: "...",
  targetNodeId: "..."
}
```

The server determines:

- whether the action is allowed
- random outcomes
- state changes
- damage
- movement
- economy effects

Never trust client-provided values such as:

```text
damage = 999
coins = 999
diceResult = 10
```

---

# 7. Game Engine

The game engine should be testable independently of React.

Use reusable rules/functions for:

- turns
- dice
- movement
- path selection
- economy
- HP
- damage
- KO
- items
- properties
- Golden Plutos
- events
- animals
- win conditions

Prefer deterministic pure functions where practical.

Randomness should be injectable/testable where possible.

---

# 8. Game Actions

Prefer action-based state transitions.

Conceptual examples:

```ts
type GameAction =
  | { type: "USE_ITEM"; itemInstanceId: string; target?: unknown }
  | { type: "ROLL_DICE" }
  | { type: "SELECT_PATH"; nodeId: string }
  | { type: "BUY_PLUTO" }
  | { type: "BUY_PROPERTY" }
  | { type: "UPGRADE_PROPERTY" }
  | { type: "RESOLVE_TILE" }
  | { type: "START_MINIGAME"; minigameId: string }
  | { type: "FINISH_MINIGAME"; results: MinigameResult[] };
```

All actions must be validated against:

- current phase
- current player
- current state
- action-specific rules

---

# 9. Match State

The live match should have one authoritative state representation.

Conceptual shape:

```ts
interface MatchState {
  id: string;

  phase: GamePhase;
  round: number;

  mapId: string;

  players: PlayerState[];

  turnOrder: string[];
  activePlayerId: string;

  board: BoardNode[];

  centralBank: number;

  activePlutos: PlutoSpawn[];

  animals: AnimalInstance[];

  currentMinigameId?: string;

  settings: MatchSettings;
}
```

Adapt this to existing code.

Do not introduce duplicate competing match-state models.

---

# 10. Temporary Turn State

Temporary turn effects must not be stored as permanent player data.

Example:

```ts
interface TurnState {
  hasRolled: boolean;
  bonusMovement: number;
  usedItemThisTurn?: boolean;
}
```

Use temporary turn state for:

- Turbo Boots
- movement modifiers
- path progress
- dice state
- temporary actions

Reset it correctly between turns.

---

# 11. Content Registries

Content should be data-driven.

## Items

Adding an item should primarily require registering a definition.

## Events

Adding an event should not require rewriting the event engine.

## Minigames

Adding a minigame should not require modifying board logic.

## Maps

Adding a map should use a common map structure.

## Animals

Adding an animal should use common movement/lifetime/combat interfaces.

Avoid hardcoding long `if/else` chains throughout unrelated systems.

---

# 12. Maps as Graphs

Maps must use graph nodes.

Do not use one linear numeric position as the primary map model.

Example:

```ts
interface BoardNode {
  id: string;
  x: number;
  y: number;
  type: TileType;
  connections: string[];
}
```

Use shortest graph distance for board-range mechanics where specified.

---

# 13. Minigame Isolation

Each minigame should exist as an isolated module.

The main match engine should care only about:

- minigame ID
- participants
- completion
- rankings

Standard result:

```ts
interface MinigameResult {
  playerId: string;
  position: 1 | 2 | 3 | 4;
  score?: number;
}
```

Each minigame may implement its own bot controller.

---

# 14. Mobile-First Requirement

New UI must support touch.

Do not require:

- hover
- right click
- complex keyboard combinations

Critical actions require large touch targets.

Minigames should use simple input patterns where practical.

---

# 15. AI Development Handoff Contract

This repository may be modified by different AI coding systems.

No agent may assume it has access to previous conversations.

The repository itself is the continuity mechanism.

Before changing architecture:

- inspect existing implementation
- search for similar systems
- reuse shared models
- avoid creating duplicates

When architectural decisions change:

```text
update ARCHITECTURE.md
```

When milestone implementation changes:

```text
update PROGRESS.md
```

Important decisions must not exist only in chat messages.

---

# 16. Cross-Agent Compatibility

Before introducing a new:

- player model
- match model
- lobby model
- database table
- API endpoint
- WebSocket event
- game action
- item registry
- event registry
- minigame registry

search the repository for an existing implementation.

If one exists, extend it instead of creating a competing system.

Do not casually rename shared types or network messages that other systems already depend upon.

When breaking changes are unavoidable:

- update all consumers
- document the decision
- update tests
- update `ARCHITECTURE.md`

---

# 17. Database Contract

Use PostgreSQL for persistent storage.

Use the database tool/ORM already established in the repository.

If no database layer exists yet, prefer:

```text
PostgreSQL + Drizzle ORM
```

Once chosen, do not replace the ORM without a strong documented reason.

---

# 18. Database Migrations

All persistent schema changes require version-controlled migrations.

Never rely on manual database modifications.

Migration files belong in the repository.

Example:

```text
db/
├── schema/
└── migrations/
    ├── 0001_initial.sql
    ├── 0002_users.sql
    ├── 0003_matches.sql
    └── ...
```

Actual naming may follow the selected database tool.

The complete migration history must be capable of creating the current schema from an empty PostgreSQL database.

---

# 19. Migration Rules

For every milestone that changes persistent data:

1. update the schema definition
2. create/generate a migration
3. inspect the generated SQL
4. test the migration where practical
5. commit the migration
6. update relevant tests
7. update `PROGRESS.md`

Do not modify previously deployed migrations to rewrite history.

Create a new migration instead.

---

# 20. Live Match State vs Persistent Data

Do not persist every realtime match update to SQL by default.

Examples of primarily live server state:

- current board node
- current HP
- current dice result
- active turn
- movement remaining
- inventory during a live game
- temporary effects
- active radiation
- current animal positions
- active Golden Pluto locations
- current minigame score

These belong primarily in the authoritative match server.

---

# 21. Persistent Data

Persistent PostgreSQL data should focus on information that should survive a server restart.

Potential entities:

- users
- authentication records
- player profiles
- match records
- match participants
- match results
- persistent player statistics
- achievements
- cosmetics
- progression

Lobby persistence should only be added if useful.

Persistent live-match snapshots may be added later if crash recovery requires them.

---

# 22. Database Reproducibility

At the end of development, it must be possible to start with an empty PostgreSQL database and run repository migrations to produce the complete required schema.

Provide scripts similar to:

```bash
npm run db:migrate
npm run db:status
```

Optionally:

```bash
npm run db:reset
```

A reset script must never automatically run against production.

---

# 23. Reconnect Architecture

Multiplayer networking should support reconnects.

A disconnected human should retain a temporary reserved slot.

Use stable session/player identification so the client can reconnect and receive the authoritative state.

If a timeout occurs, replacing the player with a bot may be supported.

---

# 24. Testing Requirements

Important game-engine rules must have automated tests.

Relevant categories include:

- dice bounds
- turn ordering
- tied starting rolls
- movement
- path choices
- economy
- bank
- Golden Pluto spawning
- Golden Pluto purchases
- HP
- KO
- inventory
- item timing
- properties
- status effects
- animal duration
- minigame rewards
- victory detection

Core rules should be testable without rendering React.

---

# 25. Build Quality

Before completing a milestone, the implementing agent should run where configured:

- tests
- TypeScript checking
- linting
- production build

Errors introduced by the milestone should be fixed before completion.

---

# 26. Scope Discipline

Each milestone agent must implement only:

- the requested milestone
- necessary compatibility/refactoring work

Do not begin later milestone content without explicit instruction.

Small future-facing interfaces are acceptable if required to avoid poor architecture, but large future systems should not be implemented early.

---

# 27. End-of-Milestone Requirements

At the end of every milestone, update `PROGRESS.md`.

Record:

- milestone completed
- functionality implemented
- important files changed
- architecture decisions
- database changes
- migrations created
- tests added/updated
- known limitations
- next milestone
- test status
- TypeScript status
- build status

If no persistent schema was changed, write:

```text
Database changes: none
```

Do not automatically begin the next milestone.

---

# 28. Git Workflow Recommendation

After each stable milestone, create a Git commit.

Example:

```bash
git add .
git commit -m "Complete milestone 4: HP inventory and items"
```

This creates safe recovery points between AI coding sessions.

---

# 29. Rule for Future AI Milestone Prompts

Every milestone prompt should include:

```text
Follow the AI Handoff and Database Contract in ARCHITECTURE.md.

If this milestone changes persistent data, create the appropriate version-controlled database migration.

If it does not, do not invent unnecessary database tables.
```


---

# 30. Implemented Notes: Pluto Party HP, Items and Turn State (Milestone 4)

These record how the contracts above were realised in the repository.

- **Location:** `src/games/party/` (engine, items, content, network types), `server/party/` (authority), `src/pages/games/Party/` (UI).
- **Damage and KO:** every source of HP change must call `engine/combat.ts` (`damagePlayer`, `healPlayer`). KO (HP <= 0) moves up to 5 coins to `match.bank`, respawns at the map start with 20 HP, and never skips a turn.
- **Items:** `items/registry.ts` holds `ItemDefinition`s (`canUse`, `execute`, optional `targeting: "node"`). Adding an item means registering a definition; the engine's `USE_ITEM` handler validates turn, phase, `turn.hasRolled`, ownership, `canUse` and target before mutating.
- **Instances:** inventory holds `ItemInstance { instanceId, itemId }` (`item-N`, from `match.nextItemNumber`). Full inventories park the new item in `match.pendingItem` and use phase `ITEM_REPLACE`.
- **Turn state:** `match.turn` (`TurnState`) holds temporary per-turn data and is rebuilt at each turn start. Do not add temporary modifiers to `Player`.
- **Feedback:** structured notifications are `match.events` (bounded, with `eventSeq`) inside the normal state snapshot, emitted through `engine/events.ts`. No separate notification channel exists.
- **Board range:** use `engine/graph.ts` `graphDistances` (BFS over `connections`), never pixel distance.
- **Protocol:** `parseMessage` whitelists action fields; clients send intent (`USE_ITEM`, `REPLACE_ITEM`, `DISCARD_NEW_ITEM`) and never outcomes.
- **Persistence:** none; live match state stays in the authority's memory.

# 31. Implemented Notes: Properties (Milestone 5)

- `Match.properties` (`PropertyState[]`) is the only ownership record; there is no per-player property list. Values come from `PROPERTY_CONFIG`.
- New phase `PROPERTY_OFFER` (after `RESOLVE_TILE`, before `TURN_END`) and actions `BUY_PROPERTY {nodeId}`, `UPGRADE_PROPERTY {nodeId}`, `LEAVE_PROPERTY`; the client-side names in section 12 that omitted `nodeId` are superseded.
- Tolls resolve automatically during landing; the standard win check runs afterward.
- Golden Plutos never spawn on property nodes.
- Live property state is not persisted. Database changes: none.

# 32. Implemented Notes: Minigames (Milestone 6)

- **Isolation:** each minigame is a `MinigameDefinition` (`src/games/party/minigames/types.ts`) registered in `minigameRegistry` (`minigames/index.ts`). The board engine never imports a minigame module; it calls `minigames/flow.ts`, which works only with ids, participants, timing, completion and `MinigameResult[]`.
- **Hooks instead of a React component:** the definition sketched in `GAME_SPEC.md` section 30 has a `component` field. Here the shared definition stays React-free because the server imports it; a separate client registry (`src/pages/games/Party/minigames/views.ts`) maps minigame id → component. A future Pixi/Phaser minigame registers its own component there.
- **Phases:** `TURN_END` (last player) → `ANIMAL_PHASE` → `MINIGAME_INTRO` → `MINIGAME` → `MINIGAME_RESULTS` → `ROUND_END` → `ITEM_PHASE` (or `GAME_OVER`). The round counter increments at `ROUND_END`. Board actions are rejected in all of these phases. The `ANIMAL_PHASE` case now runs the animals (see section 34).
- **Time:** `advance(state, settings, random, now)` and `applyAction(..., now)` take an injected clock, like randomness. Timed phases return the unchanged state object until their deadline; pacing lives in `MINIGAME_FLOW`, and per-game tuning lives in each game's config (e.g. `TARGET_PANIC_CONFIG`).
- **Actions:** there is one generic action, `MINIGAME_INPUT { input }`, where `input` is a bounded record of primitives (`network/protocol.ts`); the active minigame's `parseInput` does the strict parsing. The `START_MINIGAME`/`FINISH_MINIGAME` actions sketched in section 8 are intentionally **not** client actions: the server selects, starts, ranks and rewards.
- **Network view:** snapshots pass through `publicLobby` (`server/party/rooms.ts`), which replaces the minigame state with `definition.publicView(state, now)` and adds `serverNow` for client clock sync. Hidden data (future schedule, bot plans) must stay out of `publicView`.
- **Bots:** each minigame provides `botInputs`; its inputs go through the same `applyInput` validation as human input. The server runs them in a 100 ms `fastTick` that only touches rooms in `MINIGAME_INTRO`/`MINIGAME` and throttles broadcasts (≥200 ms apart when changed, at least every 1 s).
- **Rewards and order:** `MAIN_MINIGAME_REWARDS` (config) is applied exactly once by the server; `detectWinner` then runs with the placement order as its priority. `nextRoundOrder` moves the winner to the front and keeps everyone else's relative order.
- **Persistence:** none. Minigame runtime is live match memory and is cleared at `ROUND_END`. Database changes: none.

# 33. Implemented Notes: Weapons and Duels (Milestone 7)

- **Player-targeted items:** `ItemDefinition.targeting` is `"node" | "player"`. `USE_ITEM` carries `targetPlayerId` (and `wager` for Duel Saber). An optional `validate(state, context)` hook runs after the generic checks and before anything is consumed or mutated; it throws to reject. `canUse` now receives the map (`canUse(state, playerId, map)`) so range-dependent items can decide availability.
- **Aimed items (`aim` spec):** `USE_ITEM` for an item with `aim` does not consume it; it stores a server-seeded `AimChallenge` in `match.turn.aim` and switches to phase `ITEM_AIM`. Only `FIRE_ITEM { aimX, aimY, elapsedMs? }` or `CANCEL_AIM` from the active player are accepted there. `items/aim.ts` scores the release (bounded coordinates, release time accepted only inside a 300 ms latency window) and the item's `execute` receives the resulting `AimResult`. `advance` resolves an unreleased shot as a miss after the window plus grace. Future aimed items should reuse this path, not add their own.
- **Board distance for weapons:** always `engine/graph.ts` shortest graph distance between `currentNodeId`s; band tables live in config (`SCATTERBLASTER_CONFIG`).
- **Duels:** a Duel Saber duel is an interruption inside the active player's turn: `ITEM_PHASE → DUEL_INTRO → DUEL_MINIGAME → DUEL_RESULTS → ITEM_PHASE` (or `GAME_OVER`). Duel-only data is `match.duel: DuelState | null` (challenger, defender, wager, escrowed pot, minigame id, winner, payout), cleared at the end. `match.turn`, `order`, `round`, `lastMinigameId` are never touched by a duel. Coin stakes are escrowed at start; Pluto stakes are transferred at settlement (board actions are locked meanwhile). Settlement (`duels/duel.ts`) is a transfer only and runs once; `detectWinner` follows with the duel winner first.
- **One minigame system for both kinds:** duels use the same `MinigameDefinition`, registry and `match.minigame` runtime with `gameType: "duel"`; `selectDuelMinigame` picks only from `pool("duel")`, round-end selection only from `pool("main")`. `finishMinigame` (placement rewards) refuses non-main games; duels use `concludeMinigame` + wager settlement.
- **Realtime minigame hooks:** optional `tick(state, now)` (fixed-step simulation to the authority clock), `isFinished(state)` (early completion) and `snapshotIntervalMs`. The flow simulates up to an input's timestamp before applying it and rejects input once the game is decided. Hidden simulation data (pre-drawn serves, bot plans) must stay out of `publicView`. Clients extrapolate from the snapshot and draw with a single rAF loop.
- **Network:** no duel-specific messages; duel play uses `MINIGAME_INPUT`. New actions: `FIRE_ITEM`, `CANCEL_AIM`. `publicLobby` adds `serverNow` to an aim challenge. `fastTick` also covers `DUEL_INTRO`/`DUEL_MINIGAME`.
- **Persistence:** none. Database changes: none.

# 34. Implemented Notes: Rare Items, Radiation and Animals (Milestone 8)

- **Rare items are ordinary items.** `rarity: "rare"` in the one `itemRegistry` (`items/rare.ts`); same instances, inventory, `USE_ITEM` validation, consumption, replace/discard and UI. The Rare Item field draws from `RARE_ITEM_WEIGHTS` via `randomRareItemId` (server roll; weights for non-rare ids are ignored). Weighted content picks use `engine/random.ts` `pickWeighted`. `ItemDefinition.blockedReason` (optional) gives the player-facing reason when `canUse` is false; the engine uses it as the rejection message.
- **Status effects** live in `Player.statusEffects` (`{ id, remainingTurns }`, one per id) and are defined in `status/effects.ts` (`statusRegistry`: `summary`, optional `itemLock`, optional `onTurnStart`). Apply with `applyStatus` (refreshes, never stacks). Future effects (poison, shield, slow…) register here; do not add per-effect fields to `Player`. `itemLockReason(player)` is checked by `applyItemUse` before any other item rule.
- **Turn start.** Every new board turn goes through `beginTurn` in `engine.ts` (new `TurnState`, then `runTurnStartEffects`); turn end calls `expireTurnEndEffects`. Duel returns to `ITEM_PHASE` do not re-enter `beginTurn`. Put future turn-start mechanics there.
- **Radiation zones** are match state (`Match.radiationZones`, `hazards/radiation.ts`), never map content (`BoardNode.radiationRounds` was removed). A zone created in round R expires at `ROUND_END` of R+3. Landing (`RESOLVE_TILE`) applies Radiation before the field. Pluto respawns pass `irradiatedNodeIds` as exclusions to `spawnPlutos`; existing Plutos are never moved by radiation.
- **Animals** are board entities, not players: `Match.animals: AnimalInstance[]` (+ `nextAnimalNumber`). Species are data (`animals/registry.ts`, `AnimalDefinition`); behaviour is shared (`animals/runtime.ts`: nearest-target choice with seat-order ties, contact damage via `damagePlayer`, once per player per phase, lifetime, despawn). A new animal should normally be only a registry entry; genuinely different behaviour should become an optional hook on `AnimalDefinition`, not a branch in the runtime. Animals never resolve tiles.
- **Animal Phase.** `ANIMAL_PHASE` with animals: the first tick calls `runAnimalPhase` (creation order, authoritative, records `Match.animalPhase { sequence, endsAt, steps }` for the client animation), later ticks wait for `endsAt`, then the victory check and `beginMinigamePhase`. With no animals it passes straight through as before. Pacing: `ANIMAL_PHASE_FLOW`; driven by the existing 700 ms board tick.
- **Pathfinding.** `engine/graph.ts` is the only graph toolkit: `graphDistances` and `findShortestPath` (unweighted BFS, deterministic ties by connection order) both take `RouteRestrictions` (undirected `edgeKey` set). A future route-closing event must supply its active set to these helpers rather than build a separate graph. Nothing closes routes yet, so callers pass `NO_RESTRICTIONS`.
- **Pocket Duel** reuses the duel flow with `DuelState.kind = "pocket-duel"` and `wager: null`; `settleDuel` branches on `kind` (Pocket Duel creates one Pluto for the winner; Duel Saber only transfers).
- **Bots:** rare-item and hazard heuristics are in `engine/rareBots.ts` (weights in `BOT_HAZARD_WEIGHTS`); they read only public state and go through normal validation.
- **Network:** no new messages; the parser still strips unknown `USE_ITEM` fields, so clients cannot submit blast areas, animals or outcomes.
- **Persistence:** none. Database changes: none.

# 35. Implemented Notes: Mountain Map and Map-Specific Mechanics (Milestone 9)

- **Maps are data.** `BoardMap` (`types.ts`) carries everything a map needs: nodes, `regions` (formerly `islands`), `theme`, `size`, `goldenPlutoCount`, `propertyName`, `flavor` (engine log wording), `tiles` (presentation overrides), `eventPoolIds`, and optional mechanics: `warps`, `transports`, `slides`, `blockableEdges`. Maps register in `mapRegistry` (`content/maps.ts`). The Tropical map keeps its M2 id `sunspill`; Mountain is `mountain`. `content/validate.ts` (`validateMap`) is the shared structural check (60 nodes, unique ids, reciprocal links, reachability, exact field distribution, slide/transport/warp/blockable-edge sanity) and is asserted for every registered map in tests.
- **The match owns its map.** `Match.mapId` is set by `createMatch` from the lobby settings; the engine and server resolve the map with `mapOf(match)`, never from mutable settings. Lobby settings lock when the match starts, `validSettings` accepts only registered ids, and clients cannot send a map inside an action.
- **Event registry.** No event registry existed before (Random Event was a hard-coded +2 coins). `events/` now holds `EventDefinition` (`weight`, optional `allowedMaps`, `canRun`, `execute`), `eventRegistry`, `eligibleEvents` (pool ∩ `allowedMaps` ∩ `canRun`) and `runRandomEvent`. A one-event pool draws no random number, so Tropical behaves exactly as before. Adding an event is one definition plus a pool entry.
- **Temporarily closed routes.** `Match.blockedConnections` (`BlockedConnection`) is the only record; the map graph is never mutated. `engine/routes.ts` provides `activeRestrictions(state)` (an undirected edge-key set), `safeBlockableEdges` (closures that keep the whole board connected, evaluated on top of active closures), `blockConnection`, `expireBlockedConnections`. Every routing consumer passes the set into the shared helpers in `engine/graph.ts` (`openConnections`, `graphDistances`, `findShortestPath`, `isMapConnected`): `legalPaths`, `reachableLandings`, `distanceToPluto`, bot scoring, animal pathfinding (`runAnimalPhase`) and hazard scoring. Weapon and Fallout Core range deliberately stay on static graph distance. Expiry: created in round R for D rounds ⇒ `expiresAfterRound = R + D − 1`, removed at that round's `ROUND_END` (Avalanche, D = 2: rounds R and R+1 blocked, open in R+2). Transport outages (`Match.transportOutages`) use the same convention.
- **Forced movement (`engine/transport.ts`).** Resolution rules: dice movement resolves the final space; a **transport ride** (`RIDE_TRANSPORT`/`DECLINE_TRANSPORT`, new phase `TRANSPORT_OFFER` after the landing field/property/Pluto steps) moves to the paired station and does not resolve the destination (no field, offers or Radiation); a **Frozen Slide** resolves its origin normally, then moves the pawn along `slide.path` with no input and resolves only the final space, once (`Match.forcedMove.pending` stops that landing from chaining another slide, warp or offer). `validateMap` enforces that slide paths follow connections and end on ordinary spaces, and that stations/slide origins are never properties or Golden Pluto spaces. Animals never use transports.
- **Golden Pluto count** is `map.goldenPlutoCount` (Tropical 2, Mountain 1); spawn eligibility is unchanged (`plutoEligible` is false for warps, boost, stations and slide origins).
- **Client.** `PartyRenderer` takes the map; scenery is per theme (`board/scenery/`), gameplay overlays (properties, radiation, animals, closures) are shared. `PartyBoard` receives `map`, flies the camera to Avalanches, rides and slides and keeps the active pawn in view. The lobby picker lists registered maps.
- **Persistence:** none. Database changes: none.

# 36. Implemented Notes: Production Hardening and Reconnects (Milestone 10)

- **Identity.** One session per browser tab: `Session { token, id, room, send, close, disconnectedAt, address }` in `server/party/rooms.ts`. The token (a server-issued UUID, kept in `sessionStorage`) is the reconnect secret and is never broadcast or logged; `id` is the public player id. `HELLO { token }` resumes a session (`SESSION.resumed = true`); anything that is not a known UUID starts a new session. A socket is never the identity.
- **Duplicate connections: newest wins.** A second `HELLO` with the same token rebinds the session to the new socket; the old one receives `ERROR { code: "SESSION_REPLACED" }` and is closed with 4001. Only `session.send` may act, so two sockets can never control one player. The client stops auto-reconnecting on `SESSION_REPLACED` and offers "Play here instead".
- **Reconnect = full authoritative snapshot.** No event replay: `STATE { lobby, serverNow }` carries everything (phase, turn state incl. roll/moves/aim, positions, HP, coins, Plutos, inventories, statuses, properties, bank, Pluto spawns, radiation, animals, closures, minigame public view with `startedAt`/`endsAt`, duel state). Game state is never touched by connect/disconnect, so nothing can be re-rolled, re-charged or re-awarded. Client-only, unconfirmed interactions (board targeting) are tied to `sessionEpoch` and dropped on reconnect; nothing was sent or consumed for them.
- **Timing lives in `NETWORK_CONFIG` (`config.ts`)**: `reconnectGraceMs` 60 s, `sessionTtlMs` 30 min, `heartbeatMs` 15 s, message/payload/room/rate limits, `maxMatchFailures`. Do not hard-code these elsewhere.
- **Disconnect → takeover.** `disconnect` marks `Player.connected = false` and `Player.reconnectDeadline` (server time) so every client can show "Reconnecting… Ns". After the grace period, in a match the **same seat** becomes `isBot = true` with `botTakeover = true` (no new player; all state kept) and the normal bot/minigame controllers play it. Reconnecting within the session TTL clears both flags (takeover-back). In a pre-game lobby the seat is released instead. `LEAVE` mid-match is an immediate takeover.
- **Host.** One rule: the oldest (earliest-joined) connected human, else the oldest human (`reassignHost`). Host status only matters before a match and for `RETURN_TO_LOBBY`; the authority owns running matches, so a host disconnect never ends one.
- **Rooms without a connected human are paused** (not ticked), as before; they resume on reconnect and are collected once no session refers to them.
- **Liveness.** Server: protocol ping every `heartbeatMs`; a socket that misses one is terminated (starts the grace period). Client: exponential backoff with jitter (1 s → 10 s), immediate retry on `visibilitychange`/`online`, and an app-level `PING`/`PONG` probe after returning to the foreground and every 25 s while visible, so half-open mobile sockets are replaced quickly without polling in the background.
- **Errors.** Expected rejections are plain `Error`/`PartyError` (`server/party/errors.ts`) with a player-facing message and an `ErrorCode`. Anything else (TypeError, …) is treated as a bug: the client gets a generic `SERVER_ERROR`, the log gets room/phase/round and the stack. Every room's tick/fastTick runs in its own try/catch; after `maxMatchFailures` consecutive failures the match is aborted back to its lobby (`MATCH_ERROR`), other rooms and the process are unaffected.
- **Bots never stall.** `safeBotAction` (`engine/bots.ts`) is the always-legal fallback per decision phase (roll, fire at centre, discard, leave, decline, first open route). The authority uses it when a heuristic throws or its action is rejected. `PartyRooms` accepts an injected `botDecision` for tests.
- **Validation.** The protocol parser (`network/protocol.ts`) is the schema: names via `cleanName` (NFC, control/zero-width/bidi characters removed, whitespace collapsed, 1–24 player / 1–40 lobby characters, `NAME_LIMITS`), codes via `normalizeLobbyCode` (`PLUTO-######`, any case, digits alone accepted), tokens must be UUIDs, numbers must be finite and bounded, unknown fields are dropped and unknown types rejected. No hand-written schema library was added; zod is not a dependency.
- **Rate limits** (`server/party/limits.ts`, per client address; `PARTY_TRUST_PROXY=1` uses `X-Forwarded-For`): lobby creation 6/min, code lookups (JOIN, and LIST with a full code) 12/min, plus the existing 25 messages/s per socket. Lobby codes are 6 CSPRNG digits, collision-checked.
- **Return to lobby.** `RETURN_TO_LOBBY` (host, `GAME_OVER` only) rebuilds fresh players (same ids, names, seats, bot difficulty; `ready = isBot`), releases bot-taken-over seats, clears the match and unlocks settings. `START` then creates a completely new `Match`.
- **Results stats.** `Match.stats[playerId] = { minigameWins, duelWins, knockouts }` (`engine/stats.ts`) is display-only and never read by a rule.
- **Performance.** `advance` returns the unchanged state without cloning while a phase is waiting (decision phases, timed phases before their deadline); previously every 100/700 ms tick cloned the whole match. Board snapshots are only sent on change; minigame snapshots keep their throttling.
- **Minigame readiness.** No ready handshake: minigame modules ship with the client bundle (nothing to load), every client derives the countdown from the authoritative `startedAt`/`endsAt` plus the `serverNow` offset, and a dead connection can never delay the start.
- **Server process.** `GET /health` (no internals), origin allow-list `PARTY_ORIGINS` (warned when unset in production), structured one-line logs (`server/party/log.ts`, `PARTY_LOG_LEVEL`), graceful `SIGTERM`/`SIGINT` shutdown (refuse new sockets, notify players with `SHUTDOWN`, close). **Live matches are memory-only and do not survive a process restart**; there is no crash recovery.
- **Client systems** (`src/games/party/client/`): `preferences.ts` (volumes, mute, motion override, control hints; `localStorage`, no database) and `audio.ts` (Web Audio synthesis on master/music/sfx/ui buses, created only inside a user gesture, suspended while the tab is hidden). `prefersReducedMotion()` is the single motion switch for the renderer, camera and CSS (`.pp-page[data-motion]`). React UI additions: `PartyErrorBoundary`, `ConnectionOverlay`, `PartySettings`, `FinalResults`, `PlayerStatus`, mobile turn dock, rotate tip.
- **Persistence:** none. Database changes: none.
