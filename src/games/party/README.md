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
- **Minigame Festival** skips starting dice, board turns, items and animals. Choose 3, 5, 8 or 12 minigames. Individual placements earn 3 / 2 / 1 / 0 festival points; winning partners earn 3 each and opponents earn 1 each, with 2 each for a team draw. Highest festival points wins; earned coins then turn order break ties.
- Select any main-minigame lineup in either mode. An empty selection means all 11 games. A shuffled bag plays each selected game before repeating it.
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

Board individual minigames pay 10 / 5 / 3 / 0 coins. Team games pay each winning partner 8 and each opponent 3; a draw pays everyone 5. Partners receive equal results and both winners receive a minigame-win statistic. Duels retain wager escrow and their separate reward rules. Paddle Panic and Street Cross remain duel games; Target Panic remains a legacy practice fixture outside the main pool.

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
