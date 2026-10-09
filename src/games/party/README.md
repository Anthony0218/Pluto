# Pluto Party

The multiplayer party game at `/games/pluto-party`. The Node server owns the rules, randomness, scores and rewards; clients send validated inputs.

## Run locally

Use Node 24+ with native TypeScript support and installed dependencies. In separate terminals:

```sh
npm run party:server
VITE_PARTY_SERVER_URL= npm run dev
```

Open `http://localhost:5173/games/pluto-party`. An empty `VITE_PARTY_SERVER_URL` uses the Vite `/party-socket` proxy to the local authority at port 8787. A nonempty value (including a value in `.env`) connects to that server instead. Each browser tab has its own session and can join a room by code.

For phone testing on the same LAN, add `-- --host 0.0.0.0` to the frontend command and open the computer’s LAN address on the phone. The backend stays behind the Vite proxy.

Production needs a long-running Node service with WebSocket upgrades at `/party-socket`. Configure `PARTY_PORT`, `PARTY_HOST`, and `PARTY_ORIGINS` as needed. For a separately hosted authority, set `VITE_PARTY_SERVER_URL` to its complete `wss://…/party-socket` URL at frontend build time. Matches are in memory and are lost on restart; separate authorities need sticky routing and shared discovery.

## Lobby and match rules

- Five bot levels: **Beginner, Easy, Normal, Hard, Extreme**. Hard retains the original default challenge. Extreme has exceptional recall, precise timing and aim, faster reactions and strategic route/item decisions. Hosts can choose a default for new bots and change each existing bot separately.
- **Board Party** uses Tropical Islands (96 spaces, two active Plutos) or Mountain (92 spaces, one active Pluto). Choose 8, 12 or 16 rounds for a predictable finish, ranked by Golden Plutos or coins with the other currency breaking ties. The default is 12 rounds. The optional race mode still ends immediately at its selected target.
- **Minigames only / Minigame Festival** skips starting dice, board turns, items and animals. Choose 3, 5, 8 or 12 minigames. Individual game scores determine placements worth **6 / 4 / 2 / 0 festival points**; equal scores split the points for occupied places (two tied first receive 5 each). Winning partners earn **5 each**, opponents **1 each**, with **3 each for a team draw**. Every round distributes 12 points, keeping solo and team rounds equally weighted regardless of raw score scales. Rewards are festival points, not coins. Highest festival points wins; equal final totals share victory.
- The **Minigames** box on the home screen and in the lobby lists all registered games with searchable names/descriptions, solo/team/duel filters (including 1v3), duration, expandable rules and controls. Hosts can select the main-game lineup; guests can browse it. Duels are labeled as board-only and the legacy Target Panic fixture is identified as unavailable in new matches. Festival totals remain visible during play and in round results.
- Select any main-minigame lineup in either mode. An empty selection means all 21 games. A shuffled bag plays each selected game before repeating it.
- Before every minigame and duel, each human participant must press **Space** or **I’m ready**. Bots are ready automatically. The shared three-second countdown starts only once everyone is ready. Disconnect takeover also releases a held ready check.
- While unready, a separate local practice simulation runs against Easy bots. Practice has no effect on the match, wallets or rewards. During practice Space marks readiness; use the on-screen jump, dash and firing controls to practise those actions.

## Board decisions and balancing

Click a highlighted branch or its directional arrow on the map. Each arrow previews possible landing consequences after the remaining steps: rewards, healing, hazards, tolls, Plutos and event effects. Hovering highlights reachable landings. A compact expandable path list remains available for keyboard and fallback navigation.

Dice animate through random faces, then use distinct small / medium / large particle bursts for rolls 1–3, 4–7 and 8–10. Rolling **zero** lets the active player choose **5 HP** (capped at maximum) or **2 coins**, without triggering the space again.

Each map contains **three connected groups of three cleansing spaces**. Exact landing neutralises all negative status effects and heals 10 HP instead of resolving the underlying field. Cyan crosses and rings make these spaces readable. Plutos cannot spawn there. Fallout Core still creates radiation zones, but cleansing offers a recovery route.

Each tropical region has its own event: Sunspill Bay becomes a +5 HP sanctuary; Coconut Club discounts normal shop items by 2 coins for players located there (mystery boxes stay 10); Whisper Ruins reveals three one-use item caches replacing their base field; Pirate Picnic marks three one-time +5 coin treasures; Jade Jungle bounty adds +2 coins on marked landings; Ember Forecast marks an upcoming eruption for 10 HP at the end of the next round. Cleansing spaces are excluded from landing-reward and damage markers. Mountain retains its cable car, mine cart, slides, tunnels and temporary avalanche / mine / cable closures. Animated map rings, floating event labels and closure markers show affected locations and timing.

