# Eat It continuation report

Implemented within the existing shared simulation, Three.js renderer and Canvas overlays. Existing uncommitted work was preserved.

1. **City buildings:** a shared 800 × 760 block grid with 180-unit roads, sidewalks, park blocks and central alleys. Building slots form frontage rows with road-facing orientation. The terrain renderer uses the same geometry.
2. **Cars:** seeded vehicles use parallel street/parking slots and road-aligned rotations. Intersections remain clear of buildings and parked vehicles.
3. **Variation:** building selections, available slots, car/food-truck types, normal props, food, powers and rotations remain seeded. Different seeds produce different populations within the same recognizable street plan.
4. **Shrine:** protected quest landmark becomes a 150 × 120 heavy edible structure after quest resolution, using normal mouth fit, claim, fall and reward logic. Small characters cannot fit it.
5. **Golden Scroll safety:** the shrine cannot enter the edible catalog while the scroll remains on the ground or carried. Delivery/removal resolves that dependency before releasing the structure. A full object cap defers release safely.
6. **Plateau cause:** `massToRadius` clamped radius at 240, reached at mass 3,600. Every additional point above that changed mass but not body or mouth dimensions.
7. **Size fix:** removed the upper clamp; radius remains `max(14, 4 × sqrt(mass))`. No gameplay upper radius cap was introduced.
8. **Continued growth:** ordinary and late-game mass increments increase actual size. Tests cover doubled mass from 100 through one billion, 2x rewards, Pluto and growth division.
9. **Consistent dimensions:** renderer, mouth opening and physical interactions retain the common `playerRadius` source. Camera zoom uses a weaker exponent and a floor, so it cannot cancel the size increase.
10. **25% threshold:** penetration is measured along the mouth-to-object direction over the rotated footprint's full projected span, normalized to 0–1. Fit, valid height, ownership and non-outward relative motion are required.
11. **Lean/fall:** the existing frozen world-space torque and pivot drive full-size meshes through a 1.15-second heavy-object fall, gradually accelerating and moving below the lip. No pre-entry suction was added. Existing trunk/canopy choking remains intact.
12. **Shield:** translucent Canvas bubble, glowing rim, highlight, six orbiting hexagons, authoritative contact ripple and final-four-second pulse. Duration remains exactly 30 seconds.
13. **Three black holes:** independent authoritative paths, speeds, pauses and occasional curves; spaced initial positions, staggered first warnings, destination-separation retries, colored telegraphs and minimap paths. Legacy primary-hole snapshots remain readable.
14. **Eruptions:** warning and eruption visuals precede idempotent permanent collapse. Missing support triggers the existing visible fall and lava elimination. Overlapping destruction cannot reset or resurrect a cell.
15. **Pigeon:** Hell flight is five seconds and one-use. Nearby landing avoids eruption danger and prefers ground away from telegraphed paths. The cat retains its distinct two-second ground dash/leap.
16. **Catalog:** 15 added normal props—coffee cup, phone, traffic cone, cardboard box, skateboard, fire hydrant, shopping cart, acorn, pinecone, bird nest, bucket, wooden crate, tent, hay bale and wooden cart—plus the edible shrine. Central metadata includes dimensions, mass, growth, score, rarity, maps, zones, shape icon, physics category and sky-drop eligibility. New procedural models and review thumbnails reuse the model library.
17. **Item Legend:** compact special-item icons with localized hover/focus names; the small-screen row stays above the arena, clear of movement controls and the lower HUD. English, German, Bavarian, Korean, Russian, Spanish and Portuguese are covered.
18. **Spawns:** initial density 540 → 680; cap 570 → 720; attempts 0.22 → 0.15 seconds. Sky drops start at height 280–460 with a 60/32/8 small/medium/large mix. Buildings, structured vehicles and shrine are excluded. Spatial clearance still rejects blocked/player/prop overlaps.
19. **Bots toggle:** defaults ON and persists through the existing settings store. OFF hides count/difficulty and removes AI seats before creating the game, leaving no AI leaderboard, lives or decision loop. Online room fill remains unchanged.
20. **Solo Hell:** normal play lasts the selected timer, then a single player must survive 60 seconds of Hell. Falling is a loss; survival wins. No fake opponent is created. Solo lives, quests, items and animals retain existing behavior.
21. **Performance:** hard object cap, distant old sky-prop cleanup, invalid/off-map cleanup, sleeping settled bodies, spatial collisions, view culling, shared Hell floor/lava and geometry/materials, cached locked path buffers, bounded particles and bounded event history. Bot paths are computed once per decision rather than once per direction sample.
22. **Verification:** see the verification section below.
23. **Limitations:** city street topology is fixed while its population varies. Projected-span entry and existing area-based fit are gameplay approximations rather than exact volume physics. Extreme artificial masses can outgrow the finite map; safe respawn can then be unavailable. Destination separation is best-effort when little floor remains. Local browser checks do not replace hosted multiplayer load testing or low-end mobile-device profiling. Remote deployment was not performed.

## Verification

- Added 24 focused regression tests; all passed in the initial focused run.
- Updated compatibility checks for the removed cap, longer successful heavy-object falls and five-second pigeon flight. Preserved existing choking timing.
- Browser verified structured City, visible radius increase from 253.0 at Growth 4,000 to 357.8 at Growth 8,000, shield bubble/ripple, three colored straight/curved paths, permanent eruption holes, shrine lean/fall, persisted Bots OFF, and one-player gameplay.
- Verified the real HUD at 390 × 844: one leaderboard entry, three lives, hidden bot difficulty/count, and compact legend clear of controls.
- `npm run test:eat-it`: **200 passed, 0 failed**.
- `node --test tests/*.test.mjs`: **377 passed, 0 failed**.
- `npx tsc -b`: passed; also included in the successful production build.
- ESLint across Eat It simulation, React pages and changed test files: passed with no findings.
- `npm run build`: passed. Vite retains its existing warning about the main application bundle exceeding 500 kB; Eat It's own lazy chunk is approximately 152 kB (51 kB gzip).
- `git diff --check`: passed.
- Browser additionally verified Nature's added shapes and density. Temporary responsive viewport override was reset after the mobile check.

## Deployment

The local frontend and shared simulation are updated. Deploy the frontend and `eat-it-match` Edge Function together to apply online rule changes. No additional SQL migration is required for these optional serialized fields; existing pending migrations in the working tree remain the user's prior work. Nothing was committed or remotely deployed.
