# Eat It: expanded worlds, choking and NPC quests

## 1. Existing systems preserved

The starting implementation already contained a serializable 30 Hz simulation, area-based mouth fit, directional player bites, supported-edge 3D falling, gravity/bounce/friction, spatial prop collision queries, sleeping bodies, six temporary power-ups, growth soft caps, procedural object models, bots, seeded spawning, a closing boundary, and server-authoritative multiplayer. Rendering was already Three.js WebGL with a Canvas label/minimap overlay, not a purely Canvas game. The existing React HUD updates at 10 Hz. These systems were extended in place.

The worktree also contained unrelated uncommitted chess, dependency and other Eat It work before this task. Those changes were preserved. No dependencies were added by this task.

## 2. Changes and implementation locations

- `src/games/eat-it/config.ts`, `maps.ts`, `spawn.ts`: larger bounds, district distributions, additional tree categories, spawn clearance and object caps.
- `rules.ts`, `engine.ts`, `physics.ts`, `falling.ts`: canopy checks, choking, finite-mass buildings, oversized collision resistance and shared dimensions.
- `quests.ts`, `types.ts`: authoritative NPC state machines, item ownership, hand geometry, feeding, attacks and cleanup.
- `questVisuals.ts`, `renderer.ts`, `terrain.ts`, `audio.ts`: procedural NPCs/landmark/items/arms, changing eyes, animations, effects, camera/minimap bounds and sounds.
- `bots.ts`, `presentation.ts`: footprint-based navigation and presentation-only NPC interpolation.
- `EatItArena.tsx`, `eat-it.css`, `eatItTranslations.json`: contextual quest/status HUD and English/German/Spanish/Portuguese localization.

## 3. Tree choking

Bare `treeTrunk` props use ordinary food fit and rewards. `tree`, `smallTree` and `bush` separate the narrow visible trunk from canopy area. A fitting trunk starts the existing fall. At 38% of the swallow, an oversized canopy triggers a three-second stun. No reward is granted for that tree; it stays in the food array and is ejected onto nearby ground using a deterministic search. A cooldown avoids immediate repeated capture. Movement, new bites, pickup and handover are disabled while choking; attacks and elimination remain possible. Eyes widen, the rim compresses/shakes, cough marks appear and localized text shows the stun.

## 4. Oversized collision

Ordinary objects, including houses, have finite mass and can participate in prop collisions. Small-player contact uses very high effective resistance and a maximum 0.00002 object share of the correction/impulse. Objects remain approximately stationary, while the player is blocked. Growing enough opens the normal swallowing path. Existing no-push handling for edible snacks and Magnet's building exclusion remain intact. The shrine is the sole fixed raised quest structure; water remains terrain.

## 5. Map dimensions and distribution

Both maps changed from 2200×1600 to **3200×2400**, about **2.18× playable area**. The spawn target is 340 props, with a hard cap of 360 and 12 ground power-ups. Four district preferences repeat through twelve sectors, with large-prop clearance around initial players and reserved quest locations. Spawns, NPC bounds, bots, ground, camera and minimap follow the expanded dimensions. Prop models retain fixed world sizes. The boundary begins closing at 120 seconds, finishes at 300, and applies additional proportional damage after full closure to avoid prolonged late-game stalemates.

## 6. Pigeon state machine

City has one seeded pigeon and a Japanese-style shrine with a Golden Scroll. Neutral phases alternate idle, wandering and flying. Flight has height and wing animation and cannot be swallowed. Ground entry checks mouth overlap, NPC fit and line of sight. The proximity quest alert uses hysteresis to avoid flickering at its boundary.

## 7. Cat state machine

Nature has one seeded cat and a quest-sized Cat Tree. Neutral phases alternate idle, walking and running. The cat never enters flying state and follows ground collision rules. It uses the same ownership, handover, feeding and revenge machinery as the pigeon.

## 8. Hand pickup and ownership

Quest items are separate from food/physics and cannot be eaten or magnetized. A thin articulated arm reaches toward a nearby item. Its shared endpoint must touch the item; body overlap alone cannot collect it. One authoritative owner ID prevents duplicate claims. Carried items remain visibly outside the body. Handover requires the hand near a neutral NPC and records one completion. A carrier's elimination/disconnection returns the item to its reserved original location. Eating the NPC intentionally retires its quest item because the hostile instance no longer accepts handovers.

