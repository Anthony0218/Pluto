# Card Builder

A configurable engine for games played with the 32-card deck (7, 8, 9, 10, J, Q, K, A × four suits), optionally extended with the 6s to 36 cards.
Games are **data** (`GameDefinition`); the engine has no game-specific code.

```text
cards/card.ts          Card, Suit, Rank, deck generation, rank comparison against a per-game order
engine/types.ts        GameDefinition, GameState (plain JSON), events, actions, end conditions
engine/runtime.ts      the mutable working copy of one step; moveCard() emits ZONE_EMPTY/HAND_EMPTY/…
engine/refs.ts         player / player-set / zone / card / value references
engine/conditions.ts   condition registry (AND / OR / NOT + primitives), registerCondition()
engine/effects.ts      effect registry (moveCard, deal, assignRole, startPhase, if, forEachPlayer, …)
engine/rules.ts        event queue + WHEN/IF/THEN rules by priority (stopProcessing shadows lower rules)
engine/phases.ts       generic phase manager (entry/exit effects, transitions)
engine/endConditions.ts generic end conditions (finish, last player, score, custom)
engine/actions.ts      getAvailableActions(def, state, playerId) — the UI's only source of options
engine/GameEngine.ts   createGame, performAction, getPlayerView, serialization
engine/validation.ts   parseGameDefinition (allowlist, used by the server) + validateDefinition
engine/rulebook.ts     generated rulebook facts and "how this is configured" explanations
engine/bot.ts          generic test bot (chooses among the engine's options, weighted by action botWeight)
engine/combinations.ts declarative card combinations / hand rankings (pairs, runs, same suit)
engine/simulate.ts     headless bot-vs-bot runs and per-seat summaries (Simulation tab)
templates/             Blank Game, Durak 6–A, Short-Deck Poker, High Card Battle, Kings & Sevens (fixture)
versioning.ts          Game → Version 1, 2, …; published versions are immutable
storage/               local (browser) and Supabase repositories
rooms.ts               online rooms: share codes, seat planning, the snapshot the card-games function returns
client/onlineRoom.ts   browser calls for createRoom / getRoom / joinRoom / startRoom / leaveRoom / act
```

## One action

```text
performAction → validate against getAvailableActions → ACTION_ATTEMPTED / CARD_PLAY_ATTEMPT
(rules may rejectAction) → default change (move card / record pass) → action effects →
ACTION_COMPLETED → settle: drain events through rules → end conditions → phase transitions →
auto-pass → repeat until stable
```

Limits per action (`ENGINE_LIMITS`): event depth 24, 4000 rule/effect executions, 120 phase changes.
Hitting one rolls the action back with an error. All randomness comes from `state.rng` (seeded).

## Safety

User definitions can only reference registered condition/effect types, the allowlisted action
types, events and end conditions. `parseGameDefinition` rejects anything else (unknown fields,
parameters or value shapes) and is what the `card-games` edge function runs before storing a
definition. Nothing is ever evaluated as code.

## Tests

```bash
npm run test:card-builder
```
