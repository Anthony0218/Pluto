# Natura: nine 3D habitats

`NaturaGame.tsx` runs every mode in a WebGL scene using `scene3d.ts`. The canvas
fills the viewport below the shared Pluto header. The scene uses mesh animals,
lighting, depth, perspective cameras and shadows. The ant, meadow, archerfish and
bolas games retain constrained movement planes; the seabed modes use a raised
camera, and the new spider and whale modes allow movement through the world.

## Modes

- **Wings & Whiskers:** seven grass shelters and a two-exit tunnel. Each dive
  consumes one of five charges. A missed dive automatically climbs back to hunting
  height. Rest still at the perch for two seconds to refill. The AI also recharges.
- **Surface & Sprint:** three discrete lanes. Tap A/D or the arrows to switch;
  release before another switch. Gulls and tuna approach from ahead in 3D and
  grow in perspective. Each wave blocks at most two lanes. Air/water phases last
  nine seconds, with a 54-second run and three hearts.
- **Snap Launch:** ten selectable courses, trajectory guides, checkpoint ledges,
  three hearts, and an AI rival using the same launch physics.
- **Hide in Plain Sight:** 24 irregular seabed patches, six skin patterns plus
  raised/smooth texture, visible patrol search areas and personal shrimp routes.
- **Midnight Lasso:** aim and swing a sticky silk tip; scent attracts moths.
- **Carry Your Cover:** transport a shell, assemble shelter and dodge warned patrols.
- **Spit & Sprint:** water jets dislodge insects; both fish race to catch the food.
  Pointer aiming intersects the rendered 3D play plane.
- **Silk & Summit:** three 24-platform courses spanning over 120 world units.
  WASD moves, Space jumps and Shift spends a silk rescue. Every fourth platform
  saves progress and refills two rescues. Falling without silk costs a heart.
- **Into the Abyss:** play a sperm whale (*Physeter macrocephalus*) hunting colossal
  squid (*Mesonychoteuthis hamiltoni*) in the Southern Ocean. WASD swims, Q/E
  rises/dives, Space bites and Shift reveals prey with an echolocation pulse.
  Watch breath, surface to refill it, avoid telegraphed tentacle strikes and return
  to the surface after three catches. Solo play uses the ocean as the opponent;
  local play lets two whales race. Gold uses arrows, Page Up/Down, Enter and Right Shift.

Every mode supports local play, touch buttons, pause on Escape/window blur, and
optional rules and source-linked **Did you know?** panels. Opening a panel pauses
the simulation. Courses can be selected before a run; a completed course offers
**Next course** as well as replay and match results.

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

Run `node --test tests/natura-3d.test.mjs tests/natura-modes.test.mjs tests/wildModes.test.mjs tests/toolAnimals.test.mjs tests/archerfish.test.mjs`.
The tests check recharge, ascent, lane safety, collision resolution, course
reachability, silk rescue, squid attacks, breath, victory, pause and frame-rate
consistency, as well as the existing simulations. `npm run build` checks the full
application and bundles the production assets. No new packages are required.
