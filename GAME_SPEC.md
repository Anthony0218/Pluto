# Game Specification

## 1. Project Overview

This project is an original online multiplayer party board game built for the web.

The game may take general inspiration from party board games such as Pummel Party and Mario Party, but all names, maps, items, characters, UI, minigames, graphics, audio, mechanics, and other creative content should remain original.

The game combines:

- online multiplayer
- private and public lobbies
- bots
- board-game movement
- branching routes
- dice rolls
- coins
- HP and combat
- items
- rare items
- Golden Plutos
- property ownership
- random events
- dynamic hazards
- summoned animals
- short multiplayer minigames
- configurable victory conditions

The application uses React, Vite, and TypeScript and must work on both desktop and mobile browsers.

---

# 2. Players

Initial matches contain exactly:

- 4 player slots

Each slot can contain:

- a human player
- a bot

Starting player values:

```ts
coins = 20;
goldenPlutos = 0;

hp = 20;
maxHp = 40;

inventory = [];
```

Maximum inventory size:

```ts
3;
```

Players may heal above their starting 20 HP, up to a maximum of 40 HP.

---

# 3. Lobby System

The application must support:

- Create Game
- Find Game
- Join With Code

## Create Game

The host may configure:

- lobby name
- public or private lobby
- private join code
- selected map
- victory condition
- Golden Pluto target
- coin target
- bot difficulty
- whether empty slots should be filled with bots

Private lobby codes should be easy to share.

Example:

```text
PLUTO-4821
```

## Lobby Room

Display four slots.

The host may:

- add bots
- remove bots
- kick players
- change bot difficulty
- change map
- modify match settings
- start the match

Human players have a Ready state.

Only the host can start the match.

## Find Game

Display public lobbies which:

- have available player slots
- have not yet started

Allow searching by:

- lobby name
- lobby code

Private lobbies must not appear in the general public lobby listing.

They may be joined using the exact private lobby code.

---

# 4. Victory Conditions

The host selects the victory condition before the match.

## Golden Pluto Victory

Available targets:

- 3
- 5
- 7
- 10

Default:

```text
5 Golden Plutos
```

## Coin Victory

Available targets:

- 100
- 150
- 200
- 250
- 300

Default:

```text
200 coins
```

Coins are primarily an economy resource, so the coin victory threshold should remain relatively high.

---

# 5. Starting Turn Order

At match start all players begin on the Start node.

Each player rolls:

```text
0–10
```

Highest roll goes first.

Order is descending by roll result.

Tied players reroll until their relative order is resolved.

---

# 6. Board Round

Each board round consists of every player taking one turn.

Turn sequence:

```text
TURN START
↓
ITEM PHASE
↓
NORMAL DICE ROLL
↓
MOVEMENT
↓
PATH SELECTION IF REQUIRED
↓
LANDING FIELD RESOLUTION
↓
TURN END
```

After all four players have moved:

```text
ANIMAL PHASE
↓
MINIGAME
↓
MINIGAME RESULTS
↓
NEXT BOARD ROUND
```

The winner of the previous main minigame becomes the first player to act in the next board round.

The remaining players keep a predictable relative order.

---

# 7. Item Timing

Items may only be used before the normal dice roll.

Before rolling:

```text
[ ITEMS ] [ ROLL ]
```

After rolling:

```text
ITEM USE DISABLED
```

The server must also enforce this rule.

Disabling the button on the client is not sufficient.

---

# 8. Dice

Normal dice range:

```text
0–10
```

A roll of zero means:

- no movement
- do not retrigger the current landing field

Some items may add additional movement.

---

# 9. Board Representation

Boards must be represented as graphs rather than simple arrays.

Example:

```ts
interface BoardNode {
  id: string;

  x: number;
  y: number;

  type: TileType;

  connections: string[];

  metadata?: Record<string, unknown>;
}
```

Players store:

```ts
currentNodeId: string;
```

