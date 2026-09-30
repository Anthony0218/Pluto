# Development Progress

## Purpose

This file records the actual implementation state of the project.

It must describe what exists in the repository, not what is merely planned in `GAME_SPEC.md`.

Every milestone implementation should update this document before completion.

---

# Current State

Pluto Party lives in `src/games/party/` (shared engine, content, network contracts, Pixi renderer, browser-only `client/` audio and preferences), `server/party/` (WebSocket authority, rooms, logging, limits) and `src/pages/games/Party/` (React UI). It is an isolated feature inside the existing React/Vite app, served at `/games/pluto-party`. Milestones 1–10 are implemented (two playable maps: Tropical Islands and Mountain). Matches live in server memory only and do not survive a server restart.

Last verification (Milestone 10 session, 2026-09-30): before any change, Milestones 1–9 were re-checked against the code (rooms/sessions, protocol, engine phases and `advance`, bots, minigame flow, duels, rare items, radiation, animals, Mountain mechanics, renderer, React screens, CSS) and by running the suite: 261 tests passing, `npm run check:party` and party lint clean. The Milestone 1–9 notes below matched the repository; no feature claimed there was missing. The audit found these hardening gaps, all addressed in Milestone 10: an exception inside the 700 ms/100 ms room ticks was not caught and would have crashed the whole Node process (every match); only `ITEM_PHASE` had a bot fallback (a rejected bot choice in any other phase would retry forever); unexpected engine errors (`TypeError` text) were sent verbatim to clients; a second connection with the same token silently took over without closing or telling the first socket; there was no heartbeat, so a dead mobile socket could hold a seat "connected" for minutes; the 60 s/30 min timings were literals; `GAME_OVER` offered only "Back to home" (no return to lobby, no per-player result stats); lobby names allowed 60 characters and names were not stripped of control/zero-width characters; lobby codes had no lookup rate limit; the HTTP server answered every path with "ok" and there was no graceful shutdown; `advance` cloned the whole match on every tick even when nothing was due; there was no audio, settings, error boundary, reconnect UI, or loading state for create/join/start/board; the Target Panic field allowed page panning (`touch-action: manipulation`); safe-area insets were inert because the viewport lacked `viewport-fit=cover`. The `duel` board tile is still inert (documented since Milestone 7; unchanged, not in scope).

Last verification (Milestone 9 session): before any change, Milestones 1–8 were re-checked against the code (map registry and content, graph helpers, engine phases, movement and path selection, fields, Golden Pluto spawning, properties, items, radiation, animals, bots, protocol/rooms/match setup) and by running the existing suite: 208 tests, all passing; `npm run check:party` clean. The Milestone 1–8 notes below matched the repository, with these findings: (1) the Milestone 9 brief refers to an existing Event registry, but none existed — Random Event fields were a hard-coded "+2 coins for everyone", so a small event registry was introduced (see Milestone 9); (2) the `duel` board tile is still inert (documented since Milestone 7, unchanged); (3) the lobby's map selector was a single hard-coded option and `validSettings` accepted only `"sunspill"`; (4) the match did not store its map (every call read `settings.mapId`), and the renderer/UI were hard-wired to the `tropical` constant — all now map-driven; (5) the map id of the Tropical map is `sunspill` (Milestone 2 name), not `tropical`, and was kept to avoid breaking settings/tests.

Last verification (Milestone 8 session): before any change, Milestones 1–7 were re-checked against the code (engine phases and round flow, item registry/inventory/timing, `engine/combat.ts`, `engine/graph.ts`, properties, economy and Pluto spawning, minigame registry/flow, duels, bots, protocol and rooms) and by running the existing suite: 158 tests, all passing; `npm run check:party` clean. The Milestone 1–7 notes below matched the repository. Three stale spots were found and corrected: `BoardNode.radiationRounds` was a placeholder on the **static, shared map content** that `eligiblePlutoNodes` read (live radiation must not live there; it now lives in `Match.radiationZones`, see Milestone 8); the lobby help text still listed only the three Milestone 4 items; and `Player.statusEffects` existed but was unused (it is now the generic status system).

Previous verification (Milestone 7 session): before any change, Milestones 1–6 were re-checked against the code (engine phases and round flow, item registry/inventory/timing, `engine/combat.ts` damage/KO, `engine/graph.ts`, properties, economy and Golden Plutos, minigame registry/flow/runtime/results, bots, protocol and rooms) and by running the existing suite: 108 tests, all passing; `npm run check:party` clean. The Milestone 1–6 notes below matched the repository and needed no correction. One documented rule was confirmed and preserved: there is **no** one-item-per-turn limit (only Turbo Boots cannot stack), so a player may still use further items after a Duel Saber duel, as long as they have not rolled.

Previous verification (Milestone 6 session): before any change, Milestones 1–5 were re-checked against the code (engine phases, properties, items, economy, rooms) and the existing 85 tests (all passing; strict typecheck and lint clean). The Milestone 1–5 notes in this file were accurate. The only stale document was `src/games/party/README.md`, which still described "milestones 1–4" and listed properties as deferred; it has been corrected. The Milestone 5 session had re-checked Milestones 1–4 against 63 tests. Earlier: Milestones 1–3 were verified against the code and by running the existing suite (34 tests, all passing) before Milestone 4 began. This file previously held only unfilled `VERIFY IN REPOSITORY` placeholders for them; the notes below replace those.

---

# Milestone Status

## Milestone 1 — Lobby Foundation

Status:

```text
COMPLETE
```

Verified in `server/party/rooms.ts`, `src/pages/games/Party/PartyHome.tsx`, `PartyLobby.tsx`, `tests/party-server.test.mjs`:

- home screen, create lobby, public/private lobbies, `PLUTO-######` codes, browser with name/code search, private lobbies discoverable only by exact code
- four slots, bots (add/remove/difficulty), ready state, host controls and migration, kicking, match settings (victory condition, targets, bot difficulty, fill bots)
- session tokens, reconnect, 60 s grace then bot takeover, 30 min seat reclaim, WebSocket message validation and rate limits

Database changes:

```text
none (lobbies and sessions are in memory)
```

---

## Milestone 2 — Core Tropical Board

Status:

```text
COMPLETE
```

Verified in `src/games/party/content/maps.ts`, `engine/engine.ts`, `board/renderer.ts`, `tests/party-engine.test.mjs`:

- Sunspill Islands: exactly 60 graph nodes with reciprocal connections, six islands, bridges and intersections; map registered in `mapRegistry`
- PixiJS board with pawns, dice, zoom/pan; starting rolls with group-preserving tie rerolls; turn order and rounds
- dice 0–10, server-paced movement, no immediate backtracking, path selection at forks, zero-roll skips tile resolution
- fields: coin, deposit, bank (jackpot), heal, hazard, ferry, event (island breeze), boost. Other tiles were inert placeholders (item became live in Milestone 4)

Database changes:

```text
none
```

---

## Milestone 3 — Economy and Golden Plutos

Status:

```text
COMPLETE
```

Verified in `engine/economy.ts`, `engine/engine.ts`, `PlutoOffer.tsx`, `tests/party-economy.test.mjs`:

- coins (start 20), Central Bank (`match.bank`), deposits, jackpot
- two Golden Plutos spawned by the server with eligibility filtering; exact landing resolves the tile first, then offers Buy/Leave; 20 coins each (coins leave the economy); the bought Pluto respawns elsewhere
- victory by Golden Plutos or coins with tie-breaks; bots buy/decline and plan exact landings

Database changes:

```text
none
```

---

## Milestone 4 — HP, Inventory and First Items

Status:

```text
COMPLETE
```

What was already there: `Player.hp/maxHp` (20/40), `RULES` constants, a heal field, and a hazard field with KO logic written inline in `resolveTile`; an `ITEM_PHASE` that only preceded rolling; `Player.inventory: string[]` (unused).

### HP implementation

`src/games/party/engine/combat.ts` is the single HP authority: `clampHp`, `isKnockedOut`, `damagePlayer`, `healPlayer`, `knockOut`, `respawnPlayer`, `findPlayer`. Players start at 20 HP with a 40 HP maximum; healing returns the HP actually restored. The heal and hazard fields now call these functions. Nothing in React decides HP.

### KO / respawn implementation

`damagePlayer` triggers `knockOut` when HP reaches 0 or below: up to `RULES.koCoins` (5) coins move to `match.bank` (fewer if the player has fewer), then `respawnPlayer` sets HP to 20, moves the pawn to the map start and clears `previousNodeId`. No turn is skipped. Every future weapon, hazard, animal or status effect should call `damagePlayer`.

### Inventory architecture

`src/games/party/items/`:

- `types.ts` — `ItemDefinition` (`id`, `name`, `description`, `rarity`, `icon`, optional `targeting: "node"`, `canUse(state, playerId)`, `execute(state, context)`) and `ItemUseContext`
- `definitions.ts` — Mega Medkit, Turbo Boots, Comet Melon
- `registry.ts` — `itemRegistry` (the existing generic `Registry`), `randomStandardItemId`
- `inventory.ts` — `createItemInstance`, `grantItem`, `replaceWithPending`, `discardPending`, `removeItem`, `findItem`
- `dice.ts` — `rollBonus` (0–5, injectable random)

Items are `ItemInstance { instanceId, itemId }` with ids `item-N` from `match.nextItemNumber` (no randomness in ids). `MAX_INVENTORY_SIZE = 3` (`config.ts`). A full inventory never drops items silently: the new item is parked in `match.pendingItem` and the phase becomes `ITEM_REPLACE` until the active player sends `REPLACE_ITEM` or `DISCARD_NEW_ITEM`; the authority validates both. A Golden Pluto offer on the same space follows the decision.

Random Item fields (`item` tiles, 12 on Sunspill) now award a uniformly random non-rare registered item, chosen by the server. Rare fields remain inactive. *(Rare fields became live in Milestone 8.)*

### Item timing implementation

`USE_ITEM { itemInstanceId, targetNodeId? }` is handled in `engine.ts` (`applyItemUse`). The server rejects it unless: it is the actor's turn, `phase === "ITEM_PHASE"`, `turn.hasRolled` is false, the instance is in the actor's inventory, `canUse` is true, and (for targeted items) the node exists. All checks run before any mutation; the item is removed and the effect applied only when everything passed. The protocol parser strips unknown fields so clients cannot send damage, heal or bonus values. UI buttons are disabled too, but that is only cosmetic.

Temporary turn state: `match.turn: TurnState { hasRolled, bonusMovement, bonusRolled, usedItemThisTurn }` (`newTurnState()`), rebuilt when the starting order resolves and at every `TURN_END`. Nothing temporary is stored on `Player`.

### Mega Medkit

Heals 20 through `healPlayer` (capped at 40). `canUse` is false at full HP. Consumed on use. Client shows a `+N HP` toast where N is the HP actually restored.

### Turbo Boots

Server rolls a 0–5 bonus at use time and stores it in `turn.bonusMovement`. The normal 0–10 roll then gives `movesRemaining = roll + bonus`. One Turbo Boots bonus per turn (`turn.bonusRolled`; a second pair is unusable that turn). Consumed on use; reset at the next turn.

### Comet Melon