The board camera follows the active pawn on desktop and phones, moving closer for a branch choice. **See board** hides turn controls while keeping the current local framing; **See whole board** fits the entire map. Both views have a **Back** button that restores the pawn camera and turn controls. Roll, items, viewing and zoom controls sit together in a centered panel inside the board. You can drag to explore and inspect spaces in either view. On phones, inactive opponent cards compact; the active player and local player remain readable.

Fields use raised, consistent rims with large symbols and distinct 3D silhouettes: coin stacks, supply crates, heart crystals, cracked warning tiles, event signs, vaults, cleansing springs and recessed portals. Regional bases use wood, carved stone or faceted ice; functional colors and symbols stay consistent. Golden Plutos are floating planets with orbit rings. Ordinary fields stay still; rare fields and active events have restrained motion. On resolved landings, coins travel to/from the player's coin counter, crate lids and vault doors open, events reveal their result, healing expands a green ring, cleansing dissolves a removed status icon, hazards recoil the pawn, and warps fade the pawn out and back in at the destination. These are client-only effects derived from authoritative snapshots; movement, off-turn shopping and reconnects do not replay rewards. Both system and in-game reduced-motion settings are respected.

## Items and shopping

The **Shop** stays available while waiting, including during board-mode minigames. Each player can buy **one item per board round**, shared between the normal shop and mystery box. Purchases occupy one of three inventory slots and become usable from the **next round**. Item use still requires that player’s pre-roll item phase; radiation still prevents use.

| Normal shop item | Coins |
| --- | ---: |
| Mega Medkit | 6 |
| Turbo Boots | 8 |
| Comet Melon | 8 |
| Scatterblaster | 12 |
| Lucky Six | 14 |
| Duel Saber | 12 |

A **10-coin Mystery Box** can contain any of the nine registered items with equal probability, including Pocket Duel, Fallout Core and Wild Totem. It consumes the same round purchase allowance as a normal purchase. Full inventories and unaffordable purchases are rejected before charging coins.

## Minigames