At intersections, players choose which valid connected route to follow.

Example:

```text
          node-31
             ↑
             |
node-28 ← node-30 → node-42
```

Movement pauses when player input is required.

After a direction is selected, movement continues until the roll is exhausted or another intersection requires input.

Do not normally allow a player to immediately reverse onto the node they just came from unless the board explicitly supports it.

---

# 10. Maps

Implement two 60-node maps.

Each map contains exactly:

```text
60 playable circular board spaces
```

All regions must be connected.

Maps should contain:

- intersections
- loops
- reconnecting paths
- bridges
- alternate routes
- strategically meaningful route choices

---

# 11. Tropical Islands Map

Theme:

A colorful tropical archipelago made of several islands connected with bridges and paths.

Suggested regions:

- Main Island
- Coconut Island
- Jungle Island
- Pirate Cove
- Lagoon Island
- Volcano Island
- Ancient Temple Island

Potential environment features:

- wooden bridges
- rope bridges
- docks
- ferries
- sandbars
- jungle routes
- ruins

The map should feel:

- open
- spread out
- movement-focused
- route-heavy

Golden Plutos active simultaneously:

```text
2
```

Potential map events or mechanics:

- temporary ferries
- tides changing routes
- whirlpools
- tropical storms
- cannon launches
- bridge collapses
- volcano events

---

# 12. Mountain Map

Theme:

An alpine mountain environment.

Suggested regions:

- Mountain Village
- Forest Trail
- Old Mine
- Frozen Cave
- Cliff Path
- Rope Bridge
- Frozen Lake
- Cable Car
- Summit

The map should feel:

- more compact
- more dangerous
- more confrontational
- more chokepoint-focused

Golden Plutos active simultaneously:

```text
1
```

Potential map events:

- avalanches
- cable cars
- frozen sliding areas
- mine carts
- unstable bridges
- mountain goats
- cave shortcuts

---

# 13. Field Distribution

Each 60-node board should approximately use:

| Field Type                  | Count |
| --------------------------- | ----: |
| +3 Coin                     |    18 |
| Random Item                 |    12 |
| Rare Item                   |     1 |
| Random Event                |     6 |
| Pay 3 Coins to Central Bank |     6 |
| Claim Central Bank          |     1 |
| Ownable Property            |     6 |
| Healing                     |     3 |
| Duel                        |     2 |
| Warp                        |     2 |
| Hazard                      |     1 |
| Boost                       |     1 |
| Nothing                     |     1 |
| Total                       |    60 |

Golden Plutos are overlays and do not count as permanent field types.

---

# 14. Standard Field Effects

## Coin Field

Gain:

```text
+3 coins
```

## Random Item Field

Receive a random standard item.

If inventory is full, allow the player to:

- replace an existing item
- discard the new item

## Rare Item Field

Receive one randomly selected rare item.

## Event Field

Resolve a random event from the event registry.

## Bank Deposit Field

Pay:

```text
3 coins
```

into the Central Bank.

If the player has fewer than 3 coins, pay whatever they have.

## Bank Jackpot Field

Receive the entire Central Bank balance.

Then:

```text
centralBank = 0
```

## Healing Field

Restore:

```text
+10 HP
```

up to maximum HP.

## Warp Field

Teleport according to the current map's Warp behavior.

For the initial implementation, use one consistent and predictable Warp rule.

## Hazard Field

Initial default effect:

```text
-5 HP
```

## Boost Field

Move:

```text
+3 spaces
```

using normal path-selection rules.

A Boost reached through bonus movement should not cause infinite recursive movement.

## Nothing Field

Does nothing.

It should be presented humorously because it is the rarest ordinary field.

---

# 15. Properties

There are six ownable property fields per board.

Map-specific names:

Tropical:

```text
Outpost
```

Mountain:

```text
Mountain Camp
```

An unowned property may be purchased for:

```text
5 coins
```