Player picks any board node; damage by shortest graph distance (BFS, `engine/graph.ts`) from it: 15 at the target, 10 at distance 1, 5 at distance 2, 0 beyond. Owner is excluded. Positions are snapshotted before damage so KO respawns cannot change who is in range. Uses `damagePlayer`, so KOs work. Consumed on use. UI: Use → tap a board node (all nodes ringed, blast zone and per-node damage shown, opponents' expected damage listed) → Confirm/Cancel bar fixed at the bottom of the screen; a short explosion ring plays at the target.

### Gameplay feedback

`match.events` (last 12 `FeedbackEvent`s with increasing `id`, plus `eventSeq`) rides in the normal `STATE` snapshot next to the text log; `engine/events.ts` `emit` writes both. The client (`useNewEvents`) shows each event once as a toast (`+20 HP`, `-10 HP`, `ALEX HIT SARAH FOR 15`, `SARAH WAS KO'D`, `SARAH RESPAWNED`, item gained/swapped) and triggers the explosion. Events already present when a client connects are not replayed.

### HUD

Each player card shows `❤️ hp / maxHp` with a bar (turns red at 10 or less), `🪙 coins`, `Golden Plutos`, and `🎒 n / 3`. The local player gets an `Items (n/3)` button in the turn panel, usable any time; the panel shows 3 slots (icon, name, rarity, description, large Use button) and an explicit "items can only be used before rolling" notice after the roll. The full-inventory chooser replaces the turn panel.

### Bots

Bots use items in `ITEM_PHASE` before rolling (Medkit at 20 HP or less, Turbo Boots, Comet Melon on the node with the most expected damage when it is 10 or more) and discard the new item on a full inventory.

### Important files changed / added

- new: `src/games/party/engine/{combat,events,graph}.ts`, `src/games/party/items/*`, `src/pages/games/Party/{ItemPanel,ItemOverflow,FeedbackToasts}.tsx`, `src/pages/games/Party/useNewEvents.ts`, `tests/party-items.test.mjs`
- changed: `types.ts`, `config.ts`, `engine/engine.ts`, `engine/bots.ts`, `network/protocol.ts`, `content/maps.ts` (item tile active), `board/renderer.ts` (targeting overlay, explosion), `PartyMatch.tsx`, `PartyBoard.tsx`, `PartyLobby.tsx` (copy), `party.css`

### Tests added

`tests/party-items.test.mjs` (29 tests): start HP and 40 cap, damage/heal clamping, KO coin transfer/respawn/HP, fewer than 5 coins, KO without a skipped turn (hazard and off-turn), inventory capacity/pending/replace/discard/invalid instances, item timing (before roll, after roll, non-active player), Medkit, Turbo Boots (bounds, total movement, reset, stacking), Comet Melon (15/10/5/0, multiple targets, owner exempt, graph vs pixel distance, KO, invalid target), protocol stripping of forged values, and seeded bot matches checking invariants. Existing tests were not modified.

### Architecture changes

`Player.inventory` is now `ItemInstance[]`. `Match` gained `turn`, `pendingItem`, `nextItemNumber`, `events`, `eventSeq`. New phase `ITEM_REPLACE`. New actions `USE_ITEM`, `REPLACE_ITEM`, `DISCARD_NEW_ITEM`. `resolveTile` takes the random source. Recorded in `ARCHITECTURE.md` section 30.

### Database changes

```text
Database changes: none
```

Migrations created: none. Live HP, inventory, turn state and events are part of the in-memory authoritative match; the project has no persistent party tables and none were invented.

### Known limitations

- The full-inventory chooser UI and post-roll lock notice were verified by types, lint and engine tests, not exercised end to end in a browser. The HUD, Items panel, Comet Melon aiming/confirm, toasts, explosion, KO and respawn were exercised in a real browser session against a bot match.
- Inventories are visible to everyone in the shared snapshot (no hidden information yet).
- Item use has no per-turn limit apart from Turbo Boots not stacking.
- Board targeting relies on tapping small nodes; use the zoom buttons on phones.
- Comet Melon is exempt from self-damage by design for this milestone.
- Only three items exist; Rare fields, properties, duels and animals are untouched.
- Matches are still lost on server restart.

---

## Milestone 5 — Ownable Properties

Status:

```text
COMPLETE
```

### Property state architecture

`Match.properties: PropertyState[]` (`nodeId`, `ownerPlayerId`, `level` 0–4, `level4LastTriggeredRound`) is the single source of truth, created by `createProperties(map)` for every node of type `property` (6 on Sunspill, named "Outpost" via `BoardMap.propertyName`). The unused `Player.propertyIds` was removed to avoid a duplicate ownership record. Tunables live in `PROPERTY_CONFIG` (`config.ts`). All logic is in `src/games/party/properties/properties.ts` (`canPurchaseProperty`, `purchaseProperty`, `canUpgradeProperty`, `upgradeProperty`, `resolvePropertyLanding`, `resolvePropertyToll`, `transferCoins`, `isLevel4PlutoStealReady`, `plutoStealRoundsLeft`).

### Landing resolution

After the tile resolves in `RESOLVE_TILE`, `resolvePropertyLanding` runs once: unowned → offer (new phase `PROPERTY_OFFER`); owned by the active player below Level 4 → upgrade offer; owned by another player → toll resolved automatically (no offer). The offer is skipped when the player cannot afford it (and never for Level 4). The win check runs right after, so toll/Pluto transfers can end the match immediately.

### Purchasing, upgrading, tolls

- Buy: 5 coins, owner set, Level 1; the coins leave the economy (not the bank).
- Upgrade: 5 coins per level up to Level 4.
- Tolls (visitor → owner, capped at the visitor's balance, never negative): L1 3, L2 5, L3 10.
- Level 4: ready and visitor has a Pluto → 1 Golden Pluto moves to the owner; ready and no Pluto → up to 15 coins (cooldown not consumed); on cooldown → up to 10 coins.
- Cooldown: ready when `round - level4LastTriggeredRound >= 3` (or never triggered); stealing at round 10 blocks 11 and 12, ready at 13. Tracked per property, in rounds.
- Golden Plutos no longer spawn on property nodes (`eligiblePlutoNodes`).

### Server authority

New actions `BUY_PROPERTY {nodeId}`, `UPGRADE_PROPERTY {nodeId}`, `LEAVE_PROPERTY`. The server checks turn, `PROPERTY_OFFER` phase, that `nodeId` is the player's current node, that it is a property, ownership, level and coins. The protocol parser strips unknown fields, so owner/level/cost/toll cannot be forged. Every successful action moves the phase to `TURN_END`, so duplicate requests are rejected.

### Bots

`propertyDecision` (`engine/bots.ts`): Easy 50% if affordable; Medium buys/upgrades at 10+ coins; Hard buys at 8+ and upgrades L1–2 at 10+, upgrades L3→4 whenever affordable, but holds back when in Pluto mode, within 5 coins of a Pluto and within 10 spaces of one.

### UI

Board: every property has a ring (grey "OPEN" when unowned, owner-coloured with an `LV n` badge when owned; text badge so colour is not the only cue). Turn panel: `PropertyOffer` with large Buy/Upgrade and Leave buttons. Tapping any space shows `PropertyDetails` (owner, level, visitor toll, next upgrade, Level-4 Pluto theft ready / rounds left). Toasts for claim, upgrade, toll, cooldown and Pluto theft come from `match.events`. All state arrives through the normal `STATE` snapshot, so all clients stay in sync.

### Important files

- new: `src/games/party/properties/properties.ts`, `src/pages/games/Party/PropertyPanel.tsx`, `tests/party-properties.test.mjs`
- changed: `types.ts`, `config.ts`, `content/maps.ts`, `engine/{engine,bots,economy}.ts`, `network/protocol.ts`, `board/renderer.ts`, `PartyMatch.tsx`, `party.css`

### Tests added

`tests/party-properties.test.mjs` (22 tests): purchase/decline/duplicates, upgrades and max level, tolls L1–3, insufficient coins, Level 4 with/without Pluto, cooldown boundary, per-property cooldown, cooldown fallback, Pluto and coin victory via property, no HP damage, server validation (wrong node/phase/turn/owner, forged fields), bot decisions, Pluto spawn exclusion.

### Database changes

```text
Database changes: none
```

Migrations created: none. Property state lives in the in-memory authoritative match like the rest of the live state.

### Known limitations

- Property UI was verified by types, lint, tests and build, not exercised in a live browser session.
- An unaffordable purchase/upgrade skips the offer with no explicit prompt (the details are still visible by tapping the space).
- Property state is lost on server restart, like all matches.
- Hard-bot Pluto reserve is a simple heuristic.

---

## Milestone 6 — Minigame Framework and Target Panic

Status:

```text
COMPLETE
```

### Minigame registry architecture

`src/games/party/minigames/`:

- `types.ts` — `MinigameDefinition<S, I>`: `id`, `name`, `description`, `instructions`, `controls`, `durationSeconds`, `gameType: "main" | "duel"`, `supportsBots`, and authority hooks `create`, `parseInput`, `applyInput`, optional `botInputs`, `scores`, `rank`, `publicView`. `S` is the module's own runtime state, `I` its parsed input.
- `registry.ts` — `MinigameRegistry` (extends the shared `Registry`; validates id/name/duration; `pool(gameType)`) and `selectMinigame(pool, previousId, random)`.
- `index.ts` — the single `minigameRegistry`; adding a minigame is one `register` call.
- `flow.ts` — the only glue between the board and minigames: `startMinigame`, `beginMinigamePhase`, `finishMinigame`, `applyMinigameRewards`, `applyMinigameInput`, `stepMinigameBots`, `nextRoundOrder`, `toResults`, `publicMinigameView`, `isMinigamePhase`. It handles only ids, participants, timing, completion and rankings.
- `targetPanic/` — the first minigame (`config.ts`, `logic.ts`, `bot.ts`, `index.ts`).

Shared types (`types.ts`): `MinigameResult { playerId, position: 1–4, score? }` and `MinigameRuntime` (`minigameId`, `participants`, `status` INTRO/ACTIVE/FINISHED, `introStartedAt`, `startedAt`, `endsAt`, `resultsEndsAt`, opaque `state`, `results`, `rewards`, `rewardsApplied`, network-only `serverNow`). `Match` gained `minigame: MinigameRuntime | null` and `lastMinigameId`.

The client has a parallel presentation registry (`src/pages/games/Party/minigames/views.ts`, id → React component) because the rule registry must stay React-free for the server.

### Phase-flow changes

New phases: `ANIMAL_PHASE`, `MINIGAME_INTRO`, `MINIGAME`, `MINIGAME_RESULTS`, `ROUND_END`. `ITEM_PHASE` still acts as turn start.

```text
TURN_END (last player) → ANIMAL_PHASE (pass-through; real animal processing since Milestone 8)
→ MINIGAME_INTRO (server picks the game; 7 s incl. 3-2-1 countdown)
→ MINIGAME (duration from the definition)
→ MINIGAME_RESULTS (rank, rewards, win check; 8 s)
→ ROUND_END (reorder, round + 1, clear runtime) → ITEM_PHASE
   or → GAME_OVER when rewards reached the victory goal
```

The round counter now increments at `ROUND_END` instead of at the last `TURN_END`. `advance` and `applyAction` take an injected `now` (default `Date.now()`); timed phases return the unchanged state object until their deadline. Pacing lives in `MINIGAME_FLOW` (`config.ts`). Every board action (dice, items, Plutos, properties, paths) is rejected with "Board actions are paused…" in `ANIMAL_PHASE`, all minigame phases and `ROUND_END`, and the board UI (HUD, inventory, roll/property controls) is not mounted during minigame phases.

### Selection

`beginMinigamePhase` picks uniformly from `minigameRegistry.pool("main")` with the server's random source, excluding `match.lastMinigameId` whenever another game exists. With one registered game it repeats. Clients have no action to choose or start a minigame.

### Target Panic implementation

- Tunables: `TARGET_PANIC_CONFIG` (`targetPanic/config.ts`): 90 s, spawn every 700 ± 160 ms (540 ms in the final 15 s), 1.6 s lifetime, 350 ms late-hit grace, +1 / +3 / −2, golden 10 %, danger 20 %, minimum score 0, spacing, target size, view lookahead, bot profiles.
- Fairness: the server generates **one** schedule (positions, kinds, times) at intro start. Every player gets their own instance of every target (claims are per player), so latency never lets one player take a target from another, and humans and bots face identical targets.
- Positions are normalized to the space left after subtracting the target size, so targets never render off-screen; simultaneous targets keep a minimum distance. The HUD sits outside the play field.
- Server authority: clients send `{ type: "ACTION", action: { type: "MINIGAME_INPUT", input: { type: "TARGET_HIT", targetId } } }`. The server checks phase/status, time window, participant, input shape (`t<number>` ids), target existence, that the target has spawned and not expired (plus grace), and that it is not already claimed; it then applies the value of the target's kind. Scores are clamped at 0.
- Network: snapshots contain only `publicView`: targets from now − grace to now + 2 s, each player's claims for those targets, scores, and `serverNow`. The full schedule and bot plans never leave the server. During a minigame the server batches bot changes into at most one broadcast per 200 ms and refreshes at least once per second.
- UI (`TargetPanicScreen.tsx`): timer, own score, compact live standings, play field. Taps fire on `pointerdown` (mouse and touch; keyboard Enter/Space also work but are never required), with an instant local hide and `+1/+3/−2` pop, golden glow, danger shake, a shrinking lifetime ring and a "TIME!" banner. Danger targets differ by shape and symbol, not only colour. It re-renders at 10 Hz only inside the minigame screen; the field holds a handful of DOM nodes.

### Bot behavior

`targetPanic/bot.ts` is the per-minigame controller. A bot notices each target when it appears, decides whether to go for it (accuracy for good targets, mistake chance for danger ones) and taps after a random reaction delay; taps are sequential (≥140 ms apart). Each tap goes through `applyTargetHit`, so a too-slow tap is rejected exactly like a human's. Profiles: Easy 650–1000 ms / 60 % / 25 % mistakes; Medium 350–700 / 80 % / 10 %; Hard 180–450 / 92 % / 4 %. Simulated scores are roughly 50 %, 72 % and 88 % of a perfect run. The server runs bots in a 100 ms `fastTick` only while a minigame is active.

### Scoring, tie handling and results

Ranking (`rankTargetPanic`): higher score → fewer danger hits → server-random tiebreaker drawn at finish. `toResults` turns the ordered ids into unique positions 1–4 (throws on duplicates). The results screen lists place, name, points, reward and an animated coin count-up, then "X goes first next round" (or the victory message).

### Rewards

`MAIN_MINIGAME_REWARDS` in `config.ts` is the only place holding 10 / 5 / 3 / 0. `applyMinigameRewards` pays them once (guarded by `rewardsApplied`), records `minigame.rewards` for display and emits `MINIGAME_REWARD` feedback events. Clients never send rewards or rankings.

### Victory after rewards

Right after rewards the existing `detectWinner` runs. It now takes an optional priority order, and the minigame placement order is passed so simultaneous goal crossings go to the better placement. If someone won, the results screen still shows, then the phase becomes `GAME_OVER` and no new round starts.

### Next-round turn order

`nextRoundOrder(order, winnerId)`: the minigame winner moves to the front and everyone else keeps their previous relative order (`A B C D`, winner `C` → `C A B D`). The order carries over from round to round, so changes accumulate. `ROUND_END` sets `turnIndex = 0` so the winner acts first, resets `match.turn`, `lastRoll` and `movesRemaining`, clears `match.minigame` and records `lastMinigameId`.

### Reconnect and disconnect

The existing session reconnect works unchanged: a returning player receives the current snapshot, including their score, `endsAt` and the visible targets, and can keep playing (verified by reloading mid-game in a browser). The existing 60 s bot takeover also applies to minigames: the bot continues from the stored score.

### Important files

- new: `src/games/party/minigames/{types,registry,index,flow}.ts`, `src/games/party/minigames/targetPanic/{config,logic,bot,index}.ts`, `src/pages/games/Party/minigames/{PartyMinigame,MinigameIntro,MinigameResults,TargetPanicScreen}.tsx`, `src/pages/games/Party/minigames/{views,useServerClock}.ts`, `tests/party-minigame.test.mjs`
- changed: `types.ts` (phases, runtime/result types, `MINIGAME_INPUT`, `MINIGAME_REWARD`), `config.ts` (`MAIN_MINIGAME_REWARDS`, `MINIGAME_FLOW`), `engine/engine.ts` (phase flow, `now`, board-action lock, `detectWinner` priority), `network/protocol.ts` (bounded `MINIGAME_INPUT`), `server/party/rooms.ts` (`publicLobby`, `fastTick`, broadcast throttling), `server/party/index.ts` (100 ms timer), `PartyPage.tsx` (routing), `PartyMatch.tsx` (animal/round-end panel), `PartyLobby.tsx` (copy), `party.css`, `src/games/party/README.md`
- existing tests adjusted for the new round flow: "four turns advance round" now asserts the hand-over to `ANIMAL_PHASE` (round advancement moved to `ROUND_END`); the three seeded simulations pass a simulated 700 ms clock so timed phases progress. No assertions were weakened.

### Tests added

`tests/party-minigame.test.mjs` (23 tests):

- phase flow: last turn → animal → intro → start → end → results → round end → next round, with deadlines respected; board and item actions rejected in all minigame phases
- selection: registered pick, single-game repeat, invalid/duplicate/zero-duration rejected, previous excluded, duels never picked
- Target Panic: +1/+3/−2, floor 0, expired, not yet spawned, nonexistent, duplicate, per-player instances, non-participant, after end, outside `MINIGAME`, forged fields stripped, oversized inputs rejected, deterministic on-screen schedule, public view hides the future and bot plans
- bots: profiles valid and ordered, only scheduled targets, validated hits, never perfect, hard beats easy, server bot step, takeover keeps the score
- results: sorting, danger tiebreak, random tiebreak, four unique places
- rewards: exactly 10/5/3/0, applied once
- victory: a reward triggers coin victory with no new round; simultaneous goal → better placement
- turn order and cleanup
- a seeded 4-bot match looping board → minigame → rewards → board for four rounds
- server integration: simultaneous input, trimmed broadcast, reconnect restoring score and time, bot takeover

### Database changes

```text
Database changes: none
```

Migrations created: none. Minigame runtime (schedule, scores, timer, ranking) is live authoritative match memory like the rest of the match; the party feature has no persistence layer and none was invented.

### Known limitations

- The minigame clock is server wall-clock time. Rooms with no connected human are not ticked (existing pause behaviour), so a minigame whose last human disconnects keeps running in time; on return the phase jumps forward and bots are simulated for the missed period.
- `hitGraceMs` (350 ms) absorbs round trips up to roughly that size; on very slow connections, late taps are rejected.
- Snapshots reveal targets up to 2 s ahead, so a modified client could pre-aim. It still cannot create targets, tap before a target spawns or change point values. Aim-bot-style automation is not detected.
- Only one main minigame is registered, so "avoid repeats" has nothing to alternate with yet (covered by tests with stub registrations).
- No audio: the party feature has no audio infrastructure yet (Milestone 10). Feedback is visual.
- The browser run covered intro, play, hits, reload/reconnect, results and the return to round 2 at a 673 px-wide viewport. The wide-desktop minigame layout, the coin-victory-from-minigame screen and bot takeover were verified by tests, not in a browser.
- Duel minigames are only representable in the registry (`gameType: "duel"`); there is no duel flow (Milestone 7). *(Resolved in Milestone 7.)*

---

## Milestone 7 — Advanced Weapons and Duel System

Status:

```text
COMPLETE
```

### Scatterblaster

`items/weapons.ts` (`scatterblaster`). Opponent-targeted (`targeting: "player"`) aimed item. Range uses the shortest graph distance between the two pawns' `currentNodeId`s (`engine/graph.ts`, never pixels), with bands stored in `SCATTERBLASTER_CONFIG.bands` (`config.ts`):

| Band | Graph distance | Damage |
| --- | --- | --- |
| close | 0–1 | 20 centered / 15 partial |
| medium | 2–3 | 10 |
| long | 4–5 | 5 |
| out of range | > 5 | rejected, no shot |

The suggested ranges suit Sunspill (islands are 10-space rings, so 0–5 is roughly your island plus a bridge) and were kept. Farther bands also shrink the target marker and the hit radius. A miss deals 0. `canUse` is false with nobody in range, so the Use button shows "Not now".

### Lucky Six

`items/weapons.ts` (`luckySix`). Global range (any opponent). A small, faster target and a single hit radius: hit = 20 (`LUCKY_SIX_CONFIG.damage`), miss = 0, no spread and no partial damage.

### Aiming authority / security approach

Chosen approach: **server-generated challenge + validated release time + bounded normalized coordinates** (a combination of options A, B and C from the milestone brief). `items/aim.ts`:

1. `USE_ITEM { itemInstanceId, targetPlayerId }` runs the normal item validation (turn, `ITEM_PHASE`, `!turn.hasRolled`, ownership, `canUse`) plus the item's `validate` hook (opponent exists, not yourself, in range). The item is **not** consumed yet. The server seeds an `AimChallenge` in `match.turn.aim` (temporary turn state): the target marker sways on a Lissajous path whose frequencies and phases come from the server's random source at that moment, and the phase becomes `ITEM_AIM` (window 6 s Scatterblaster / 5 s Lucky Six).
2. The client drags a reticle and releases (desktop mouse or touch; a "Fire here" button also works). It sends `FIRE_ITEM { aimX, aimY, elapsedMs? }` only — reticle position in [-1, 1]² (protocol rejects values outside ±1.5 and non-finite numbers; the server clamps to ±1) and its elapsed aim time. The server uses that time only if it lies in `[serverElapsed − 300 ms, serverElapsed]` (`AIM_CONFIG.latencyToleranceMs`), otherwise its own receipt time. It recomputes where the target was, measures the offset and maps it to `centered` / `partial` / `miss` with the item's own geometry.
3. The item definition turns that quality into damage through `damagePlayer` (generic KO: up to 5 coins to the Central Bank, respawn at Start with 20 HP). The item is consumed after the shot whether it hits or misses. No client field for damage, accuracy or hit quality exists; the parser strips such fields.
4. `CANCEL_AIM` ("Lower weapon") returns to `ITEM_PHASE` with the item kept. If nothing is released, `advance` resolves the shot as a miss once the window plus `expiryGraceMs` (1.5 s) has passed and consumes the item, so aiming can never stall a turn. While aiming, every other action (roll, other items) is rejected.

Residual risk (documented, accepted for this milestone): the challenge must be sent to the client so it can draw the target, so a modified client could compute a perfect release. It still cannot pick damage, fire outside the window, shift the release time by more than 300 ms, or fire at an out-of-range or invalid target.

### Duel Saber architecture

`items/duelSaber.ts` + `duels/wager.ts` + `duels/duel.ts`, reusing the Milestone 6 minigame system.

- `USE_ITEM { itemInstanceId, targetPlayerId, wager }` with `wager: { type: "coins", amount } | { type: "pluto", amount: 1 }`. The target and wager are chosen in the client (target list → wager sheet) and submitted in one action, so the server validates everything atomically before any change; there is no server-side `DUEL_SETUP` phase and no half-configured duel can exist. The defender cannot refuse (no accept action).
- The Duel Saber is consumed only when the duel actually starts; any failed validation (self, unknown target, unfunded or malformed wager, no duel minigames registered) leaves it in the inventory.
- `startDuel` escrows the stakes, stores `match.duel` (`DuelState`) and starts a duel minigame through `minigames/flow.ts` (`startDuelMinigame`) in the shared `match.minigame` runtime with two participants.

### Duel wager rules

- Coins: any whole number from 1 to `min(challenger.coins, defender.coins)`; 5 / 10 / 20 are presets of the same rule (`DUEL_CONFIG`). Both players pay the stake at the start; the pot (`duel.pot`, 2 × stake) is held in duel state; the winner receives the whole pot. Balances can never go negative and no coins are created.
- Golden Pluto: both players need at least 1. Nothing is escrowed; at settlement exactly one Pluto moves from loser to winner, so the match total never changes. This is safe because every board action is rejected during the duel phases (nothing can spend or steal a Pluto meanwhile).
- `settleDuel` is idempotent (guarded by `duel.payout`). The normal `detectWinner` runs right after settlement with the duel winner first in priority; if someone reached the goal, the results screen shows and then the match goes to `GAME_OVER` without resuming the turn.
- Duels never pay the 10 / 5 / 3 / 0 main-minigame rewards (`finishMinigame` refuses non-main games; duels use `concludeMinigame` + `settleDuel`), never change `turnOrder`/`order`, the round counter or `lastMinigameId`.

### Duel state / phases

```text
ITEM_PHASE → (USE_ITEM duel-saber) → DUEL_INTRO (6 s incl. 3-2-1) → DUEL_MINIGAME (≤ 60 s, or until the game is decided)
→ DUEL_RESULTS (7 s; settlement + win check) → ITEM_PHASE of the same player (or GAME_OVER)
```

`DuelState { challengerPlayerId, defenderPlayerId, wager, pot, minigameId, winnerPlayerId, payout }` lives in `match.duel` and is cleared with the runtime when the duel ends (`endDuel`); nothing duel-related is stored on `Player`. The duel phase itself is the status (the spec's `status` field maps to `DUEL_INTRO/DUEL_MINIGAME/DUEL_RESULTS`). `match.turn` is never touched, so the challenger returns with the same turn state (not rolled, Turbo bonus kept) and can use more items or roll. `match.lastDuelMinigameId` keeps consecutive duels from repeating a game when an alternative exists.

### Minigame framework changes (shared by main and duel minigames)

- `MinigameDefinition` gained optional `tick(state, now)` (fixed-step realtime simulation to server time), `isFinished(state)` (early completion) and `snapshotIntervalMs`. Target Panic uses none of them and behaves exactly as before.
- `flow.ts`: shared `createRuntime`; `startDuelMinigame`, `selectDuelMinigame` (only `pool("duel")`), `simulateMinigame`, `concludeMinigame` (ranking only), `isDuelPhase`, `isMinigameScreenPhase`, `isMinigamePlayPhase`. `applyMinigameInput`/`stepMinigameBots` accept input in `MINIGAME` and `DUEL_MINIGAME`, simulate up to the input time first and reject input once the game is decided.
- There is still one generic client action, `MINIGAME_INPUT`; no duel-specific network messages were added.

### Paddle Panic

`minigames/paddlePanic/` (`config.ts`, `logic.ts`, `bot.ts`, `index.ts`). Server-simulated in 10 ms steps: two vertical paddles, one ball, wall and paddle collisions, edge hits give steeper angles, +0.55 speed per return (cap 16) and faster serves as time passes, first to 3 points (60 s cap; then score, then returns, then server random). Clients send only `{ type: "PADDLE", y }` (0–1 target height); paddles move there at a capped speed. Serve angles are pre-drawn at creation and hidden from the public view. Client (`PaddlePanicScreen.tsx`): canvas drawn by one `requestAnimationFrame` loop that extrapolates the ball (with wall folding) and shows the own paddle moving toward the finger immediately; drag anywhere on the court (touch/mouse), ↑/↓ or W/S optional; input throttled to one message per 70 ms; snapshots every 100 ms.

### Street Cross

`minigames/streetCross/`. 12 rows: start → 3 road lanes → safe strip → 3 road lanes → safe strip → 2 fast lanes → finish. Cars, bikes, trucks and buses move at constant per-lane speeds with guaranteed minimum gaps, generated once at creation; the whole lane table is public, so clients draw traffic locally and nobody (human or bot) has hidden information. Clients send `{ type: "MOVE", dx, dy }` (clamped, normalized); the server integrates movement, keeps runners in bounds and checks collisions. A hit respawns the runner on the last safe strip reached (start or a mid-course strip) with a 1.2 s stun and 2 s of invulnerability — no elimination. First to the finish wins; at the 60 s cap the runner furthest up wins, then fewer hits, then server random. Client (`StreetCrossScreen.tsx`): canvas + rAF, virtual joystick below the course (touch), WASD/arrows on desktop, input throttled to 80 ms.

### Duel bot behavior

- Paddle Panic (`paddlePanic/bot.ts`): reads the visible ball, predicts the intercept with wall reflections and misjudges it by a per-approach Gaussian error; reaction interval and tracking distance by difficulty (easy 280 ms / σ 1.8 / tracks late, medium 170 / 1.3, hard 110 / 0.95 — never zero). Same paddle speed cap as humans. Bot-vs-bot simulation: hard beats easy ~95 %, hard-vs-hard still ends early in ~30 % of games.
- Street Cross (`streetCross/bot.ts`): waits in the middle of a safe strip until the whole road section ahead looks clear for its crossing times (current positions and speeds only), then commits; judgement blurred by difficulty (easy σ 0.45 s, slow decisions, small margin, occasional "go anyway"; hard σ 0.06 s). Simulation: hard beats easy ~83 % and still gets hit occasionally; typical duels 20–45 s.
- Board bots (`engine/itemBots.ts`): Scatterblaster picks the in-range opponent with the best expected damage (difficulty aim model) with a bonus for possible KOs, easy bots are erratic; Lucky Six targets a KO-able opponent (preferring the leader), else the leader (hard) or the lowest-HP opponent (medium), easy random. Duel Saber: easy random legal target/wager; medium small coin stakes (≤ ⅓ of its coins, prefers 10/5); hard weighs its duel odds (`DUEL_BOT_SKILL`), the victory mode and thresholds (Pluto stake when favourable and someone is near the Pluto goal; all-in when the pot reaches the coin goal; keeps 20 coins for a Pluto in Pluto mode). Bot aim: `botAimRelease` adds Gaussian error (easy 0.17, medium 0.1, hard 0.05); hard Lucky Six hits ~75 %. All bot actions go through the same validation; the server now also catches a rejected bot action (logs it and rolls) instead of letting it escape the tick.

### Combat and duel notifications

New `FeedbackKind`s `SHOT`, `MISS`, `DUEL_CHALLENGE`, `DUEL_WAGER`, `DUEL_WON`, `DUEL_REWARD` ride in `match.events` like all feedback: e.g. `ALEX USED SCATTERBLASTER ON SARAH`, `ALEX HIT SARAH FOR 15 · CLOSE`, `LUCKY SIX MISSED!`, `SARAH WAS KO'D · 5 COINS TO THE BANK`, `ALEX CHALLENGED SARAH`, `WAGER: 10 COINS EACH`, `ALEX WON THE DUEL`, `ALEX RECEIVED 20 COINS`. The duel intro shows duelists, wager, pot, minigame, goal, controls and a 3-2-1 countdown; the results screen shows the winner, the pot / Pluto transfer and whether play returns to the challenger's turn or the match is over.

### UI

- `TargetPicker.tsx`: bottom sheet listing opponents (avatar, name, HP or coins/Plutos, board space, range band/distance); illegal targets are disabled with the reason. Duel Saber continues to a wager sheet: 5 / 10 / 20 (disabled when either player cannot cover them), Custom (−/+ buttons, numeric input and slider bounded 1–max), 1 Golden Pluto (disabled unless both own one).
- `AimOverlay.tsx`: full-screen aiming dialog with target marker, reticle, centered ring and spread ring (Scatterblaster), band/distance chip and countdown bar. On touch the reticle sits above the finger. Everyone else sees "X is aiming the Y at Z" and the target's space highlighted on the board.
- `DuelScreens.tsx` (intro/results) plugged into `PartyMinigame`; `PartyPage` routes all minigame and duel phases to the minigame screen.
- Canvas games and the aim overlay animate with a single rAF loop each (cleaned up on unmount) and read the server clock offset from a ref (`useServerOffset`), so they never re-render the app per frame. Keyboard listeners and throttling timers are removed on unmount.

### Networking

`USE_ITEM` gained optional `targetPlayerId` and `wager` (parsed strictly; unknown fields dropped); new actions `FIRE_ITEM { aimX, aimY, elapsedMs? }` and `CANCEL_AIM`. Duel minigames use the existing `MINIGAME_INPUT`. `publicLobby` adds `serverNow` to an active aim challenge. The 100 ms `fastTick` now also runs `DUEL_INTRO`/`DUEL_MINIGAME` and broadcasts realtime minigames at their `snapshotIntervalMs` (≥ 1 per second otherwise).

### Disconnects

No new reconnect subsystem. A reconnecting player receives the snapshot including `match.duel`, the runtime and the aim challenge. The existing 60 s bot takeover also covers duels (the minigame bot controller starts playing for that participant) and aiming (the board bot fires).

### Important files

- new: `src/games/party/items/{aim,weapons,duelSaber}.ts`, `src/games/party/duels/{duel,wager}.ts`, `src/games/party/engine/itemBots.ts`, `src/games/party/minigames/paddlePanic/*`, `src/games/party/minigames/streetCross/*`, `src/pages/games/Party/{TargetPicker,AimOverlay}.tsx`, `src/pages/games/Party/minigames/{PaddlePanicScreen,StreetCrossScreen,DuelScreens}.tsx`, `src/pages/games/Party/minigames/useThrottledInput.ts`, `tests/party-{weapons,duel,duel-minigames}.test.mjs`
- changed: `types.ts` (phases, `AimChallenge`, `DuelState`, `DuelWager`, `TurnState.aim`, `Match.duel/lastDuelMinigameId`, feedback kinds, actions), `config.ts` (aim, weapon, duel config), `engine/engine.ts` (aim/fire/cancel/timeout, duel phases, realtime minigame tick), `engine/bots.ts`, `items/{types,registry}.ts`, `minigames/{types,flow,index}.ts`, `network/protocol.ts`, `server/party/rooms.ts`, `PartyMatch.tsx`, `PartyPage.tsx`, `ItemPanel.tsx`, `FeedbackToasts.tsx`, `minigames/{PartyMinigame.tsx,views.ts,useServerClock.ts}`, `party.css`
- existing tests adjusted: the item-registry test now lists the six items, and the turn-state shape test includes the new `aim: null` field. No assertion was weakened.

### Tests added (50)

- `tests/party-weapons.test.mjs` (19): Scatterblaster phase/timing, self/unknown targets, graph bands, graph-vs-pixel range, out-of-range rejection, 20/15/10/5/0 damage, miss feedback, KO through the shared system, consumption on hit/miss and not on cancel, duplicate fire/use, timeout and late release, forged release time ignored / latency window honoured / coordinates clamped, protocol stripping of damage/accuracy/quality, Lucky Six global range, 20/0 with no partial, KO and consumption, locked after rolling, bot aim by difficulty (hard not perfect), bot target choice and validated fire.
- `tests/party-duel.test.mjs` (16): self/missing target, failed setup keeps the item, 5/10/20 validation, custom 1..min and invalid values (0, negative, fractional, NaN, strings, Infinity), Pluto requirement, consumption on start and no refusal, coin escrow/pot/winner-takes-all/no creation/settled once, Pluto transfer and constant total, coin and Pluto victory after a duel with no resumed turn, full phase flow with restored turn state and unchanged round/order/main-minigame history and no main rewards, board actions paused and spectators' input rejected, duel-only selection and main never picking duels, bot Duel Saber legality by difficulty, bot takeover of a disconnected duelist, seeded all-bot matches conserving coins/Plutos across every duel and resuming the same turn, and a server integration run (trimmed snapshots, realtime broadcast, bot opponent, return to the host's turn).
- `tests/party-duel-minigames.test.mjs` (15): Paddle Panic initialization, scoring and serve reset, paddle return and speed-up, wall bounces and prediction, capped paddle movement and strict input parsing, first to 3 with early finish, stopped simulation and rejected input, exactly one winner, bot legality/strength/imperfection, hidden public view; Street Cross traffic gaps, bounds and normalized input, checkpoint respawn with stun, checkpoint progression, finish and first-finisher win with rejected input afterwards, time-limit ranking, bot legality/strength/completion and hidden bot plans.

### Architecture changes

Recorded in `ARCHITECTURE.md` section 33: aimed items and the `ITEM_AIM` phase, player-targeted items with a `validate` hook, `canUse(state, playerId, map)`, duel phases and `match.duel`, and the realtime minigame hooks.

### Database changes

```text
Database changes: none
```

Migrations created: none. Aim challenges, duel state, pots, Paddle Panic and Street Cross runtime are live authoritative match memory like the rest of the match; the party feature has no persistence layer (no completed-match history either), and none was invented.

### Known limitations

- Aiming is client-rendered, so a modified client could compute a perfect release (see the security section). The server still controls timing, range, damage and consumption.
- Realtime duels are server-simulated with client extrapolation and no rollback: at high latency a human sees the ball/traffic slightly late (snapshots every 100–150 ms; own paddle/runner are predicted locally). Fine for a party game, not competitive netcode.
- The client sends the paddle/joystick intent at ~12–14 messages per second during a duel, under the existing 25 msg/s per-socket limit.
- A duel whose last human disconnects keeps running on the server clock like Milestone 6 minigames (rooms without a connected human are not ticked); on return the phase jumps forward.
- Browser verification (real authority + Vite, bots, a scratch-only harness that stocked the human's inventory): desktop — Scatterblaster picker and aim overlay (including a genuine server-side timeout → miss, item consumed), Lucky Six drag-and-release (miss, consumed), custom wager controls, a full Paddle Panic duel vs a bot with correct escrow (16 each) and pot payout (32), return to the same player's Item Phase in the same round, then a normal roll with items locked; reload mid-match reconnected into the same state. Mobile 375 px — target picker, wager sheet (custom stepper), a full Street Cross duel (joystick, keyboard), duel intro and results screens. Three UI bugs found this way were fixed: stepping the custom wager onto 5/10/20 closed the custom controls; the canvas games re-subscribed keyboard listeners on every snapshot, losing key-up so a Street Cross runner kept walking after release; the joystick pad was invisible on the white card.
- The browser tool cannot hold a touch, so the joystick and Paddle Panic touch drag were exercised as short drags plus held keyboard input; sustained touch-hold was not tested on a physical phone. Pluto-wager and victory-after-duel screens were verified by tests only.
- The `duel` board tile type (2 spaces on Sunspill) remains inert ("Duel · coming next"): landing-triggered duels were not part of this milestone's scope; Duel Saber is the only way to start a duel.
- No audio (Milestone 10).

---

## Milestone 8 — Rare Items, Radiation, Summoned Animals and Animal Phase

Status:

```text
COMPLETE
```

### Rare item registry

No second inventory or registry: the three rare items are ordinary `ItemDefinition`s with `rarity: "rare"` in the existing `itemRegistry` (`items/rare.ts`), so they share item instances, the 3-slot inventory, `USE_ITEM` validation, consumption, the replace/discard flow and the Items panel. `ItemRarity` (`"common" | "uncommon" | "rare"`) already existed. `ItemDefinition` gained one optional hook, `blockedReason(state, playerId, map)`: when `canUse` is false the server rejects with this text and the UI shows it (Wild Totem: "You already have an active summoned animal.").

### Rare Item field

`resolveTile` case `"rare"` → `grantItem(randomRareItemId(random))`. `randomRareItemId` (`items/registry.ts`) is a server-side weighted roll over `RARE_ITEM_WEIGHTS` (`config.ts`, the only place rare balance lives; currently 1 / 1 / 1). Weights naming unregistered or non-rare items are ignored, so the rare pool can never hand out a standard item; `randomStandardItemId` still excludes rare items. A full inventory uses the existing `ITEM_REPLACE` flow. The tile is now active ("Rare item · win a Pocket Duel, Fallout Core or Wild Totem"). Weighted picks share `engine/random.ts` `pickWeighted`.

### Pocket Duel

`pocket-duel` (🎮, `targeting: "player"`). Validation (all before anything changes): active player, `ITEM_PHASE`, not rolled, owns the item, not irradiated, target exists / is not self (`requireOpponent`), at least one duel minigame registered. It then runs the **same** Milestone 7 duel path: `startPocketDuel` (`duels/duel.ts`) stores `match.duel` with `kind: "pocket-duel"`, `wager: null`, `pot: 0`, picks a duel game with `selectDuelMinigame` (avoids repeating `lastDuelMinigameId`) and starts the shared minigame runtime (`DUEL_INTRO → DUEL_MINIGAME → DUEL_RESULTS → ITEM_PHASE` or `GAME_OVER`). The item is consumed only when the duel starts. A wager sent by a client is ignored.

Reward difference from Duel Saber: `settleDuel` branches on `duel.kind`. Pocket Duel → `winner.goldenPlutos += 1` (a **newly created** Pluto; the match total rises by one) and the loser loses nothing. Duel Saber → only transfers (escrowed coin pot, or one Pluto from loser to winner; totals unchanged). Neither pays the 10/5/3/0 main rewards or touches round, order, `match.turn` or `lastMinigameId`. `detectWinner` runs right after settlement with the duel winner first, so a Pocket Duel win can end the match immediately. `DuelState` gained `kind` and its `wager` became nullable; the duel screens show "PRIZE · NO WAGER / +1 NEW GOLDEN PLUTO / the loser loses nothing".

### Fallout Core

`fallout-core` (☢️, `targeting: "node"`). The client sends only `USE_ITEM { itemInstanceId, targetNodeId }`; the server derives everything else. Blast area = `falloutBlastNodes(map, target)`: the target plus its **directly connected** nodes (graph connections, never pixels; graph distance 2 is not included). Every non-owner player standing in the area (positions snapshotted first) is KO'd through the normal `knockOut` (up to 5 coins to the Central Bank, respawn at Start with 20 HP), then receives Radiation. A radiation zone with exactly the blast nodes is created.

**Owner rule:** the owner is immune to the initial blast wherever they stand (any node may be targeted, including one covering the owner). The owner is not otherwise protected: landing on the zone later irradiates them like anyone else.

UI: Use → tap a space → the board shows the centre ("☢ CENTRE"), the connected spaces (toxic fill, thick dark ring, ☢ label) and every other space as tappable; the bottom bar lists the blast size, the opponents who will be KO'd ("they respawn at Start with Radiation"), the owner immunity and the 3-round duration → **☢ Detonate / Cancel** (large touch targets, no hover).

Bots (`engine/rareBots.ts`): only zones containing at least one opponent are ever candidates (so a bot never blasts only itself). Score per caught opponent: +100, +2 per coin lost, +10 if HP ≤ 10, +40 if they lead the victory race; +10 per Golden Pluto node in the zone; −5 per already irradiated node; −25 if the bot's own node is inside. Easy: random candidate 60 % of the time. Medium: best zone if score ≥ 100. Hard: best zone, but half the time waits for ≥ 180 (two opponents or a leader) unless someone is ≥ 60 % of the way to the goal. All ~60 centres are evaluated (target + neighbours only).

### Radiation zones

Authoritative match state `Match.radiationZones: RadiationZone[] { id, sourcePlayerId, nodeIds, createdRound, expiresAfterRound }` (+ `nextZoneNumber`), in `hazards/radiation.ts`. Overlapping zones are allowed; a node is irradiated if any active zone contains it.

Duration semantics (tested): a zone created during round R is active for **the rest of round R plus the full rounds R+1, R+2 and R+3** (including their Animal Phases) and is removed at the `ROUND_END` of round R+3, before round R+4 starts. `expiresAfterRound = R + FALLOUT_CONFIG.zoneRounds (3)`. Example: created in round 5 → active 5 (rest), 6, 7, 8 → gone when round 9 begins. The board badge shows rounds left **including the current one** (`4R` right after creation).

Golden Plutos: replacement spawns exclude irradiated nodes (`BUY_PLUTO` passes `irradiatedNodeIds` as exclusions to `spawnPlutos`). **An existing Pluto on a node that becomes irradiated stays there** (risk/reward). Properties keep owner and level; tolls, upgrades and Level-4 behaviour work normally on irradiated nodes.

Visuals (Pixi, `board/renderer.ts`): toxic glow, dark ring with hazard ticks, yellow ☢ badge and a dark `nR` rounds-left badge on every irradiated space (not colour alone), gently pulsing; a large toxic blast animation on detonation. Tapping a space shows "☢ Irradiated · n rounds left … Landing here gives Radiation". Route buttons at forks show "☢ lands on radiation", "☢ passes radiation" or "☢ n irradiated landings" for that route; nothing is hidden and every route stays selectable. Legend entries for radiation and animals.

### Radiation status

Generic status system (`status/effects.ts`) built on the existing `Player.statusEffects: StatusEffect[]` (`{ id: StatusEffectId, remainingTurns }`), with a small `statusRegistry` of `StatusDefinition { id, name, icon, summary, itemLock?, onTurnStart? }`. Radiation is its only entry; no `player.radiationTurns` field exists.

- **Applied on landing only** (`RESOLVE_TILE`, before the field). Passing through, respawning at Start and arriving by ferry never irradiate. Blast victims receive it directly.
- **Timing:** every new board turn goes through `beginTurn` (first turn, `TURN_END` → next player, `ROUND_END` → first player): fresh `TurnState`, then `runTurnStartEffects`. For Radiation: `remainingTurns -= 1`, then 10 damage via `damagePlayer`, then the item phase opens. A radiation KO uses the normal KO (coin penalty, bank, respawn) and the turn continues. A duel returning to `ITEM_PHASE` does not re-run turn start.
- **Duration:** 3 affected turns. The effect is removed at that player's own `TURN_END` once `remainingTurns` is 0, so the player takes exactly 3 ticks (−30 HP in total) and cannot use items during all 3 of those turns. Landing mid-turn (3 left) does not count as an affected turn.
- **Stacking:** one Radiation per player; re-exposure **refreshes** to 3 (also from 0 during the last affected turn). It never adds a second damage source.
- **KO does not cleanse** Radiation.
- **Item lock:** `applyItemUse` rejects any `USE_ITEM` from a player with an item-locking status ("ITEMS DISABLED — RADIATION") before anything else is checked or changed. The Items panel shows the reason on a dark ☢ strip and "☢ Locked" buttons; bots skip items entirely while locked.
- **HUD:** each player card shows `☢ RADIATION · n turns` (or "final turn") with "-10 HP each turn · Items disabled", visible without hover. Toasts: "☢ SARAH IS IRRADIATED · LANDED ON A RADIATION ZONE", "☢ RADIATION: SARAH -10 HP", "RADIATION REFRESHED", "RADIATION FADED FROM n SPACES".
- Animals are immune: they have no status effects and never receive Radiation.

### Wild Totem

`wild-totem` (🗿, no target). Server rolls the animal with `WILD_TOTEM_WEIGHTS` (Cheetah 1, Crocodile 1) and summons it on the owner's current node; the item is consumed. `ANIMAL_CONFIG.maxPerOwner = 1`: while the owner has an active animal, `canUse` is false and the server rejects with "You already have an active summoned animal." (item kept). Different players may each have one, so up to four can be active. Toast: "ALEX SUMMONED A CHEETAH!". The animal first moves in the next Animal Phase.

### Animals

`animals/` — `types.ts` (`AnimalDefinition`: data only), `registry.ts` (`animalRegistry`: Cheetah, Crocodile; stats from `ANIMAL_CONFIG`), `runtime.ts` (shared behaviour). Runtime entity `AnimalInstance { id, type, ownerPlayerId, currentNodeId, remainingRounds, movementPerPhase, damage, sequence }` in `Match.animals` (+ `nextAnimalNumber`); animals are never `Player`s.

| | Movement / phase | Contact damage | Lifetime |
| --- | --- | --- | --- |
| Cheetah 🐆 | 5 nodes | 10 HP | 15 Animal Phases |
| Crocodile 🐊 | 2 nodes | 20 HP | 15 Animal Phases |

Shared behaviour (`moveAnimal`), recalculated every phase:

1. **Contact on its own space:** valid occupants of the animal's current space are attacked first (a player cannot hide by standing on it).
2. **Target:** the nearest non-owner player not yet hit this phase by shortest legal graph distance; ties go to the earlier seat (`match.players` order). No randomness.
3. **Move** along `findShortestPath` up to `movementPerPhase` nodes. Every space entered is a contact: **each non-owner occupant is attacked once** (seat order) through `damagePlayer`, so KOs use the normal coin penalty/bank/respawn rules. The same animal hits the same player at most once per phase (per-phase hit set), even if a KO respawn puts the victim back on its path. The animal stops on its target's space even with movement left.
4. The owner is never damaged. Animals never resolve tiles, collect coins/items/Plutos, use warps, buy anything or trigger events, and are immune to Radiation.

Lifetime: `remainingRounds -= 1` once per Animal Phase; at 0 the animal despawns at the end of that phase ("ALEX'S CHEETAH DESPAWNED"). A summoned animal therefore acts in exactly 15 Animal Phases.

Presentation: a dark diamond badge (not a pawn shape) with the animal emoji, owner-coloured frame and owner number, and a lifetime badge; during the Animal Phase each animal replays its recorded path node by node (one after another, in processing order) with a bite flash on every hit and a fade-out on despawn. Tapping a space lists animals on it; player cards list their owner's animal with rounds left. Reduced-motion users get instant moves.

### Animal Phase integration

```text
TURN_END (last player) → ANIMAL_PHASE
  no animals  → MINIGAME_INTRO immediately (unchanged)
  animals     → first tick: runAnimalPhase (all animals, creation order, authoritative)
                → wait until animalPhase.endsAt (1.4 s + 1.8 s per animal) for the animation
                → victory check → MINIGAME_INTRO (or GAME_OVER)
```

`runAnimalPhase` orders by `sequence` (creation order), processes every animal, ages them, removes expired ones and records `Match.animalPhase { sequence, startedAt, endsAt, steps[] }` (per animal: from, path, target, hits, despawned). Waiting ticks return the same state (no second move or ageing). The main minigame is selected only after the phase ends. The normal `detectWinner` runs afterwards (animals cannot create a win themselves; an existing one is not suppressed). The turn panel shows an "ANIMAL PHASE" summary of each animal's move and hits. Board actions stay rejected during the phase (existing lock).

### Pathfinding

`engine/graph.ts`: one unweighted-BFS toolkit for the whole engine. `graphDistances(map, from, max, restrictions)` and new `findShortestPath(map, from, to, restrictions)` (returns the nodes entered, `[]` when already there, `null` when unreachable/unknown; equal-length ties always resolve by map connection order) share `openConnections`. `RouteRestrictions` is a set of undirected `edgeKey`s. No gameplay mechanic closes routes yet (bridge collapse is a future event), so the live Animal Phase passes `NO_RESTRICTIONS`; the runtime and helpers accept a restriction set and tests cover it. Paths are computed once per animal per phase, never per frame.

### Bots

- Items: bots never attempt items while irradiated. Pocket Duel — easy random opponent; medium best duel odds (`DUEL_BOT_SKILL`), then fewest Plutos; hard weighs odds, the risk of handing a near-winner their last Pluto, and its own closeness to the Pluto goal. Fallout Core — see above. Wild Totem — easy 50 %; medium whenever it can; hard when an opponent is within 8 spaces (or 25 % of the time to avoid hoarding). Nobody tries a Wild Totem while owning an animal.
- Routes (`hazardScorer`, weights in `BOT_HAZARD_WEIGHTS`): irradiated landing −15 / −35 / −70 (easy / medium / hard; easy ignores radiation half the time). Hostile animal (not their own) within 2 spaces −10 / −40 / −55, within 3–5 spaces 0 / −15 / −20; hard scales the "near" radius with the animal's speed (Cheetah 5, Crocodile 2) and "far" to +3. Penalties are never absolute: a reachable Golden Pluto (+100) still wins, so a hard bot chases a Pluto through radiation.

### Server authority / networking

No new message types. Clients send `USE_ITEM` (with `targetNodeId` / `targetPlayerId` as before); the parser still strips any other field (affected nodes, animal choice, damage). The server alone chooses the rare item, the duel game and winner reward, blast area, KOs, zones and expiry, Radiation damage and lock, the Wild Totem animal, and all animal targets, movement, damage, lifetime and despawn. New match fields ride in the normal `STATE` snapshot. The Animal Phase is paced by the existing 700 ms board tick (no new timers or intervals). Reconnecting clients receive the full state; bot takeover interacts with animals and radiation like any player.

### Important files

- new: `src/games/party/items/rare.ts`, `src/games/party/animals/{types,registry,runtime}.ts`, `src/games/party/hazards/radiation.ts`, `src/games/party/status/effects.ts`, `src/games/party/engine/{random,rareBots}.ts`, `src/pages/games/Party/HazardPanels.tsx`, `tests/party-rare-items.test.mjs`, `tests/party-animals.test.mjs`
- changed: `types.ts` (status/zone/animal types, `DuelState.kind`, nullable wager, `Match` fields, feedback kinds; removed `BoardNode.radiationRounds`), `config.ts` (rare weights, Fallout/Radiation/animal/phase/bot-hazard config), `engine/engine.ts` (rare field, landing radiation, `beginTurn`, item lock, `blockedReason`, Animal Phase, zone expiry, Pluto spawn exclusion), `engine/graph.ts` (restrictions, `findShortestPath`), `engine/economy.ts`, `engine/bots.ts`, `items/{types,registry}.ts`, `duels/duel.ts`, `content/maps.ts` (Rare tile active), `board/renderer.ts`, `PartyMatch.tsx`, `PartyBoard.tsx`, `ItemPanel.tsx`, `ItemOverflow.tsx`, `TargetPicker.tsx`, `PartyLobby.tsx` (copy), `minigames/DuelScreens.tsx`, `party.css`
- existing tests adjusted (none weakened): the registry test lists the three rare items; the Pluto-spawn filter test now excludes irradiated nodes through match radiation instead of the removed static-map field; the seeded Duel Saber conservation test expects +1 total Pluto only when the duel was a Pocket Duel.

### Tests added (50)

- `tests/party-rare-items.test.mjs` (26): rare registry/categories and weights config; Rare field awards per weighted roll; rare pool only rare, standard pool never rare, foreign weights ignored; full-inventory replace/discard; no client rare choice and stripped fields. Pocket Duel: self/unknown/missing target keep the item; consumed on start, registered duel game, no wager/escrow even if one is sent; no immediate repeat; winner +1 / loser 0 both ways, no coin change or main rewards, same round/order/turn, original turn resumes; immediate Pluto victory; settles differently from a Duel Saber Pluto wager; bot targets legal at all difficulties. Fallout Core: blast = target + neighbours (not distance 2), invalid node; KO + bank + respawn + Radiation, owner immune, distance-2 player untouched, one zone; invalid/missing node keeps the item, consumed once; existing Pluto stays and replacements avoid irradiated nodes; properties unchanged; bots only blast zones with opponents and the server accepts them. Radiation: zone lifetime/expiry boundary and `roundsLeft`, harmless after expiry; landing applies it and the field still resolves once; passing through does not; 10 damage per affected turn, lock for all three turns, removal after the third, no fourth tick; refresh instead of stacking (including from 0); radiation KO with penalty keeps the status and the turn; server rejects an irradiated client and snapshots carry zones; bots skip items while locked.
- `tests/party-animals.test.mjs` (24): shortest paths match BFS distances and are legal; deterministic ties; blocked routes, unreachable and unknown nodes. Wild Totem: server roll → Cheetah/Crocodile with correct stats, spawn node, consumption; timing (after roll, other player's turn); one animal per owner with explicit reason, others may summon; bots never try it while owning one. Cheetah: nearest target, 5-node legal moves, stops on target, 10 damage, owner safe. Crocodile: 2 nodes, 20 damage, KO penalty/bank/respawn. Owner never hit. Contact hits all occupants once per phase (KO respawn onto the path is not hit again). Tie → earlier seat; retargeting each phase. Blocked routes respected. No field/Pluto/property/bank/item/radiation effects from animals. Creation-order processing, lifetime −1 per phase, despawn; exactly 15 phases. Round flow: last turn → Animal Phase → all animals processed → wait → minigame intro, no double processing; board actions rejected; victory check still runs; a new animal waits for the next phase. Bots: radiation avoidance increases with difficulty but a Pluto still wins; animal avoidance (own animal ignored); seeded all-bot matches with rare items keep every animal move legal and invariants intact.

The new rules were also mutation-checked: disabling landing radiation, shifting zone expiry by one round, removing the once-per-phase hit guard, removing owner immunity, never expiring statuses, stacking instead of refreshing, making Pocket Duel losers lose a Pluto, and letting bots blast empty zones each make at least one new test fail.

### Architecture changes

Recorded in `ARCHITECTURE.md` section 34: generic status effects, radiation as match state, animals as registry-driven board entities with one shared runtime, the real Animal Phase, `beginTurn`, `findShortestPath` + `RouteRestrictions`, `DuelState.kind`, and `ItemDefinition.blockedReason`.

### Database changes

```text
Database changes: none
```

Migrations created: none. Rare items, radiation zones, statuses, animals and the Animal Phase are live authoritative match memory like the rest of the match. The party feature has no persistence layer or live-match snapshots, so no schema needed extending.

### Known limitations

- Feedback history is 12 events per snapshot. An Animal Phase with several animals and KOs can emit more, so some toasts may be skipped; the Animal Phase panel and the dispatch log still show everything.
- An animal stops on its target's space even with movement left, and one standing on a player at the start of its move attacks them (documented rules, not configurable yet).
- No mechanic blocks routes yet, so restriction-aware pathfinding is only exercised by tests. *(Resolved in Milestone 9: Avalanche.)*
- Radiation is not applied on ferry arrival or on respawn at an irradiated Start (landing only). Radiation locks **all** items, including Pocket Duel.
- The zone badge counts the current round (`4R` right after a blast = this round + 3 full rounds).
- Browser verification (real authority + Vite, bots, a scratch-only harness outside the repo that stocked the human's inventory with the three rare items): desktop — Fallout Core targeting, preview, KO warning, detonate, toxic animation, zone markers and badges, existing Pluto left on an irradiated space, Radiation HUD chips, route hazard labels; Wild Totem summon (server rolled a Cheetah), animal badge, disabled second Totem with its reason; Pocket Duel picker → intro ("no wager / +1 new Golden Pluto") → Paddle Panic vs a bot → the bot gained exactly one Pluto, coins unchanged, same round, back to my turn; two live Animal Phases (the Cheetah bit players, a KO happened, the minigame started only afterwards, lifetime 15 → 14 → 13); a Radiation turn-start tick that KO'd a bot and kept its Radiation. Mobile 375 px — HUD status chips and toasts. The blast-preview contrast was strengthened after the run. Verified by tests only: landing on the Rare field, the Crocodile, the Fallout confirm bar at phone width, animal despawn animation, and a Pocket Duel victory screen.
- The `duel` board tile remains inert (unchanged from Milestone 7).
- No audio (Milestone 10).

---

## Milestone 9 — Mountain Map and Map-Specific Mechanics

Status:

```text
COMPLETE
```

### Map registry integration

No second board engine. Mountain is a second `BoardMap` (`content/mountain.ts`) in the same `mapRegistry` (`content/maps.ts`) and runs on the same movement, field, property, item, animal, radiation, Golden Pluto, bot and minigame code. `BoardMap` grew data-only fields (`theme`, `size`, `regions` (was `islands`), `tagline`, `description`, `eventPoolIds`, `flavor` log wording, `tiles` presentation overrides, `warps`, `transports`, `slides`, `blockableEdges`); Tropical received the same fields with values that reproduce its old behaviour. `Match.mapId` is set by `createMatch`; the engine, bots and server resolve the map with `mapOf(match)`, the lobby locks settings during a match, `validSettings` accepts only registered ids and the parser strips any map from actions. The renderer and React UI take the map instead of importing `tropical`.

### Mountain structure (60 nodes)

Ids `mountain-0` … `mountain-59`, 67 connections (all reciprocal, no crossings), 14 intersections, 8 independent loops, farthest space 22 steps from Start (Bank Jackpot 11 steps, Rare Item 15 steps; walking the Cable Car route takes 15 steps).

| Region | Nodes | Role |
| --- | ---: | --- |
| Mountain Village | 9 | ring around Start (`mountain-0`, the map's single Nothing field); market (boost), lantern-lit houses |
| Old Mine | 7 | two-tunnel loop between entrance and exit; Mine Cart, warp, event, heal, camp |
| Forest Trail | 8 | scenic main path plus stream detour; Cable Car lower station, heal, camp, items |
| Frozen Lake | 8 | open ring with two Frozen Slides, a duel field, a camp |
| Rope Bridges | 6 | two single-file bridges (west to Cliff Path, east to Frozen Cave): the main chokepoints; Bank Jackpot on the west bridge |
| Frozen Cave | 9 | long snake with a safe outer ice path (item, heal) and a risky inner tunnel (camp, tunnel warp) |
| Cliff Path | 5 | short, exposed route: Rare Item, Falling Rocks hazard, event, toll; Cable Car upper station |
| Summit | 8 | ring around the peak; duel field, camp, items |

Field distribution is exactly the GAME_SPEC table (18 coin, 12 item, 1 rare, 6 event, 6 deposit, 1 bank, 6 property, 3 heal, 2 duel, 2 warp, 1 hazard, 1 boost, 1 nothing), enforced by `validateMap`. Route design: Village → Lake has the shorter Mine route (event/cart risk, 5 steps from the entrance) or the longer Forest route (healing, items, 6 steps); Lake → Summit has the shorter, more dangerous Cliff route (9 steps) or the longer, safer Cave route (11 steps) with its own inner/outer choice; the two bridges are real chokepoints (closing one costs at least 4 extra steps, closing both cuts the upper mountain off — which is why Avalanche checks connectivity). The six Mountain Camps are spread over five regions and none sits on a bridge or the cliff.

### Golden Pluto

`map.goldenPlutoCount`: Tropical 2, Mountain 1. Spawn rules are unchanged (not Start, rare, bank, property, another Pluto, irradiated nodes) plus `plutoEligible: false` for warps, the boost field, transport stations and slide origins. Replacement after a purchase uses the existing path; with one Pluto the count can never reach 2. Candidates exist in every region (a test spawns Plutos across at least 7 regions).

### Mountain Camps

Only presentation: `propertyName: "Mountain Camp"`. All Milestone 5 property logic (costs, tolls, Level 4 theft/cooldown, phases, bots) is reused unchanged.

### Event registry and Avalanche

`events/` (`EventDefinition { weight, allowedMaps?, canRun, execute }`, `eventRegistry`, `eligibleEvents`, `runRandomEvent`): the Random Event field draws a weighted eligible event from the map's `eventPoolIds`, filtered by each event's `allowedMaps`. Tropical pool: `island-breeze` (Tropical-only, unchanged +2 coins, no random draw). Mountain pool: `avalanche` (3), `mine-collapse` (1), `cable-breakdown` (1), generic `windfall` (2, +2 coins each; allowed on any map). Snowstorm, Mountain Goats, Frozen Winds and Ice Melt are not implemented (registry-ready concepts only).

**Avalanche** closes one connection from `map.blockableEdges` (bridges, cliff and mine/forest exit connections) for 2 rounds. The server picks the edge randomly among *safe* edges: `safeBlockableEdges` simulates the closure on top of the active ones and requires the whole board to stay connected (`isMapConnected`). With no safe edge the event cannot run and the field falls back to another eligible event (or does nothing).

### Route-block architecture

`Match.blockedConnections: BlockedConnection[] { id, fromNodeId, toNodeId, expiresAfterRound, source }` (match state; the map graph is never mutated) plus `engine/routes.ts` (`activeRestrictions`, `safeBlockableEdges`, `blockConnection`, `expireBlockedConnections`, `blockedRoundsLeft`). Every routing consumer feeds the restriction set to the shared graph helpers: `legalPaths` (players), `reachableLandings` and `distanceToPluto` (bots, Pluto routing), bot hazard scoring, and `runAnimalPhase` (animals). Weapon and Fallout Core ranges deliberately stay on static graph distance. Expiry: blocked in round R for 2 rounds = rounds R and R+1, open again in round R+2 (removed at the `ROUND_END` of R+1); tests cover the boundary.

### Cable Car and Mine Cart (Map Transport)

One abstraction, `MapTransport { id, kind, endpoints, endpointNames, cost, prompt, rideLabel, stayLabel }` (`engine/transport.ts`), used for the **Cable Car** (Forest Trail lower station ↔ Cliff Path upper station, free) and the **Mine Cart** (Mine entrance ↔ Mine exit, free). Landing on a station resolves its own field normally, then opens the new phase `TRANSPORT_OFFER` (Ride / Stay: "Take Cable Car? YES/NO" for the Cable Car). Actions: `RIDE_TRANSPORT { transportId }`, `DECLINE_TRANSPORT`. The server validates phase, active player, that the player is at an endpoint of that transport, that it is not out of service and the fare; the offer phase ends on any decision, so repeated requests are rejected. A ride is not dice movement and **does not resolve the destination** (no field, property/Pluto offer or Radiation — those are landing-only), which also blocks exploit loops. Stations are never property or Pluto spaces (validated). Breakdown/collapse events close a transport for 2 rounds (`Match.transportOutages`, same expiry convention). **Animals never use transports** (ordinary graph routes only).

### Frozen Slide

`MapSlide { nodeId, path }` (two on the lake ring, each a fixed 2-space forced path). After the slide space's own field resolves (the +3 coin), the pawn moves along `path` with no route input, intermediate spaces do not resolve, and only the final space resolves, once, on the next step. `Match.forcedMove.pending` marks that arrival so it cannot chain another slide, warp or ride. `validateMap` rejects paths that leave the graph, revisit a node or end on a slide/station/warp. Bots value a slide space by its real end (`slideDestination`).

### Other Mountain presentation and fields

Warps are an *Ice Cave Tunnel* between the Old Mine and the Frozen Cave (`map.warps`, both directions, no retrigger on arrival; Tropical still ferries to the next island); the Hazard field is *Falling Rocks* (`-5 HP` through `damagePlayer`); the Nothing field (Start) logs and toasts "YOU FOUND A BEAUTIFUL VIEW. THAT'S IT." with no reward; tile legend/labels come from `tilePresentationFor(map)`. The Duel fields use the existing (still inert) `duel` tile behaviour.

### Bots

No separate Mountain bot. Path scoring uses the shared graph helpers with active closures and slide-aware landing values; Cable Car/Mine Cart decisions (`transportDecision`): easy accepts 50%, medium rides when the destination is closer to the objective (Golden Pluto, or a worthwhile bank in coin games), hard also subtracts destination hazards (radiation, hostile animals). Every action is validated by the server like a human's.

### Client

`PartyRenderer(map)` with per-theme scenery (`board/scenery/`: `tropical.ts` moved verbatim from the old renderer, new `mountain.ts`: sky gradient, layered region shelves, pines/houses/rocks/crystals, gorge under the bridges, stone/rope-bridge/rail/ice/cliff path styles, cable line with gondolas, mine-cart track, slide arrows), shared overlays. New overlays: Avalanche closures (hazard tape, snow pile, warning sign, "BLOCKED — n ROUNDS"), CLOSED chips on out-of-service stations, station/slide badges. `PartyBoard` takes the map, flies the camera to a new Avalanche/ride/slide with a banner and keeps the active pawn in view; `TransportPanel.tsx` is the ride prompt; the lobby has a map picker (name, tagline, active Golden Pluto count, preview swatch) and a CLOSURES list in the match aside. The Mountain board is taller than wide (1120×1040) and fits fully at zoom 1.

### Important files

- new: `src/games/party/content/{mountain,validate}.ts`, `src/games/party/engine/{routes,transport}.ts`, `src/games/party/events/{types,definitions,registry}.ts`, `src/games/party/board/scenery/{index,common,tropical,mountain}.ts`, `src/pages/games/Party/TransportPanel.tsx`, `tests/party-mountain.test.mjs`
- changed: `types.ts` (map fields, `Match.mapId/blockedConnections/transportOutages/forcedMove`, `TRANSPORT_OFFER`, actions, feedback kinds), `config.ts` (`FIELD_DISTRIBUTION`, `MAP_NODE_COUNT`, Avalanche/outage/bot-transport config), `content/maps.ts`, `engine/{engine,graph,economy,bots,rareBots}.ts`, `network/protocol.ts`, `board/renderer.ts`, `server/party/rooms.ts`, `PartyBoard.tsx`, `PartyMatch.tsx`, `PartyLobby.tsx`, `PartyHome.tsx`, `PlutoOffer.tsx`, `party.css`, `src/games/party/README.md`, `ARCHITECTURE.md` (section 35)
- existing tests were not modified.

### Tests added (53, `tests/party-mountain.test.mjs`)

Map integrity (registered, exactly 60 unique nodes, valid types, reciprocal, reachable, intersections/loops, exact distribution, 6 camps/1 rare/1 bank/1 Nothing, validation fails for bad count/one-way/unreachable/bad slide/bad edge/bad distribution, chokepoints, short-vs-long routes, placement rules); Golden Pluto (Tropical 2 / Mountain 1, replacement never yields 2, exclusions incl. radiation, regional spread); Mountain Camps (name, unchanged costs/tolls/Level-4 theft, offer flow); events (allowedMaps eligibility both ways, Tropical breeze unchanged with no random draw, Avalanche rules, connectivity safety with active closures, no-safe-edge fallback, every single closure keeps a way out); route blocking (players, bots, Pluto distance, animals, expiry off-by-one, real `ROUND_END`, snapshot visibility); transports (offer only at stations, free ride without destination trigger, phase/station/outage/repeat validation, decline, Mine Cart, breakdown events, bot decisions per difficulty and their legality); Frozen Slide (config, 2-space forced move, intermediate spaces skipped, single final resolution, no chaining, bot slide awareness); themed fields (Falling Rocks, tunnel warp, Nothing, Tropical ferry unchanged); item compatibility (Comet Melon graph distance, Fallout Core neighbours/KO/expiry, Wild Totem never uses the Cable Car, Duel Saber, Turbo Boots across intersections, Scatterblaster range band); map selection and authority (settings validation, forged fields stripped, host picks Mountain, all clients get `mapId`, settings lock, bots play a Mountain room into round 2 and the first minigame); seeded all-bot Mountain matches with movement/closure/Pluto-count/connectivity invariants. Six mutation checks (legalPaths ignoring closures, Avalanche ignoring connectivity, slides chaining, off-by-one expiry, animals ignoring closures, repeatable ride) each made at least one test fail.

### Database changes

```text
Database changes: none
```

Migrations created: none. Map content is code; Avalanche state, transports, slides, Pluto location and camp ownership are live authoritative match state. The party feature still has no persistence layer, so no schema was invented.

### Verification

Real browser run (real authority code + Vite, bots; a scratch-only harness outside the repo staged scenarios): lobby picker with both maps and Pluto counts; Mountain match start; a full round (board → Animal Phase → Target Panic → results → Round 2); Frozen Slide (origin coin, forced 2-space move, single final resolution, camera banner); Cable Car offer, ride and arrival without a destination trigger; Avalanche with camera fly-to, hazard tape/snow/"BLOCKED — 2 ROUNDS", CLOSURES list and route buttons omitting the closed path; CLOSED chips for both broken transports; Fallout Core targeting overlay on Mountain (centre + 3 neighbours); mobile 375 px (no horizontal overflow, large ride buttons, full board visible); Tropical still renders with all bridges. A rendering bug found this way (the Tropical path layer was dropped by the renderer split) was fixed. Verified by tests only: Wild Totem/Crocodile on Mountain, Duel Saber on Mountain, radiation display against snow, bot transport choices in a live match.

### Known limitations

- The Duel field is still inert on both maps (unchanged since Milestone 7).
- Only Avalanche, Mine Collapse and Cable Car Breakdown (plus generic Windfall) exist; Snowstorm, Mountain Goats, Frozen Winds and Ice Melt are not implemented.
- A closure that leaves a short dead-end pocket (e.g. the middle of the Cliff Path) is allowed: the board stays connected and pawns may turn around when the only forward step is blocked.
- Weapons and Fallout Core ignore closures (static graph distance); a blast can cross a snow-blocked path.
- `Match.forcedMove` drives the camera fly-to; pawns glide to the destination rather than walking the slide path.
- The Mountain board is 60 nodes on a 1120×1040 canvas: on a phone it fits fully but is small, so players zoom with the camera buttons (moved to the top-right on Mountain so they do not cover the Start village).
- Region art is original placeholder vector drawing; no image assets.
- No audio (Milestone 10). Matches are still in memory only.

### Next milestone

Milestone 10 — Polish and Hardening (not started).

---

## Milestone 10 — Production Hardening, Reconnects, Mobile Polish and Final Integration

Status:

```text
COMPLETE (see known limitations: no browser E2E framework; repository-wide Supabase migrations are not rebuildable from an empty database — pre-existing, outside Pluto Party)
```

### Reconnect behaviour

- **Identity:** per-tab session token (server UUID in `sessionStorage`) + public player id + room code. Refreshing the page reconnects to the same seat (`SESSION.resumed = true`). The token is never broadcast or logged. Malformed tokens start a new session.
- **State restoration:** a reconnecting client receives the full authoritative `STATE` snapshot (plus `serverNow`), which already contains everything needed (phase, round, active player/order, map, positions, HP, coins, Plutos, inventory, statuses, properties, bank, Pluto locations, radiation, animals, closures, minigame public view with `startedAt/endsAt`, duel state, aim challenge). Connect/disconnect never modify game state, so rolls are not repeated, items/wagers are not charged twice and field effects do not rerun. Tested for ITEM_PHASE, after the roll (MOVEMENT), PATH_SELECTION at an intersection (node, previous node, moves, identical choices), mid-duel (escrow once, saber consumed once), and mid-Target Panic (score and timer kept, also verified live in a browser).
- **Item targeting:** unconfirmed board targeting is client-only and tied to the connection epoch; a reconnect cancels it (nothing was sent or consumed). Committed uses are restored from state. Aimed shots (`ITEM_AIM`) are restored with their server challenge and expire as a miss on the server clock as before.
- **Duplicate connections:** newest connection wins; the older socket gets `SESSION_REPLACED` and is closed (4001). The replaced tab shows "This game is open in another tab — Play here instead".
- **Disconnect timeout:** `NETWORK_CONFIG.reconnectGraceMs` = 60 s. Other players see "Reconnecting… 42s" on the seat (from `Player.reconnectDeadline`), with a dashed card.
- **Bot replacement:** after the grace period the same seat becomes `isBot = true` with `botTakeover = true` (no new player; board position, HP, coins, Plutos, inventory, properties, statuses kept) and the normal board/minigame bots play it ("Bot (player left)"). **Takeover-back is supported:** the human can reclaim the seat within `sessionTtlMs` (30 min); after that the session expires and the seat stays a bot for the rest of the match. Leaving mid-match (two-step "Leave" button) is an immediate takeover.
- **Host migration:** oldest connected human (join order), else oldest human. In a lobby a disconnected host keeps the role during the grace period; afterwards the seat is released and the host moves. During a match the host has no authority role, so a host disconnect never ends the match; once a bot takes over the host's seat the role moves on, so someone can still use Return to lobby at the end.
- **Lobby reconnect:** seat, ready state and host role are kept during the grace period; afterwards the ghost seat is released (plus a defensive sweep for human seats with no session).
- **Connection UI:** header status pill (Connected / Connecting… / Reconnecting… / Connection lost / Open elsewhere); in a lobby, match or minigame a reconnect overlay blocks input (fades in after 0.8 s so blips do not flash) while the last authoritative state stays visible; actions are disabled until the server re-sends state. "Reconnect failed: your previous game is no longer available" after a server restart. The client never kicks the player home on a short interruption.
- **Mobile backgrounding:** exponential backoff with jitter (1–10 s), immediate reconnect on `visibilitychange`/`online`, app-level PING/PONG probe after returning to the foreground and every 25 s while visible (no polling while hidden); server-side ping every 15 s terminates dead sockets.

### Networking hardening and security

- Per-room error isolation in `tick`/`fastTick` (logged with room, phase, round and stack; match aborted to its lobby after 3 consecutive failures with a `MATCH_ERROR` message; other rooms unaffected). Unexpected errors reach clients only as a generic `SERVER_ERROR`.
- Bots: `safeBotAction` fallback for every decision phase when a heuristic throws or is rejected (no stall possible). No human turn timers were added (design unchanged).
- Protocol validation (existing hand-written parser extended; no new dependency): names cleaned and bounded (player 1–24, lobby 1–40 characters; control, zero-width and bidi characters removed; whitespace collapsed; rendered only as React text), lobby codes normalized (`pluto-123456`, `123456` → `PLUTO-123456`), UUID-only tokens, finite/bounded numbers, unknown fields dropped, unknown types rejected. Specific join errors: not found / full / already started / invalid code.
- Rate limits per client address: 6 lobby creations/min, 12 code lookups/min (JOIN and exact-code LIST), existing 25 messages/s per socket and 4 KB payloads.
- Server: `GET /health` (service, status, uptime only; 404 for other paths; 503 while stopping), `PARTY_ORIGINS` allow-list (warning in production when unset), `PARTY_TRUST_PROXY` for `X-Forwarded-For`, structured one-line logs without secrets (`PARTY_LOG_LEVEL`), graceful SIGTERM/SIGINT shutdown.
- Idempotency re-audit: every important action is validated against phase, active player and state (duplicate ROLL, USE_ITEM, BUY_PROPERTY, BUY_PLUTO, SELECT_PATH, RIDE_TRANSPORT and late MINIGAME_INPUT are rejected); rewards (`rewardsApplied`) and duel settlement (`payout`) are guarded; covered by existing and new tests.

### Match end

- Final results screen (`FinalResults.tsx`): winner and target reached, ranking by the active win metric then the secondary currency (existing `rankedPlayers`), minigame wins, duel wins, times KO'd and properties owned (`Match.stats`, display-only).
- **Return to lobby** (host, `GAME_OVER` only): fresh players (same seats/names/bot difficulty), ready reset, bot-taken-over seats released, settings unlocked; non-hosts see who they are waiting for and can go home. A new `START` creates a completely fresh match (tested: players, inventories, HP, coins, Plutos, properties, bank, radiation, animals, closures, minigame, duel, round, stats).

### Mobile, accessibility, loading and errors

- Safe areas: `viewport-fit=cover` is added to the viewport meta while the Pluto Party page is mounted (restored on leave, so other pages are unaffected); header, page gutters, overlays, dialogs and the mobile dock use `env(safe-area-inset-*)`.
- Mobile turn dock (≤ 700 px): always shows whose turn it is (YOUR TURN / NAME'S TURN / ANIMAL PHASE / NEXT ROUND), own HP/coins/Plutos/Radiation and the main action (Roll, or a jump to the turn panel). Compact scoreboard stats on phones (short labels with ARIA labels, larger small text).
- Short landscape phones: compact header and minigame chrome so Target Panic, Paddle Panic and Street Cross fit without scrolling; a dismissible "Rotate your phone" tip on the Paddle Panic court in portrait (never blocking).
- Touch: 44 px minimum for buttons, inputs, selects and icon buttons; `touch-action: none` on the Target Panic field (joystick and courts already had it); menus keep normal scrolling.
- Waiting states for non-active players ("Waiting for Alex to choose a path…", item/Pluto/property/ride decisions, rolling, aiming); lobby explains why the match cannot start yet or who it is waiting for.
- Loading states: initial connection, lobby list, create, join, start, return to lobby, board (Pixi/WebGL init), reconnecting; unsupported minigame id fallback.
- Error boundary (`PartyErrorBoundary`): recoverable screen with Try again / Reload / Return home; details only in the console.
- Accessibility: dialogs with `role`/`aria-modal`/labels, focus moved into Settings and restored on close, Escape closes, visible focus rings (existing), status/alert live regions, text next to every icon-only state (seat status, turn owner), no colour-only cues added.
- Reduced motion: one switch (`prefersReducedMotion()`: device setting or in-game override) drives the Pixi renderer, the board camera (instant pans) and CSS (`.pp-page[data-motion="reduce"]` disables animations/transitions); it now follows changes live.

### Audio and settings

- `src/games/party/client/audio.ts`: centralized Web Audio system with Master → Music / SFX / UI buses; every sound is synthesized at runtime (original; no audio files). Created and resumed only inside a user gesture (no autoplay errors); suspended while the tab is hidden; per-sound throttle and a voice cap so event bursts stay pleasant. Sounds: UI click, dice, coin gain/loss (own balance), Golden Pluto, property, damage, heal, KO, item, 3-2-1 countdown (server clock), go, results, animal, Avalanche, Cable Car/slide, radiation, duel, victory, miss. Music: a short procedural loop with calm/board/minigame moods.
- Settings sheet (header gear): Mute, Master/Music/SFX/Interface volume, Motion (device/reduced/full), control hints, fullscreen where supported, reset. Stored in `localStorage` (`preferences.ts`); no database.

### Performance

- `advance` returns early without cloning while a phase is waiting (it previously deep-cloned the full match on every 700 ms board tick and every 100 ms minigame tick for every room).
- Existing isolation kept: minigame clocks re-render only the minigame screen, canvas games draw in one rAF loop, snapshots are sent only on change (minigame throttling unchanged). The reconnect countdown mounts only for disconnected seats. All new timers/listeners are cleaned up on unmount.

### Integrity re-audit

Main minigame rewards (10/5/3/0 once, server placement, winner first next round), duel settlement (once, no main rewards, no round/order change), Golden Pluto counts (Tropical 2 / Mountain 1, price 20), properties (5/5, tolls, Level 4, cooldown), radiation durations and item lock, animal stats/lifetime/owner immunity, and map validation (60 nodes, reachability, distribution) are covered by the existing suites and were re-run; the new seeded all-bot matches additionally assert Pluto count, non-negative coins/bank, HP bounds, inventory bound, valid nodes, no stale minigame/duel state outside their phases and radiation expiry on every step, on both maps and both victory modes, to a real victory.

### Important files

- new: `server/party/{errors,limits,log}.ts`, `src/games/party/client/{audio,preferences}.ts`, `src/games/party/engine/stats.ts`, `src/pages/games/Party/{PartyErrorBoundary,PartySettings,ConnectionOverlay,OrientationHint,FinalResults,PlayerStatus}.tsx`, `src/pages/games/Party/{usePartyAudio,usePreferences}.ts`, `tests/party-hardening.test.mjs`, `.env.example`
- changed: `server/party/{index,rooms}.ts`, `src/games/party/{config,types}.ts`, `src/games/party/network/{protocol,usePartyConnection}.ts`, `src/games/party/engine/{engine,bots,combat}.ts`, `src/games/party/{duels/duel,minigames/flow}.ts`, `src/games/party/board/renderer.ts`, `src/pages/games/Party/{PartyPage,PartyHome,PartyLobby,PartyMatch,PartyBoard}.tsx`, `src/pages/games/Party/minigames/PartyMinigame.tsx`, `party.css`, `README.md`, `ARCHITECTURE.md` (section 36), `src/games/party/README.md`
- existing tests were not modified.

### Tests added (29, `tests/party-hardening.test.mjs`)

Reconnect in ITEM_PHASE (state byte-identical apart from connection fields), after the roll (no reroll), at an intersection (same choices, no auto-move in grace), mid-duel (single escrow/consumption, duplicate rejected); grace-period boundary and bot takeover of the same seat that then plays, takeover-back; expired session; lobby seat/ready/host kept during grace; ghost release and host migration; host disconnect does not end a match; duplicate session replacement; broken-room isolation and abort-to-lobby with a generic message; `safeBotAction` accepted in every decision phase of long seeded matches; injected throwing/rejected bot decisions fall back and move; return to lobby (host only, fresh state, clean new match) and release of taken-over seats; name cleaning/limits; code normalization; malformed tokens/NaN/Infinity/oversized/unknown messages; specific join errors and per-address rate limits; full lobby; seeded 4-bot matches to victory (Tropical/Mountain × coins/Plutos) with per-step invariants; `advance` no-clone fast path; real sockets: `/health`, create → bots → Mountain start → refresh with token restores the match, duplicate session over sockets, internal errors sanitized.

### Browser verification

Real authority + Vite on separate ports (a scratch harness outside the repo staged scenarios): home/lobby/match at 390×844 and 360×640 (no horizontal overflow), 844×390 landscape minigame (play field fits), 1280×800 desktop; create → ready → start; server-side socket drop mid-board-turn and mid-Target Panic (resumed, same phase, score 6 kept, timer continued); Comet Melon targeting cancelled by a reconnect with the item kept; "Reconnecting… 58s" on another seat; reconnect overlay and "Reconnect failed" after an authority restart; duplicate tab → "Open elsewhere" → "Play here instead"; Settings sheet; final results and Return to lobby. Two layout bugs found this way were fixed (settings controls inheriting the form-label layout; minigame field below the fold in landscape). Not verified in a browser: the error boundary screen (no safe way to trigger a render error), audio output (no speakers in the harness; no console errors), a physical iPhone notch/home indicator (safe-area CSS verified by inspection only).

### Database changes

```text
Database changes: none
```

Migrations created: none. Reconnect sessions, seat takeover, rate-limit counters, result stats and preferences are live server memory or browser `localStorage`; nothing needed persistent storage, so no tables were invented.

### Known limitations

- No browser E2E framework (Playwright is not a project dependency); critical flows are covered by WebSocket-level integration tests against the real server plus the manual browser run above.
- Live matches are in memory: a server restart ends them (players see "Reconnect failed"). Single instance only (no shared room store for horizontal scaling).
- Takeover-back after bot replacement is allowed for 30 minutes; decisions the bot already made stand.
- A match with no connected human is paused rather than played on by bots.
- Rate limiting is per address and in memory (resets on restart); players behind one NAT share limits.
- The client clock offset for countdowns uses the largest observed server-minus-local offset (as before), so countdowns can be early by the smallest one-way latency.
- Music/sounds are simple synthesized placeholders (original).
- The site-wide navigation bar (outside Pluto Party) sits above Pluto Party's page and can overlap the top of full-screen overlays on small phones.

### Next milestone

None defined in `GAME_SPEC.md` (Milestone 10 is the last). Not started: any further work.

---

# Architecture Decisions

Confirmed decisions from the project specification:

- React, Vite, TypeScript
- server-authoritative multiplayer architecture; graph-based board; modular content registries
- mobile-compatible gameplay
- PostgreSQL and version-controlled migrations for persistent data

Implemented decisions:

- Pluto Party is isolated in `src/games/party`, `server/party`, `src/pages/games/Party` with its own strict `tsconfig.party.json`. The server runs TypeScript directly with Node (`node server/party/index.ts`).
- Engine functions are pure-ish transitions on cloned state with injected randomness; the server calls `applyAction` for player intent and `advance` on a 700 ms tick.
- Content registers into the shared generic `Registry` (maps, items).
- HP loss/heal/KO go through `engine/combat.ts`; items are data-driven `ItemDefinition`s; temporary turn modifiers live in `match.turn`; feedback rides in `match.events` in the snapshot (see `ARCHITECTURE.md` section 30).
- Minigames are `MinigameDefinition`s in `minigameRegistry`; the board engine talks to them only through `minigames/flow.ts`. Time is injected (`now`) like randomness. Clients send `MINIGAME_INPUT` intent only and receive the minigame's `publicView` (see `ARCHITECTURE.md` section 32).
- Aimed items use a server-seeded challenge in `match.turn.aim` (phase `ITEM_AIM`) and are scored by the server from a bounded release; Duel Saber duels run the shared minigame runtime with `gameType: "duel"` inside the active player's turn (`DUEL_*` phases, `match.duel`), settle by transfer only and never touch round, order or main rewards; realtime minigames use the optional `tick`/`isFinished` hooks (see `ARCHITECTURE.md` section 33).
- Rare items are ordinary registry items with `rarity: "rare"`; Pocket Duel reuses the duel flow (`DuelState.kind`). Status effects use `Player.statusEffects` + `status/effects.ts`; radiation zones and animals are match state (`radiationZones`, `animals`, `animalPhase`); animals share one runtime and BFS pathfinding; every turn starts in `beginTurn` (see `ARCHITECTURE.md` section 34).

- Maps are data (`BoardMap`) in `mapRegistry`; the match stores `mapId`; Random Events come from `eventRegistry` filtered by `allowedMaps`; temporary route closures are `Match.blockedConnections` fed to the shared graph helpers; forced movement (Cable Car, Mine Cart, Frozen Slide) lives in `engine/transport.ts` with one resolution rule (see `ARCHITECTURE.md` section 35).
- Sessions are per tab (token + public id), newest connection wins, reconnect is a full-state snapshot, timings live in `NETWORK_CONFIG`, a timed-out human's seat is played by a bot (same player) and can be reclaimed, per-room error isolation with a safe bot fallback, protocol-level validation and rate limits, health/shutdown/logging, return-to-lobby resets, client audio/preferences in `src/games/party/client/` (see `ARCHITECTURE.md` section 36).

---

# Database / Migration Status

Database technology:

```text
PostgreSQL (planned per spec)
```

Pluto Party persistence:

```text
None. Lobbies, sessions and matches are in memory (server/party/rooms.ts). Player preferences are in browser localStorage.
```

ORM/database library for the party feature:

```text
None
```

The rest of the repository uses Supabase (`supabase/`) for other games; nothing in Pluto Party references it.

Migration directory for Pluto Party:

```text
None (no party schema exists)
```

Repository-wide database audit (Milestone 10, outside Pluto Party):

- Tool: Supabase CLI, SQL migrations in `supabase/migrations/` (30 files, `20260924150000_schafkopf.sql` … `20261001000000_eat_it_match_settings.sql`), PostgreSQL 17 (`supabase/config.toml`). Commands are documented in `README.md` (`supabase migration list`, `supabase db push`, local-only `supabase db reset`).
- **The history cannot build an empty database** (found by reading the SQL; not executed, no PostgreSQL/Docker here). Base tables such as `profiles`, `chess_rooms` and `chess_games` are referenced by migrations but created by none of them (they were created on the hosted project before migrations were tracked; the database tests say so and create a minimal stand-in in PGlite). No Docker/Postgres is available in this environment, and producing a correct baseline requires `supabase db pull`/`db dump` against the hosted project, which was not done here. Historical migrations were not edited.
- Remediation (needs project access): generate a baseline schema migration timestamped before `20260924150000`, review it, commit it, then verify `supabase db reset` locally.
- Secrets: `.env` and `.env.local` are git-ignored and have never been committed; `.env.example` (placeholders only) was added.

---

# Current Known Limitations

- Matches are in memory and lost on restart; no accounts or persistence.
- One main minigame (Target Panic) and two duel minigames (Paddle Panic, Street Cross). Only the Random Events listed under Milestone 9 exist. The `duel` board tile is still inert. Audio is synthesized placeholder sound.
- Aiming is client-rendered; a modified client could compute a perfect release (server still controls timing, range, damage, consumption).
- See the Milestone 4–10 limitations above.

---

# Next Milestone

```text
None defined — Milestones 1–10 of GAME_SPEC.md are complete.
```

---

# Last Verification

Last verified by:

```text
Claude (Milestone 10 implementation session)
```

Date:

```text
2026-09-30
```

Tests:

```text
PASS — npm run test:party: 290 tests (261 existing + 29 new), 0 failures
PASS — node --test tests/*.test.mjs (whole repository): 693 tests, 0 failures
```

E2E (browser):

```text
NOT CONFIGURED — no browser E2E framework; WebSocket-level integration tests + manual browser run (see Milestone 10)
```

TypeScript:

```text
PASS — npm run check:party (strict); tsc -b as part of npm run build
```

Lint:

```text
PASS for Pluto Party — npx eslint src/games/party src/pages/games/Party server/party tests/party-*.mjs (no findings)
FAIL repository-wide — npm run lint: 168 errors / 69 warnings in 75 files, all outside Pluto Party (pre-existing)
```

Production build:

```text
PASS — npm run build (only the pre-existing chunk-size warning for the site bundle)
```

Database migrations:

```text
Pluto Party: N/A — no persistent schema (Database changes: none)
Repository (Supabase): not rebuildable from an empty database — found by inspecting the SQL (base tables are referenced but never created); not executed, because no PostgreSQL/Docker is available in this environment (pre-existing; see Database / Migration Status)
```