| Game | Duration | Mechanics and controls |
| --- | --- | --- |
| One Wrong Step | Up to 72 s | Three short survival heats with private arrow sequences, faster reveals and everyone returning each heat. Eliminated players get a harmless recall rehearsal while waiting. Arrow keys / touch arrows. |
| Pickup Shootout | 75 s | Compact city or three-floor arcade. Eliminations score 3; hold a floor beacon for 3 seconds to score 1. Headshots deal 1.5× damage. WASD, mouse, Fire, E/Swap; mobile movement, look, Fire and Swap. |
| Echo Wall | Up to 60 s | Five independent recall rounds, so a mistake does not eliminate the rest of the game. Tiles have distinct symbols and tones. Keys 1–9 / click / touch. |
| Triple Trail | Up to 66 s | Three 20-second races with short breaks, checkpoints, forgiving jump buffering / coyote time, ice cracks, swinging jungle platforms and sky wind. A/D or arrows, Space/W / touch run and jump. |
| Pluto Pulse | 60 s | One falling-letter lane at 100 BPM; J/K/L or large touch keys. Server-scored accuracy %, comic judgements, current/best combo and combo sound feedback. |
| Circle Quickshot | 60 s | Random circles, squares, diamonds and triangles at varied speeds. Smaller ×3 / ×5 targets are less frequent. Exact shape overlap scores; Space / click / large Fire button. |
| Hell Knockout | Up to 75 s | Punch / jump / aim over lava. Islands collapse with five-second warnings. Guard reduces damage and knockback but slows movement and prevents punching. WASD/arrows, mouse, F/click, Space, G / touch controls. |
| Tide Treasure | 60 s | Carry gems back to the boat, balance high-value outer gems against a rising 15-second tide, lose carried gems if caught. WASD/arrows / touch pad. |
| Comet Courier | 60 s | Carry parcels to matching symbol pads; a two-second-cooldown dash can knock a rival’s parcel loose. Golden parcels score 3. WASD/arrows, Space / touch pad and Dash. |
| Rope Rescue | 60 s | Random 2v2 teams: operator aligns the lever, runner crosses bridges and rescues explorers. Unsafe jumps reset to a checkpoint. Roles swap at 30 s. Operator W/S, runner A/D and Space / touch controls. |
| Paddle Doubles | Up to 60 s | Random 2v2 teams cover upper/lower paddle lanes. First to 7 or highest score at time; every third serve is a two-point golden comet. W/S or up/down / touch buttons. |
| Disco Freeze | 60 s | Dance for 1 point per active second, freeze for a +3 clean-stop bonus, ignore fake scratches. Moving after the 400 ms reaction window costs 2 once per freeze. WASD/arrows / touch pad. Music pauses during actual freezes. |
| Pluto Heist | 65 s | Space-vault moon crystals worth 1/3/5, cargo limit 8, weight slows movement, own shuttle banks cargo. Rotating cross lasers have a 1.5 s amber warning each 8 s cycle. Caught players lose cargo but retain banked score. WASD/arrows, Space for a 1.2 s cloak with 8 s cooldown / touch pad and Cloak. |
| Kitchen Chaos | 65 s | Random 2v2 kitchens: supply, hold to chop 1.2 s, cook 2 s, serve for 1 shared team point. Two shared ovens burn dishes 5.5 s after cooking. Either partner can retrieve; full-hand swaps keep the kitchen moving. WASD/arrows, Space / touch pad and Interact. |
| Rocket Rumble | 60 s | Momentum-driven rockets collect 1/3-point fuel stars, steer around asteroids and boost-bump rivals to steal 1. Asteroids cost 1 and grant a brief shield. A/D steer, W thrust, S brake, Space for a 0.7 s boost with 4 s cooldown / touch controls. |
| Orbital Rally | Up to 75 s | Original three-lap magnetic hover-kart race. Inside lane is shorter but hazardous; charge cells power 1 s boosts, once per cell per lap, maximum 3 stored. Fastest finish wins; progress ranks unfinished karts. A/D change lane, W throttle, S brake, Space boost / touch controls. |
| Island Impostor | Up to 60 s | Eight 2.4 s observation / 0.6 s blackout / 3.2 s answer / 1 s reveal rounds. One shape or color changes. One guess, +2 correct, no speed bonus. Original board, answer and other guesses remain private until reveal. Keys 1–6 / tap souvenirs. |
| Pluto Penalties | Up to 75 s | Twelve directed pairings: everyone shoots once against each rival and keeps once against each, exactly 3/3 opportunities. Goal +1, saved on-target shot +1 to keeper, misses +0. Hidden lane choices, server-timed power window, no free timeout saves. Keys 1/2/3 or lane buttons, Space/Kick to shoot. |

### Arcade additions

| Game | Duration | Rules and controls |
| --- | --- | --- |
| Ricochet Rivals (duel) | Up to 60 s | Three-hit energy-disc duel with cover, one rebound per disc and dangerous self-rebounds. Move, mouse aim, click/F fire, Space dash; touch movement, aim directions, Fire and Dash. |
| Fuse Faceoff (duel) | Up to 75 s | Pass a comet on contact; random 8–12 s fuses. Separation and a 0.9 s pass lock prevent instant pass-back. First to three explosion wins, up to five rounds. Move with WASD/arrows or touch. |
| Gravity Tug (duel) | Up to 45 s | Pull a drifting Pluto into your side’s goal. Pulling slows you, distance affects beam strength, walls block beams, and momentum persists on release. First to three goals or most goals at time. Move and hold Space/Pull. |
| Minotaur’s Labyrinth (1v3) | Up to 300 s | Seeded 35×35 maze with connected looping corridors. Random Minotaur runs 20% faster and attacks after a 0.35 s wind-up. Runners take two hits; first grants +50% speed, protection and a global location reveal for 3 s. Location pulses start at 150 s remaining every 30 s; 100 s remaining every 20 s; 50 s remaining every 10 s. Each threshold pulses immediately. Any surviving runner wins for the runner team. Move; hunter uses Space/Attack. Walls block nearby sight; private snapshots omit unseen positions, including for spectators. |
| Color Clash | 75 s | Run over a 19×19 grid to own tiles and overwrite rivals. Space/Paint Burst paints a radius-two diamond every 8 s. A strip washes clean every 15 s with a 3 s warning. Most owned tiles wins. |
| Constellation Cascade | 75 s | Original 9-column, 10-row honeycomb moon puzzle. Falling glyph pairs can slide and swap order; four matching connected glyphs clear in any direction, with gravity cascades and chain multipliers. Whole rows never clear. A blocked center spawn costs 5 points and resets the sky after 1.8 s. Same private sequence for everyone; opponents expose scores only. A/D move, W swap, S lower, Space drop; touch buttons. |