When its owner lands on it again, they may upgrade it for:

```text
5 coins
```

Property effects:

| Level | Visitor Effect            |
| ----- | ------------------------- |
| 1     | Pay owner 3 coins         |
| 2     | Pay owner 5 coins         |
| 3     | Pay owner 10 coins        |
| 4     | Give owner 1 Golden Pluto |

If a visitor lands on Level 4 but owns no Golden Pluto:

```text
pay 15 coins instead
```

A particular Level-4 property may steal at most:

```text
1 Golden Pluto every 3 rounds
```

Property ownership and level should be clearly visible on the board.

---

# 16. Golden Plutos

Golden Plutos are the primary collectible.

They spawn dynamically on eligible board nodes.

Price:

```text
20 coins
```

When a player lands on a Golden Pluto:

```text
GOLDEN PLUTO

Price: 20 coins

[ BUY ]
[ LEAVE ]
```

If purchased:

```text
coins -= 20
goldenPlutos += 1
```

The collected Golden Pluto disappears and a replacement spawns on another eligible node.

Do not spawn Golden Plutos on:

- Start
- Rare Item field
- Bank Jackpot
- another Golden Pluto
- invalid special nodes
- preferably irradiated nodes

Tropical Islands:

```text
2 active Golden Plutos
```

Mountain:

```text
1 active Golden Pluto
```

When a new Golden Pluto appears:

- show a global notification
- move the camera to the new location
- return the camera to the active player afterward

---

# 17. Central Bank

Central Bank receives money from:

- Bank Deposit fields
- KO penalties
- selected events
- future gameplay mechanics

Display its current balance in the game HUD.

---

# 18. HP and KO

Players start at:

```text
20 HP
```

Maximum:

```text
40 HP
```

When HP reaches zero:

```text
KO
↓
lose up to 5 coins
↓
coins go to Central Bank
↓
respawn at Start
↓
HP = 20
```

Players do not skip a future turn because of a KO.

---

# 19. Inventory

Maximum inventory:

```text
3 items
```

Use item instances rather than plain strings.

Example:

```ts
interface ItemInstance {
  instanceId: string;
  itemId: string;
}
```

Items should be stored in an extensible registry.

---

# 20. Standard Items

Initial and planned standard items include:

## Comet Melon

A strange explosive fruit weapon.

Select a board node.

Damage based on shortest graph distance:

```text
target node: 15 damage
distance 1: 10 damage
distance 2: 5 damage
farther: 0
```

May hit multiple opponents.

## Scatterblaster

Shotgun-style weapon.

Damage depends on:

- aim
- angle
- distance

Suggested damage:

```text
close + centered: 20
close partial: 15
medium: 10
long: 5
miss: 0
```

Mobile controls:

```text
drag to aim
release to fire
```

## Lucky Six

High-risk revolver-style weapon.

Requires accurate aim.

```text
perfect hit: 20 damage
miss: 0
```

## Mega Medkit

Restore:

```text
+20 HP
```

Maximum remains 40.

## Turbo Boots

Use before rolling.

Generates an additional server-side roll:

```text
0–5
```

Final movement:

```text
normal 0–10 roll
+
Turbo Boots 0–5 roll
```

## Duel Saber

Challenge another player to a 1v1 minigame.

Allowed wagers:

- 5 coins
- 10 coins
- 20 coins
- custom coin amount
- 1 Golden Pluto

For coin wagers, both players must be able to afford the wager.

For Golden Pluto wagers, both players must own one.

Winner takes the duel pot.

---

# 21. Additional Future Standard Items

Architecture should support:

## Shield Bubble

Blocks the next damage source.

## Cleanse Spray

Removes supported negative status effects.

## Coin Magnet

Steals a small amount of coins from an opponent.

Suggested default:

```text
5 coins
```

## Swap Beacon

Swap board locations with a selected player.

## Loaded Dice