## 9. Friendly rewards

Handover starts a **30-second** friendly period. Every **four seconds**, the NPC supplies an airborne apple with **3× normal growth**, reserved for its recipient. The apple must complete the existing mouth/fall consumption path. There are seven possible feeding events, subject to the hard object cap. A food arc and heart communicate the source. No size is added every frame. Earned but missed food can still be collected afterward. If its owner is eliminated, it becomes ordinary food.

## 10. Revenge and balance

Eating an NPC plays the normal 0.48-second swallow and grants one small snack reward (8 pigeon / 12 cat base mass). After **two hidden seconds**, the pigeon flies out or cat jumps out during a 0.65-second emergence. The larger red-eyed form pursues for **30 seconds**, attempting attacks at **10, 20 and 30 seconds**. A successful proximity hit removes **12% of current mass**, never below minimum mass 12. Dive/scratch effects and a percentage popup identify the hit. The cat can be evaded around ground obstacles. Leaving transitions to terminal `gone`; target IDs and action deadlines are cleared. Target death, disconnection, player consumption and match completion also clean up active effects.

## 11. Multiplayer synchronization

The existing Edge Function imports the shared engine, so NPC motion, phases, timers, item spawns/ownership, completion, food rewards, damage and cleanup are authoritative automatically. Room version comparisons protect racing requests. Clients submit direction only. Snapshot interpolation changes NPC transforms solely for presentation; it cannot award food or apply an attack. Reconnects resume stored timers and ownership. Tests exercise actual endpoint code with mocked authentication and atomic database storage, including compare-and-swap conflicts. No database schema change is needed.

## 12. Eye scaling

One shared smooth curve applies to humans and bots: starter eyes are roughly 19% of body radius; large eyes approach 11%. Whites, dark pupils and highlights remain visible at all sizes. The mouth remains dominant with its existing 82% radius. Choking temporarily enlarges the eyes further.

## 13. Verification

- Full suite: `node --test tests/*.test.mjs` — **275 passed**.
- Targeted suite: `npm run test:eat-it` — **98 passed**.
- ESLint on all Eat It TypeScript modules, modified arena component and modified/new test files — passed.
- Typecheck: `npx tsc -b --pretty false` — passed.
- Production build: `npm run build` — passed, with Vite's existing large-chunk warning.
- `git diff --check` — passed.

Coverage includes tree entry/stun/ejection/recovery, prolonged oversized contact and growth, both NPC movement patterns, flying immunity, hand-only pickup/carry/handover, feeding duration, delayed revenge and hit cadence, minimum mass, duplicate ownership/rewards/attacks, disconnect cleanup, JSON replica/reconnect agreement, snapshot interpolation, eye proportions and complete 2/4/8-bot matches. Eight-bot stress scenarios exercise carried items, friendly and hostile NPCs with bounded objects and finite numbers.

Visual inspection used the integrated eight-player game plus `/tests/eat-it-quests-preview.html`: expanded City/Nature presentation, carried Golden Scroll and Cat Tree, shrine, friendly pigeon, swallowed and hostile NPCs, and choking/ejection/eye design. Local preview readings were around 25–30 fps in the in-app browser; these are observations, not a hardware-independent performance guarantee. Short emergence and hit timing are covered by deterministic tests; frame-by-frame animation review is still possible using the fixture.

## 14. Remaining limitations and rollout

- Deploy the updated `eat-it-match` Edge Function alongside the frontend before testing hosted multiplayer. Nothing was deployed remotely. Existing in-progress snapshots without encounter state continue safely and obtain NPCs in a new match.
- Hosted multi-browser/eight-human latency, database payload bandwidth, mobile GPU performance and long-session live service load were not tested. The existing request-driven, full-snapshot authority architecture remains; more props increase snapshot size.
- Collisions and tree falling use the existing simplified footprint/supported-edge solver. They are not a general-purpose rigid-body simulation.
- Each match has one NPC quest for its map. Helping or devouring that NPC resolves that instance; no repeatable quest farming.
- Bots can participate through the same interaction rules but do not have a dedicated long-range quest-planning strategy.
- The development visual fixture is outside the production entry points. No new downloaded models, textures or art assets are used.
