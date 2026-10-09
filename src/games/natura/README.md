# Natura: nine 3D habitats

The shared **Natura Field Station** menu, quiz, introductions, HUD and results
use `studies.ts`, `fieldStation.css`, `FieldQuiz` and the accessible native
`FieldDialog`. `NaturaGame.tsx` runs every mode in a WebGL scene using `scene3d.ts`. The canvas
fills the viewport below the shared Pluto header. The scene uses mesh animals,
lighting, depth, perspective cameras and shadows. The ant, meadow, archerfish and
bolas games retain constrained movement planes; the seabed modes use a raised
camera, and the spider and whale modes allow movement through the world.
`input.ts` turns keyboard/touch state into two player intents. `world.ts` owns the
renderer-independent simulation adapters, including the remaining meadow key bridge.

The Field Station also includes guided practice, a persistent local field journal,
three-habitat expeditions and date-seeded daily trails. Optional single-player
Wild challenges add route and survival decisions; shared animation, particles,
HUD meters and synthesized audio improve feedback. See
[field journeys](../../../docs/natura/journey.md) for rules and validation.

## Modes

- **Wings & Whiskers:** seven grass shelters and a two-exit tunnel. Each dive
  consumes one of five charges. A missed dive automatically climbs back to hunting
  height. A visible reload ring fills during two seconds of rest at the perch.
  Dives have a short warning followed by a faster strike. Concealed voles have no
  mesh or shadow; the AI uses a last-seen position. The giant-vole strike has
  anticipation, an upward hop and an open mouth.
- **Surface & Sprint:** three discrete lanes. Tap A/D or the arrows to switch;
  release before another switch. Gulls and tuna approach from ahead in 3D and
  grow in perspective. Each wave blocks at most two lanes. Air/water phases last
  nine seconds, with a 54-second run and three hearts. Surface crossings interpolate
  body depth, pitch, camera and habitat color with bounded splash effects. Later
  waves warn before changing lanes, lock before impact, and retain an open lane.
- **Snap Launch:** sixteen selectable courses, trajectory guides, checkpoint ledges,
  three hearts, and an AI rival using the same launch physics. The arc cycles
  automatically: A/D choose direction and Snap locks the current angle. The final
  four courses have narrower ledges; the final two require greater precision.
  Six new courses add moving shelves, wind, timed gates and crumbling bark.
- **Hide in Plain Sight:** 24 irregular seabed patches, six skin patterns plus
  raised/smooth texture, visible patrol search areas and shared shrimp sites.
  Predators follow readable forward, pause and reverse cycles.
- **Midnight Lasso:** aim and swing a sticky silk tip; scent attracts moths.
- **Carry Your Cover:** transport a shell, assemble shelter and dodge warned patrols.
  Shared food can only be collected outside cover. A capture removes one heart,
  visibly drags the octopus away, then respawns surviving players with temporary
  protection. Three warned routes make raids cover more of the map.
- **Spit & Sprint:** water jets dislodge insects; both fish race to catch the food.
  Pointer aiming intersects the rendered 3D play plane.
- **Silk & Summit:** eight 24-platform courses spanning over 120 world units.
  WASD moves, Space jumps and Shift spends a silk rescue. Every fourth platform
  saves progress and refills two rescues. Falling without silk costs a heart.
  Five new courses add cavern gates, waterfall momentum, moving shelves, ridge
  wind and wilting flowers; the storm course combines learned mechanics.
- **Into the Abyss:** play a sperm whale (*Physeter macrocephalus*) hunting colossal
  squid (*Mesonychoteuthis hamiltoni*) in the Southern Ocean. WASD swims, Q/E
  rises/dives, Space bites and Shift samples prey with an echolocation pulse.
  Acceleration and release braking smooth movement. Echoes briefly report coarse
  bearing, depth and range from the pulse time; they do not track live coordinates.
  Watch breath, surface to refill it, avoid telegraphed tentacle strikes and return
  to the surface after three catches. Solo play uses the ocean as the opponent;
  local play lets two whales race. Gold uses arrows, Page Up/Down, Enter and Right Shift.
  The separate **Whale vs squid** challenge adds a playable squid with burst and
  ink, a sensing whale and distinct hunt/survival objectives. Both roles work in
  solo, online and hotseat play; the original whale hunt remains selectable.

Every mode supports local play, touch buttons, pause on Escape/window blur, and
optional rules and source-linked **Did you know?** panels. Opening a panel pauses
the simulation. Courses can be selected before a run; a completed course offers
**Next course** as well as replay and match results.

The UI offers **Single-player**, **Online**, **Hotseat** (alternating) and
**Local two players** (simultaneous). Online uses your existing Supabase Realtime
connection; the room creator’s browser runs `NaturaRooms` in `games/natura/rooms.ts`.
Per-seat snapshots are filtered and encrypted before relay. There is no dedicated
Natura server, new Edge Function, database migration or extra environment variable.
The host holds the full world and must keep their tab active. Guest refreshes
reclaim the same seat; host reload/closure ends the room. Hotseat still uses
matching seeds/roles, a handover screen and role-specific performance comparison.
See [setup and contracts](../../../docs/natura/multiplayer.md) for running,
reconnect, privacy, quotas and verification.
There is currently no gamepad controller.
Medium bot reaction/preparation was reduced across rival modes; Hard difficulty
parameters were preserved. Shared physics and rule fixes apply at all difficulties.

## Quiz and scoring

Games award three match points for a win and zero for a draw. They go directly
to results, with no automatic quiz and no simulated AI quiz points. Every habitat
card has an independent **Quiz** button with six questions. A correct answer is
one quiz point; quiz points never change the match score.

## Biology and abstraction

The whale/squid pairing is supported by [Te Papa](https://collections.tepapa.govt.nz/topic/588)
and the whale’s biology by [NOAA](https://www.fisheries.noaa.gov/species/sperm-whale).
Giant squid (*Architeuthis dux*) and colossal squid are different species. The
combat timings, health, sonar rings and repeated encounters are game inventions.
Jumping-spider silk facts link to the Natural History Museum. Existing modes retain
their sources. Timers, lives, checkpoints and the giant-vole finale are arcade rules.

## Validation

Run `node --test tests/natura-3d.test.mjs tests/natura-field-station.test.mjs tests/natura-expansion.test.mjs tests/natura-online.test.mjs tests/natura-modes.test.mjs tests/wildModes.test.mjs tests/toolAnimals.test.mjs tests/archerfish.test.mjs`.
The tests check recharge, ascent, lane safety, collision resolution, course
reachability, silk rescue, squid attacks, breath, victory, pause and frame-rate
consistency, as well as shared-food fairness, concealed-target AI, capture duration,
timed launch, snapshot sonar and input isolation. See the audit's implementation
ledger for browser checks and limitations. `npm run build` checks the full
application and bundles the production assets. No new packages are required.