Choose a limited roll instead of rolling randomly.

Suggested selectable range:

```text
1–6
```

## Triple Step

Move exactly:

```text
3 spaces
```

## Portal Pair

Place temporary linked portals on valid nodes.

This may be implemented later if complexity remains manageable.

---

# 22. Rare Items

## Pocket Duel

Choose any opponent.

Play a random duel minigame.

Winner receives:

```text
+1 newly created Golden Pluto
```

The loser does not lose one.

## Fallout Core

Choose one board node.

Affected area:

```text
target node
+
directly connected neighboring nodes
```

Players currently standing inside the blast are immediately KO'd.

Affected nodes remain irradiated for:

```text
3 full rounds
```

A player landing on irradiated terrain receives Radiation.

Radiation:

```text
cannot use items
-10 HP per round
duration: 3 rounds
```

Players hit by the original blast respawn and also receive Radiation.

Radiation must be clearly visible on the board.

## Wild Totem

Summons a random animal.

Initial pool:

### Cheetah

```text
movement: 5 nodes per animal phase
damage: 10
duration: 15 rounds
```

### Crocodile

```text
movement: 2 nodes per animal phase
damage: 20
duration: 15 rounds
```

Animals do not damage their owner.

Potential future animals:

- Eagle
- Monkey
- Buffalo
- Giant Crab

---

# 23. Animal Phase

After all four board turns:

```text
ANIMAL PHASE
```

Each active summoned animal:

- moves
- resolves attacks
- decreases remaining lifetime where appropriate

Then begin the minigame phase.

---

# 24. Random Events

The event system must be registry-based.

Potential events include:

## Pirate Raid

All players pay 5 coins into the Central Bank.

## Bridge Collapse

Temporarily disable a valid bridge.

Never permanently isolate part of the map.

## Golden Rain

Coin fields give:

```text
+6
```

for one round.

## Tax Refund

Lowest-coin player receives up to 10 coins from the Central Bank.

## Pluto Storm

Relocate active Golden Plutos.

## Inventory Shuffle

Players exchange random items.

## Position Swap

Two random players swap board positions.

## Market Crash

All players lose:

```text
25% of coins
```

Lost coins go to the Central Bank.

## Bank Heist

Active player gets a short challenge to win part of the bank.

## Tropical Hurricane

Tropical-map event that changes player locations or routes.

## Avalanche

Mountain-map event that temporarily closes a route.

## Animal Stampede

Neutral animals move across part of the map and may damage players.

---

# 25. Status Effects

Use a generic status-effect system.

Potential effects:

- radiation
- poison
- shield
- curse
- movement slow
- item lock

Example future effects:

Poison:

```text
-5 HP at turn start for 3 turns
```

Curse:

```text
next dice roll maximum = 3
```

Slow:

```text
-2 movement from next roll
```

Shield:

```text
ignore next damage source
```

Status effects must be clearly visible in the HUD.

---

# 26. Main Minigame Phase

After all board turns and the Animal Phase:

- select a random main minigame
- avoid repeating the immediately previous minigame where possible

Main minigames should:

- support 4 players
- support bots
- last around 2–3 minutes maximum
- be understandable within seconds
- work well on phones
- avoid complicated keyboard-only input

Preferred controls:

- virtual joystick
- one action button
- tap
- drag
- swipe
- hold

---

# 27. Main Minigame Rewards

Rewards:

```text
1st: +10 coins
2nd: +5 coins
3rd: +3 coins
4th: +0 coins
```

The minigame winner becomes the first player in the following board round.

---

# 28. Main Minigame Ideas

## Crown Thief

One player holds a crown.

Other players attempt to steal it.

Score is based on total time holding the crown.

## Floor Collapse

Arena tiles warn before disappearing.

Suggested states:

```text
normal
yellow
orange
red
gone
```

## Slippery Summit

Race uphill while avoiding:

- snowballs
- rocks
- sliding hazards