In the 1v3 Festival game, the winning side shares the fixed **12-point** round budget: **12 for the Minotaur**, or **4 for each runner**. Eliminated runners share their team’s result. Board mode uses the existing team rewards, equal within each side. The catalog identifies 1v3 separately from 2v2.

The additions use authoritative fixed-step simulations, validated intent-only inputs, all five bot levels and the existing ready/practice flow. Hidden maze targets and future puzzle glyphs stay server-side. The lobby lineup limit follows the registered main pool rather than a fixed count.

Constellation Cascade’s design rationale and the scope of the IP check are in [PUZZLE-DESIGN.md](PUZZLE-DESIGN.md).

Board individual minigames pay 10 / 5 / 3 / 0 coins. Team games pay each winning partner 8 and each opponent 3; a draw pays everyone 5. Partners receive equal results and both winners receive a minigame-win statistic. Duels retain wager escrow and their separate reward rules. Paddle Panic, Street Cross, Ricochet Rivals, Fuse Faceoff and Gravity Tug are duel games; Target Panic remains a legacy practice fixture outside the main pool.

Unified fox, bunny, explorer and ghost portraits match the character roster across lobby, HUD, readiness and new arenas. Minigame descriptions use numbered rule cards and bordered keycaps. Large touch controls remain available in the new games and rhythm game.

## Sound files

Custom audio lives in **`public/sounds/party/`**. Put MP3/WAV/OGG/M4A files there and map event IDs to filenames in `manifest.json`. See that folder’s `README.md` for supported IDs and an example. Files load after a user interaction, follow game volume/mute settings and fall back to synthesized audio if unavailable. Echo Wall has nine cue pitches; Pluto Pulse music uses its authoritative 100 BPM chart grid.

## Networking and architecture

Public/private rooms, host migration, per-seat bot controls, reconnect sessions and private-code discovery remain supported. Disconnected humans keep a seat for 60 seconds before bot takeover and may reclaim it. Empty rooms expire; matches pause without connected humans. Server randomness, input validation, size/rate limits and private minigame answers remain authoritative.

- `types.ts`, `config.ts`, `difficulty.ts`: contracts, tuning and the five difficulty levels.
- `content/`: registered maps, topology, scenery and cleansing locations.
- `engine/`: state transitions, movement, route previews, combat and economy.
- `items/`, `events/`, `properties/`, `animals/`, `status/`, `duels/`: registered rules and rewards.
- `minigames/`: React-free server rules and seeded simulations; `festivalGames/` contains the four new games.
- `minigames/expansionGames/`: seven cosmic arcade additions with server-owned movement, timing, private observations and penalty choices.
- `network/`: validation and the reconnecting client connection.
- `client/audio.ts`: custom sound loading, synthesized fallback and music.
- `src/pages/games/Party/`: React / React Three Fiber views, practice simulation, touch controls and shop.
- `server/party/`: room/session lifecycle and WebSocket authority.

The local visual playground is `/tests/party-minigames-preview.html`. Historical architecture detail remains in `ARCHITECTURE.md` and `PROGRESS.md`; the rules above supersede old milestone durations and victory assumptions.

## Checks

```sh
npm run test:party
npm run check:party
npx eslint src/games/party src/pages/games/Party server/party
npm run build
```

`tests/party-festival-upgrade.test.mjs` covers five difficulty profiles, all-player ready checks, practice isolation boundaries, finite festival flow, zero rewards, off-turn shopping, next-round locks, all mystery outcomes, cleansing topology, regional events, team rewards, seeded new-game simulations, Extreme rhythm performance, random shape geometry and guard / island collapse. Existing Party suites cover board topology, resources, movement and phase security, KO, properties, items, duels, radiation, animals, server reconnection and real WebSocket roundtrips. Older race-specific fixtures explicitly opt into race mode and supply legacy auto-readiness; the new flow tests use the actual ready actions.

`tests/party-cosmic-minigames.test.mjs` runs all seven additions through all five bot levels, validates full festival flow and equal round budgets, and covers freeze grace, cargo/cloak rules, cooperative cooking, rocket collisions, race cells/laps, private observation guesses, equal penalty schedules, hidden choices, goals/saves/misses, replays and timeouts.

`tests/party-arcade-additions.test.mjs` covers all six additions, full bot rounds at every difficulty, connected maze geometry, private snapshots, exact reveal thresholds, first-hit escape/protection, elimination, disc rebounds and dash limits, comet pass locks, gravity beams/goals, territory bursts/washes, matching groups/chains, equal puzzle sequences, overflow recovery and actual board/duel/Festival flows.