## Critter Grab

Capture creatures and bring them to your area.

Normal creature:

```text
+1 point
```

Golden creature:

```text
+3 points
```

## Target Panic

Tap or shoot rapidly appearing targets.

Some add points.

Some subtract points.

## Wall Squeeze

Walls approach with safe openings.

Players must move into the opening before impact.

## Fuse Frenzy

Pass unstable explosive objects to other players before they explode.

## Rocket Rodeo

Steer uncontrollable rockets through checkpoints.

## Falling Junk

Collect useful falling objects while avoiding hazards.

## Crab Chaos

Collect shells while avoiding attacks from a giant crab.

Initial recommended development pool:

1. Crown Thief
2. Floor Collapse
3. Slippery Summit
4. Critter Grab
5. Target Panic
6. Wall Squeeze

Implement incrementally rather than building all of them simultaneously.

---

# 29. Duel Minigames

Duel minigames should generally last:

```text
30–60 seconds
```

Ideas:

## Paddle Panic

Paddle-and-ball duel.

First to three points wins.

## Street Cross

Players race across dangerous traffic lanes.

## Blade Bounce

Players reflect an accelerating energy projectile.

## Tower Climb

Short identical climbing course.

## Quick Draw

React only to the true signal among fake signals.

---

# 30. Minigame Architecture

Minigames must be isolated modules.

Example:

```ts
interface MinigameDefinition {
  id: string;
  name: string;
  description: string;

  durationSeconds: number;

  gameType: "main" | "duel";

  component: React.ComponentType<MinigameProps>;
}
```

Each minigame returns standardized results.

Example:

```ts
interface MinigameResult {
  playerId: string;
  position: 1 | 2 | 3 | 4;
  score?: number;
}
```

The board game engine should not know how individual minigames work.

---

# 31. Bot AI

Bots participate in:

- board movement
- route choices
- items
- Golden Pluto purchases
- properties
- minigames
- duels

Board decisions may initially use weighted scoring.

Example:

```text
reachable Golden Pluto: +100
can afford Pluto: +50
rare item field: +30
healing when low HP: +30
item field: +15
coin field: +10
danger field: -20
enemy Level-3 property: -35
enemy Level-4 property: -60
```

Bot difficulty:

## Easy

- high randomness
- occasional poor choices

## Medium

- reasonable strategy

## Hard

Considers:

- HP
- coins
- items
- Plutos
- properties
- routes
- opponent positions

Bots must not use hidden information unavailable to humans.

---

# 32. Minigame Bots

Each minigame should implement its own bot controller.

Examples:

Target Panic:

- reaction delay based on difficulty
- occasional missed targets

Race:

- difficulty controls movement accuracy
- difficulty controls reaction delay

Crown Thief:

- chase crown holder
- evade opponents when holding crown

Do not create one monolithic AI for all minigames.

---

# 33. Catch-Up Mechanics

The game should contain natural opportunities for comebacks without guaranteeing them.

Existing comeback systems include:

- Central Bank
- random events
- combat
- rare items
- properties
- duels
- Golden Pluto relocation

Potential subtle balancing:

- some events affect rich players
- low-ranked players can receive slightly improved mystery odds
- some items may target Golden Pluto leaders

Do not artificially force successful players to lose.

---

# 34. Mobile Compatibility

The complete game must support mobile and desktop browsers.

Requirements:

- responsive UI
- large touch targets
- no hover-only critical actions
- virtual joystick where appropriate
- scalable board/minigame rendering
- mobile-safe dialogs
- safe-area support
- readable HUD
- landscape-friendly gameplay

Desktop may additionally support keyboard and mouse controls.

---

# 35. Presentation

The visual direction should be:

- colorful
- playful
- stylized
- humorous
- readable
- original

Avoid realism.

Board presentation should support:

- animated pawns
- dice animations
- camera movement
- highlighted routes
- intersection arrows
- damage feedback
- healing feedback
- ownership markers
- Golden Pluto glow
- radiation effects
- animal movement
- event notifications

Keep performance suitable for mobile devices.

---

# 36. HUD

Display:

- player portraits
- HP
- coins
- Golden Plutos
- inventory count
- status effects
- current player
- current round
- current phase
- Central Bank amount
- active victory condition

Before rolling:

```text
[ ITEMS ] [ ROLL ]
```

After rolling:

```text
ITEMS DISABLED
MOVES REMAINING: X
```

---

# 37. Core Match Phases

Use explicit phases such as:

```ts
type GamePhase =
  | "LOBBY"
  | "START_ROLL"
  | "TURN_START"
  | "ITEM_PHASE"
  | "DICE_ROLL"
  | "MOVEMENT"
  | "PATH_SELECTION"
  | "RESOLVE_TILE"
  | "TURN_END"
  | "ANIMAL_PHASE"
  | "MINIGAME_INTRO"
  | "MINIGAME"
  | "MINIGAME_RESULTS"
  | "ROUND_END"
  | "GAME_OVER";
```

Only legal actions may occur during each phase.

---

# 38. Server Authority

The multiplayer server is authoritative.

Clients request actions.

The server validates and resolves them.

Server-controlled gameplay includes:

- dice
- movement
- coins
- HP
- damage
- items
- Golden Plutos
- properties
- Central Bank
- events
- animals
- random outcomes
- minigame rewards
- win-condition checks

Never trust client-provided values for important gameplay state.

---

# 39. Reconnect Behavior

Support temporary player disconnects.

When a human disconnects:

- preserve their slot temporarily
- allow reconnect through a session/player token
- optionally replace with a bot after timeout
- restore authoritative match state when they return

Temporary mobile network issues should not automatically destroy a match.

---

# 40. Development Milestones

## Milestone 1

Lobby foundation:

- home
- create lobby
- public/private lobby
- lobby codes
- lobby browser
- 4 player slots
- bots
- ready state
- match settings

## Milestone 2

Core Tropical board:

- 60-node board graph
- board rendering
- four pawns
- starting dice order
- turn system
- dice 0–10
- movement
- intersections
- path selection
- basic fields

## Milestone 3

Economy:

- coins
- Central Bank
- Golden Plutos
- Golden Pluto spawning
- purchases
- victory condition

## Milestone 4

HP and inventory:

- HP
- damage
- KO/respawn
- inventory
- item timing
- Mega Medkit
- Turbo Boots
- Comet Melon

## Milestone 5

Properties:

- ownership
- upgrades
- tolls
- Level-4 behavior
- visual ownership

## Milestone 6

First complete minigame:

- board-to-minigame transition
- one 4-player minigame
- bot support
- ranking
- 10/5/3/0 rewards
- next board round

## Milestone 7

Advanced items and duels:

- Scatterblaster
- Lucky Six
- Duel Saber
- duel flow
- initial duel minigames

## Milestone 8

Rare items:

- Pocket Duel
- Fallout Core
- Radiation
- Wild Totem
- Cheetah
- Crocodile
- Animal Phase

## Milestone 9

Mountain map:

- complete second map
- 60 nodes
- map-specific presentation
- one active Golden Pluto
- map-specific event hooks

## Milestone 10

Polish:

- reconnects
- improved bots
- audio
- effects
- responsive/mobile refinement
- performance
- more testing
- loading/error states

---

# 41. Development Principles

- Use TypeScript strict mode.
- Keep game rules outside React components.
- Keep important random outcomes server-controlled.
- Prefer registries and configurable definitions.
- Avoid duplicated systems.
- Do not use copyrighted assets from existing games.
- Keep content extensible.
- Keep the project runnable after each milestone.
- Prefer a complete vertical slice over many unfinished features.
- Add tests for important engine rules.
- Do not start future milestones unless specifically requested.
