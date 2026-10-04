# Natura assessment and implementation plan

Inspection: 4 October 2026. This describes the starting code; the implementation ledger at the end records changes separately. Confirmed means directly established from active source or simulation tests. Suspected issues need device/play testing. Design concerns are not bugs.

## A. Overall assessment

Natura has nine biologically inspired games, source-linked facts and six questions per habitat. The strongest product feature is that the animal's behaviour becomes a playable decision: intercept falling prey, carry shelter, match terrain, or return to the surface to breathe. The existing unified 3D runner is valuable. Presentation and player-mode terminology lag behind it. Several requested features already exist (seven vole shelters, automatic kestrel ascent, ten ant courses, spider checkpoints, shared archerfish catches), so replacing them would waste working code.

Baseline: 69/69 existing Natura simulation tests pass. Tests cover simulation invariants, not browser layout, hidden-information rendering, real mobile performance, or human difficulty.

## B. Current architecture

- Route: `src/main.tsx` mounts `pages/games/natura/naturaMenu.tsx` at `/games/natura`.
- Menu owns mode, difficulty, selected habitat, round, match score and optional quiz. A lazy import loads `components/natura/NaturaGame.tsx`. Match wins award three points; quiz points are separate.
- `NaturaGame.makeWorld`, `step`, `result`, `stats` adapt six simulation families. `GameRun` owns keyboard/touch state, animation loop, pause, panels, level selection, restart and results. Restart remounts a fresh run. The simulation is mutable in a ref; a structured clone updates React approximately eleven times per second.
- Active renderer: `games/natura/scene3d.ts` (`NaturaScene`). Three.js meshes, shared geometries/materials, perspective cameras, shadows and cached labels. `dispose` releases GPU resources and observers.
- Engines: `naturafunctions.ts` (meadow), `archerfish.ts`, `toolAnimals.ts` (bolas/coconut), `wildModes.ts` (ant/cuttlefish), `laneOcean.ts`, `expeditions.ts` (spider/whale).
- Other `FlyingFishGame`, `WildModesGame`, `ToolAnimalsGame`, `ArcherfishGame` and canvas drawing files are older presentation paths, not mounted by the Natura route. Their duplicated controls/styles should not be mistaken for active behaviour.
- No Natura room, transport, authoritative server, network input, reconciliation or reconnect lifecycle exists. `PlayMode` only contains `ai` and `hotseat`. No player creation or gamepad layer exists. Coral/Gold are fixed participants, with kestrel/vole roles alternating by round.
- Most engines use bounded 120 Hz substeps. Meadow is an exception. Bot intent is abstract in five families; meadow still reads key codes. Inputs are otherwise x/y/action/secondary, with whale depth extensions.

## C. Scientific visual direction

**Natura Field Station**: a modern natural-history collection that invites play. Warm paper, deep forest ink, moss, rust and ocean accents; large editorial titles; readable system UI; monospace only for short record IDs and metadata. Existing system fonts avoid downloads and missing-font layout shifts.

A single token sheet will define colors, type, spacing, focus, touch targets, panels, buttons, feedback and motion. Exhibit cards include one behaviour label, habitat and a short gameplay descriptor. They must retain obvious Play and Quiz buttons. Lucide outline icons provide a consistent family. Scientific metadata is derived from existing scenarios, not invented taxonomy.

Quizzes become field observations: six-step progress, numbered answer cards, explicit correct/incorrect labels, short existing explanations, a cited habitat source, accuracy and review of missed observations. No invented strongest-topic score without tagged question data.

Game introductions and results use the same paper panel and record label. Active HUDs remain compact, translucent and legible. Keep standard words such as hearts, score and pause. No metadata wall over the world. Loading explains preparation without fake progress or filler facts. Transitions are brief and respect reduced motion.

## D. Menu redesign

Replace the current dark grid/header with a field-station entrance, a clear collection heading, habitat exhibit cards and a separate match record. Keep the existing nine scenarios, optional quiz access, selection and three-point scoring. Difficulty displays Easy / Medium / Hard while retaining the internal `normal` identifier. Say explicitly when the environment is the solo opponent. Give local simultaneous play an honest description.

## E. Quiz redesign

Extract the quiz from the menu into a reusable dialog and observation component. Add focus containment/restoration, Escape, progress, text feedback independent of color, per-answer review, accuracy and replay. Preserve existing question explanations and source attribution. Do not add unsourced facts to fill a specimen image area.

## F. Shared game UI

Use the shared study metadata in header, introduction, loading and result panels. Reuse tokens and cooldown visualization rather than styling nine separate overlays. Keep controls at least 44 pixels, support safe-area insets, and make secondary panels pause input. Avoid continuously announcing a changing timer or repeating notices to screen readers.

## G. Biggest cross-game problems

1. Play-mode contract conflates hotseat and local multiplayer; online architecture is absent.
2. Personal food routes remove resource competition in two modes.
3. Whale HUD gives perfect prey coordinates even without sonar.
4. Hidden vole is always drawn outside tunnel/capture; AI also follows its exact coordinates.
5. Medium/Hard spider pacing is effectively identical after the opening jump.
6. Flat touch-button strips are crowded, especially two-player whale/camouflage. Species actions need meaningful labels.
7. Older game components and styles are retained alongside the active runner; global fact styling can leak between presentations.

## H. Bugs and discrepancies

### Confirmed in starting code

- `NaturaScene.meadow`: renders a vole in grass despite active concealment; shadows reveal it too because animal meshes cast shadows.
- `naturafunctions.update`: AI kestrel selects `g.mouse` while hidden or in transit. This grants unavailable information.
- `NaturaGame` whale depth panel: reads exact squid position, depth and range continuously. Sonar cannot serve an information-gathering role.
- `naturafunctions.update`: accepts NaN/negative/large delta time without validation/substeps, unlike other engines.
- `GameRun` uses one scalar pointer-aim target for archerfish P1; shared-screen P2 cannot use equivalent independent direct aiming. This is a control asymmetry, not a network sync bug.
- Quiz dialog declares modal semantics without focus containment, Escape handling or opener restoration.

### Requested mechanics missing (design discrepancies, not crashes)

- `stepCoconut`/`stepCuttle` resolve personal food indexed by collected score.
- `stepCoconut` subtracts health immediately with a flash; no drag, respawn or captive state.
- `stepSnap` requires W/S angle adjustment.
- Ocean switches sky/water immediately and removes waves; no body transition or splash.
- Squid is an owner-tagged stationary NPC, never a human role.

### Suspected; do not claim verified failures

- Shared spider camera loses useful detail when racers are far apart. It averages progress and caps zoom.
- Shadow-heavy scene/object count may tax low-end phones. Cache keys containing changing labels/colors can retain unused meshes for the duration of a run. No frame/memory benchmark has established a leak.
- Very short viewport overlays/control density can occlude the interaction area.
- Browser keyboard rollover may limit simultaneous WASD/arrows/actions. Real-device checks needed.
- Old shell/skin labels may be hard to read at portrait zoom.

## I. Mobile usability

Current pointer capture, pointer cancellation, retained short taps and window-blur pause are good. Problems: 34–39 px buttons at breakpoints, dense horizontal controls, no safe-area insets, eight whale actions per player, and competing UI/world use of screen space. First pass: 44 px targets, wrap without overflow, directional/action grouping, hide redundant keyboard hints for touch, compact HUD, safe areas. Next: analog two-axis stick with independent depth buttons, touch P2 aiming, optional landscape suggestion. Do not force orientation. Test at 390×844 and 844×390; desktop touch emulation is not a substitute for a phone.

## J. Multiplayer / hotseat

All nine active engines accept two local human inputs. This is simultaneous local multiplayer, including two-whale racing. It is not online multiplayer or alternating hotseat.

| Mode | Existing local format | Hotseat recommendation | Hidden information / fairness |
|---|---|---|---|
| Wings & Whiskers | Predator vs prey | Alternating solo challenges with equal roles and seeds | Shared screen must hide the vole from both viewers while concealed; individual prey visibility requires separate views |
| Midnight Lasso | Shared branch, shared moths | Equal-duration runs, same moth schedule | Tie catches already split; alternate first player |
| Carry Your Cover | Two shell carriers | Same patrol/food seed and duration | Use contested food only in simultaneous play; identical solo schedule for comparison |
| Snap Launch | Two ants race | Same course, fewest falls then completion time | Lock/cycle control must be identical for all input sources |
| Hide in Plain Sight | Two camouflage racers | Same terrain/patrol seed | Camouflage is reduced detection, not player invisibility |
| Silk & Summit | Two spiders race | Same course, progress/falls/time | Shared camera must avoid favouring leader |
| Into the Abyss | Two whales race | Equal solo dives | Whale vs squid would need new asymmetric win conditions |
| Spit & Sprint | Shared pond/food | Same prey seed, catches/accuracy | P2 direct aiming currently absent |
| Surface & Sprint | Two fish survive | Same wave schedule, dodges/hearts | Currently uses Math.random; seed before fair alternating runs |

For online play: reuse project transport patterns only after defining server authority, seeded randomness, validated intent, disconnect/forfeit policy and private views. Sending full mutable world state to clients would leak concealed prey. Ship no placeholder “online” button. For alternating hotseat: a handover screen must hide the previous run, with mirrored initial conditions and comparable results. Clarify intended multiplayer target before choosing this architecture.

## K. Bot balancing

Preserve Hard parameters. Medium should think less frequently and have longer intentional recovery between decisions; no random wandering. Archerfish: slower reaction to falling prey and less aggressive dash. Bolas/coconut/cuttlefish: longer think interval. Snap: longer checkpoint preparation. Spider: add a small grounded preparation delay at every landing; opening delay alone does not differentiate difficulty. Meadow: reduce Medium prediction/chase competence but retain readable pursuit. Test pacing and eventual success; “beatable” still needs human playtesting. Solo ocean/whale have no competing bot; don't pretend difficulty changes them.

## L–T. Mode assessments

Each mode below uses the same framework. All active modes have the shared UI/input/local support described above; no online or sequential hotseat is implemented at inspection.

### L. Wings & Whiskers

- **What works:** limited dive charges, perch refill, automatic climb, seven shelters, tunnel, role alternation and fantasy finale.
- **Problems / game design:** unrevealed concealment is essential; shelter should expire rather than invite indefinite camping. Seven spots already exist, so improve flow before adding more.
- **Confirmed bugs:** hidden mesh/shadow and omniscient AI; unguarded delta time. **Suspected:** faster dives could tunnel through prey at low FPS without substeps.
- **UI/UX / scientific integration:** perch progress ring with textual percentage; label finale as fiction; predator–prey observation header.
- **Mobile / solo / multiplayer / hotseat:** clear Dive versus Tunnel/Strike labels; hide concealed prey on shared screen too. Alternating solo hunts avoid private-view leakage but need equal scenarios.
- **Bot:** Medium less predictive; Hard unchanged. AI remembers last seen prey, then searches rather than tracks hidden prey.
- **Visual / feel:** faster descent with warning anticipation; jumping, open-mouth boss aligned to strike timing; bounded impact particles.
- **Replayability / recommendations:** role choice, mirrored rounds and alternate meadow layouts later. Quick: privacy + reload circle. Medium: telegraphed dive/strike. Ambitious: asymmetric separate-device hunt.

### M. Midnight Lasso

- **What works:** chemical lure, swept tip collision, locked aim during swing, one catch per swing, tie splitting, bounded ten-moth population.
- **Problems / design:** six keys overwhelm a simple loop; lure readiness is not sufficiently visible; aim/movement can feel detached from tip contact.
- **Confirmed bugs:** none established in baseline engine tests. **Suspected:** cached moth visuals should use entity IDs consistently; mobile aim precision needs playtesting.
- **UI/UX / science:** “sticky tip catches” diagram; show swing and lure cooldowns. Existing facts distinguish chemical mimicry from timed gameplay bursts.
- **Mobile / solo / multiplayer / hotseat:** thumb movement + aim controls, clear swing; local simultaneous moth competition is already strong; equal seeded moth runs proposed for hotseat.
- **Bot:** reduce Medium reaction frequency; Hard stays precise. Avoid giving a bot infinite lure or duplicate scoring.
- **Visual / feel:** brief thread anticipation/impact flash and caught moth tether. **Replayability:** variations in branch spacing and moth routes, not more powers.
- **Recommendations:** quick cooldown/UI; medium two purposeful moth trajectories; ambitious changing branch positions/weather with a stable timing core.

### N. Carry Your Cover

- **What works:** carrying speed penalty, proximity pickup, 0.45s shelter assembly, warned patrol lanes.
- **Problems / design:** personal food makes competition superficial; two player-following raid lanes leave much of map inactive.
- **Confirmed bugs:** no crash confirmed. Missing drag/respawn is a requested feature. **Suspected:** repeated damage without a clear displaced/captive state feels confusing.
- **UI/UX / science:** show carried/assembled states, own-shell identity and warning duration; shell transport is inspiration, health/drag timing are arcade rules.
- **Mobile / solo / multiplayer / hotseat:** simplify Pick/drop and Cover/emerge; shared food must use one collection resolver for humans/bots; sequential equal patrol runs proposed.
- **Bot:** seek nearest available food, carry shelter and react to warnings; Medium slower, Hard interval unchanged.
- **Visual / feel:** predator carries victim off-map; one health loss per capture, respawn at safe start, temporary protection.
- **Replayability / recommendations:** quick contested food + drag state; medium rotating warned raid routes with safe intervals; ambitious shell-placement/map alternatives after balance review.

### O. Snap Launch

- **What works:** ballistic guide, deterministic substeps, checkpoints, ten reachable courses, no midair steering.
- **Problems / design:** W/S adds unnecessary manual aiming; courses mostly rearrange fixed ledges; final courses insufficiently differentiated.
- **Confirmed bugs:** none in baseline reachability tests. **Suspected:** wall-clamp behaviour can look like a midair collision without feedback.
- **UI/UX / science:** show cycling arc, “time your snap”, readable course difficulty; jaw-powered leap is real inspiration, platform planning is arcade fiction.
- **Mobile / solo / multiplayer / hotseat:** A/D plus one Snap action; pressing locks current angle and launches, avoiding a second charge/release system. Identical cycle for AI and humans.
- **Bot:** wait for a useful angle instead of commanding it directly; Medium pauses longer after landing; retain Hard precision and reaction parameters.
- **Visual / feel:** snap recoil and landing flash. **Replayability:** narrower final-four ledges, final-two precision courses, meaningful obstacle/geometry package later.
- **Recommendations:** quick timed cycle; medium tested narrow geometry; ambitious moving platforms/bounces require level solver and user review.

### P. Hide in Plain Sight

- **What works:** mirrored seeded Voronoi habitats, six patterns plus texture, visible search cones and detection accumulation.
- **Problems / design:** personal shrimp; constant one-way patrols; dense skin/HUD controls.
- **Confirmed bugs:** none in baseline tests; requested shared food missing. **Suspected:** pattern colour versus actual creature pattern is visually ambiguous.
- **UI/UX / science:** compact skin controls and explicit matched/mismatched text; papillae context; camouflage reduces detection, does not guarantee invisibility.
- **Mobile / solo / multiplayer / hotseat:** avoid 12 skin buttons plus navigation; same central food pool for bots/humans; same seed required for alternating runs.
- **Bot:** nearest available food, match terrain, pause when watched; slower Medium sampling. Hard remains sharp.
- **Visual / feel:** predator slows, pauses and then reverses with a visible cue; detection warning near threshold. **Replayability:** map seed already provides variation.
- **Recommendations:** quick shared food; medium deterministic patrol phases; ambitious habitat-specific vision costs. Keep three predators until density is playtested.

### Q. Silk & Summit

- **What works:** 24-platform 3D courses, 120+ world units, air control, saved checkpoints, silk rescue before heart loss.
- **Problems / design:** themes mainly differ in spacing/color; jump requires exact grounded press; shared camera averages racers.
- **Confirmed bugs:** Medium/Hard pace after opening essentially identical (difficulty discrepancy). **Suspected:** camera visibility at extreme separation; no coyote time/jump buffering.
- **UI/UX / science:** course/checkpoint and silk status, concise jump guidance; distinguish charged rescues from real silk.
- **Mobile / solo / multiplayer / hotseat:** four directions + jump + rescue; stick and camera-relative axes should be evaluated together; equal-course turns proposed.
- **Bot:** short repeated grounded preparation for Medium, no Hard slowdown.
- **Visual / feel:** landing squash, silk recovery arc; add jump buffer/coyote time only with reachability regressions. **Replayability:** cave, ridge/wind and moving-canopy courses need distinct mechanics.
- **Recommendations:** quick difficulty fix; medium forgiving jumps/camera; ambitious themed hazards and courses reviewed before construction.

### R. Into the Abyss

- **What works:** breathe–dive–hunt–surface loop, depth, telegraphed squid strikes and return-to-surface victory.
- **Problems / design:** instant velocity and stop; stationary prey; always-on target coordinate HUD defeats sonar.
- **Confirmed bugs:** information leak relative to intended sonar design. **Suspected:** perfect radial bite without facing may feel weak, but it is not a collision bug.
- **UI/UX / science:** pulse takes one snapshot, quantized bearing/depth/range fades; no constant perfect tracking. Keep depth controls and oxygen obvious. Sonar graphics are abstraction of whale echolocation, not squid echolocation.
- **Mobile / solo / multiplayer / hotseat:** eight actions need grouping; existing multiplayer is whale racing, not whale vs squid; separate squid role is a major redesign.
- **Bot:** solo environment, no opposing whale bot. **Visual / feel:** exponential velocity response and stronger release braking, vertical tilt, local silhouettes only, directional echo indicator.
- **Replayability / recommendations:** quick HUD leak fix; medium snapshot sonar + acceleration; ambitious human squid with burst and ink only, new objectives/camera/privacy contract. Present that redesign before implementing it.

### S. Spit & Sprint

- **What works:** shooting and interception are separate, rival steals are supported, fair split catches, dashed landing prediction, bounded respawns.
- **Problems / design:** active 3D backdrop lacks recognisable mangrove structure; direct aiming only P1.
- **Confirmed bugs:** none in baseline simulation tests. P2 aiming is a confirmed UX asymmetry. **Suspected:** dense aim previews can obscure landing rings.
- **UI/UX / science:** separate spit/dash readiness; retain cited predictive interception explanation. Simplified refraction is already disclosed.
- **Mobile / solo / multiplayer / hotseat:** tap-to-aim plus swim; P2 needs a separate aiming zone or analog aim. Seed equal prey for alternating play.
- **Bot:** slower Medium reaction and less eager dash, retain Hard. **Visual / feel:** mangrove trunks/roots, distant canopy, ripples and jet trails with projectile contrast.
- **Replayability / recommendations:** quick environment and cooldowns; medium independent touch aiming; ambitious moving perches/wind with deterministic landing guides.

### T. Surface & Sprint

- **What works:** three lanes, at least one safe lane/wave, released-edge controls, 54s survival, invulnerability after collision.
- **Problems / design:** immediate sky/water switches; generic tuna; no sidesteps; randomness unseeded for equal hotseat.
- **Confirmed bugs:** none in baseline lane tests. Missing visual transition is a design discrepancy. **Suspected:** two-player vertical offset changes apparent collision location.
- **UI/UX / science:** time-to-phase and lane openings; diving/gliding inspiration, timed zone alternation fiction.
- **Mobile / solo / multiplayer / hotseat:** two large direction buttons ideal; environment is solo opponent; local two fish share waves; seeded schedule needed for alternate turns.
- **Bot:** no rival bot. **Visual / feel:** interpolated surface crossings, body pitch, bounded splash droplets/ripples; larger tuna silhouette/mouth; sky/cloud/horizon and underwater strata.
- **Replayability / recommendations:** keep bounded existing speed curve; proposed side-switch waves must preserve a safe lane, announce new lane early and lock before collision. Add only with fairness invariants.

## U. Highest-impact quick wins

| Recommendation | Impact | Complexity | Risk | Modes / reason |
|---|---|---|---|---|
| Shared tokens, study metadata, accessible dialogs | High | Medium | Low | All; product coherence and usable navigation |
| Hide grass vole mesh/shadow + last-seen AI | High | Medium | Medium | Meadow; restores meaningful concealment |
| Contested, bounded food pool and fair resolver | High | Medium | Medium | Coconut/cuttlefish; actual resource competition |
| Medium reaction and repeated preparation | High | Low | Low | AI rival modes; preserves Hard settings |
| Sonar snapshot / remove continuous coordinates | High | Medium | Medium | Abyss; makes sensing meaningful |
| Safe-area / 44px touch targets | High | Low | Low | All; reachable controls |

## V. Larger improvements requiring design approval

- **Online/private views** — High impact / High complexity / High risk; all modes. Needs authority, rooms, seeded state, validated input and disconnect design. Hidden state must stay server-side.
- **Alternating hotseat tournament** — High / Medium / Medium; all modes. Define fair seeds, human role parity, equal turn rules and camera handover before implementation.
- **Playable squid** — High / High / High; Abyss. Recommend burst + ink, shared hunt space, distinct predator/prey objectives. Replaces current two-whale racing semantics.
- **Themed spider and obstacle ant course pack** — High / High / Medium; two traversal modes. Each mechanic needs human playtesting and automated reachability; avoid decorative recolors.
- **Input source abstraction / gamepad** — Medium / Medium / Medium; all. Extract small intent adapter first; preserve species differences instead of a universal controller framework.

## W. Implementation sequence

1. Preserve unrelated working-tree edits; implement only Natura/report/test changes.
2. Establish shared Field Station tokens, metadata and accessible dialog.
3. Apply to menu, quizzes, facts, game introductions/loading/HUD/results.
4. Fix confirmed privacy/delta issues and Medium difficulty.
5. Implement explicitly requested contested food, capture/respawn, timed snap and bounded presentation improvements. Update old personal-food/manual-angle tests to the new intended rules, preserving meaningful collision/fairness/frame-rate checks.
6. Implement incomplete snapshot sonar and physical movement, preserving core hunt loop.
7. Verify targeted simulations, TypeScript/build and desktop/mobile browser flows. Record limitations honestly.
8. Submit major online/hotseat/squid/course redesigns for approval as concrete proposals; do not silently change role or network contracts.

## Implementation ledger

The starting-code findings above are retained as the audit baseline. This ledger records the completed implementation separately.

### Shared product presentation and architecture

- Implemented the Field Station identity across the menu, all nine exhibit cards, optional quizzes, quiz feedback/results, loading, game introductions, shared HUD, pause/rules/facts panels and match results. `studies.ts` supplies habitat/category metadata; `HabitatIcon.tsx` supplies a consistent outline family; `fieldStation.css` supplies shared tokens and responsive styles. Standard Play, Quiz, health, score and pause concepts remain readable.
- `FieldQuiz.tsx` separates quiz presentation from menu state, adds observation progress, explicit correctness, source-linked explanations, accuracy and missed-answer review. Match points remain separate from quiz points.
- `FieldDialog.tsx` uses native modal dialogs to contain focus and make the background inert. Escape closes secondary panels. Returning from game panels focuses the canvas so held keyboard input does not act on an old button. Icon-only mobile controls have accessible names.
- `input.ts` provides player intents and independent mappings for keyboard/touch, including whale depth. `world.ts` extracts creation, start, phase, stepping and results from React/Three.js. This is a small foundation for future controllers, not an online or gamepad implementation. Meadow retains a compatibility key adapter internally.
- Replaced the misleading user-facing “hotseat” description with **Local two players / simultaneous shared-screen play**. The internal identifier is retained for compatibility. The requested target is online multiplayer plus alternating hotseat; those larger designs are still proposals.
- Added safe-area handling, visible keyboard focus, reduced-motion support and touch target sizing. These improve the shared UI; hardware thumb reach, assistive technology and frame rate still require real-device testing.

### Gameplay changes by habitat

| Habitat | Completed changes | Remaining recommendations |
|---|---|---|
| Wings & Whiskers | Bounded substeps and invalid-delta protection; faster dive after a short windup; visible recharge ring/percentage; concealed vole mesh and shadow suppressed; AI uses last-seen information; giant-vole strike anticipation, upward hop, mouth and bounded particles; slower Medium pursuit | Seven shelters already existed and were retained; evaluate route spacing/camping with human play. No new audio. Online/private views and alternating roles remain pending |
| Midnight Lasso | Shared presentation and input adapter; slower Medium decisions; preserve silk timing and scent core | Larger scoring, moth-route and habitat variants remain proposals; no wholesale loop redesign |
| Carry Your Cover | Six contested food sites with cooldowns and distance-based resolution; hidden/captured/dead players ineligible; exact ties split one food point; three warned raid routes and shorter calm interval; one-heart capture, visible drag, surviving-player respawn and protection; final-heart drag completes before results | Human balance testing of raid density and shelter placement; online/hotseat fairness |
| Snap Launch | Automatic angle sweep, Snap locks and launches, W/S removed from touch guidance; AI times the same arc; slower Medium preparation/decisions; narrower final four courses, final two especially narrow; all ten remain reachable | Distinct moving hazards, environmental interactions and new course families require a larger reviewed level pack |
| Hide in Plain Sight | Shared neutral food sites and fair collection for both humans/bots; deterministic forward–pause–reverse patrols with visible turning cue; slower Medium decisions | Kept three predators to preserve readability; density, pattern cues and touch HUD need human testing |
| Silk & Summit | Repeated Medium grounded preparation rather than only an opening delay; shared presentation and input | Existing three courses retained. New cave/ridge/canopy mechanics, jump forgiveness and separated-racer camera work remain proposals |
| Into the Abyss | Physical acceleration/release braking with normalized 3D input; vertical body tilt; sonar snapshots into coarse bearing/depth/range and expires; no live target coordinates or distant continuous sonar silhouettes; directional echo indicators | Current role remains whale racing. A separate playable squid variant with burst/ink is awaiting the user's design choice; spatial audio and richer terrain remain proposed |
| Spit & Sprint | Mangrove roots/trunks/canopy, ripples and jet trails; slower Medium decisions/aiming and less eager dash | P2 independent pointer aiming and richer perch variation remain recommendations |
| Surface & Sprint | Smooth body-depth/camera/color transitions between water and air, folded fins/tilt, bounded droplets/rings; cloud/horizon/kelp treatment; larger tuna body/mouth/fins/tail; later waves warn before lane switches and lock before impact; retain existing gradual speed curve | No new audio; seeded obstacle schedules are needed for fair alternating turns; no measured phone GPU budget |

Hard bot difficulty parameters were preserved. Shared rule/physics changes—including the timed ant arc and private-information fix—apply to every difficulty, so “unchanged parameters” does not establish identical human-perceived difficulty. Medium beatability still needs representative human playtesting.

### Scientific content check

Existing source-linked facts and explanations were reused; the visual system adds no invented taxonomy or filler biology. The external review checked these primary/institutional sources:

- [NOAA: sperm whale](https://www.fisheries.noaa.gov/species/sperm-whale) supports air breathing, deep diving and squid prey.
- [Te Papa: colossal squid](https://collections.tepapa.govt.nz/topic/588) supports the Southern Ocean setting and sperm-whale association. Giant and colossal squid are distinct; no old specimen-count claim was added.
- [Marine Biological Laboratory: cuttlefish papillae](https://www.mbl.edu/news/how-cuttlefish-spikes-out-its-skin-neurological-study-reveals-surprising-control) supports changing skin texture as well as color/pattern.
- [Patek et al.: multifunctionality and mechanical origins, PNAS](https://pmc.ncbi.nlm.nih.gov/articles/PMC1568925/) supports trap-jaw strikes and escape launches. Replaced the inaccessible legacy Berkeley link in facts and scenario metadata with this paper.
- [University of Kentucky: bolas-spider research](https://www.uky.edu/Ag/Entomology/entdept/faculty/yeargan/yeargan2.htm) supports chemical mimicry used to attract moth prey.
- [Natural History Museum: octopus tool use](https://www.nhm.ac.uk/discover/octopuses-keep-surprising-us-here-are-eight-examples-how.html) supports coconut-shell transport/shelter behaviour.

Hearts, cooldowns, timed platform trajectories, respawn, repeated predator waves, giant-vole growth and sonar rings are arcade abstractions. The menu explicitly states that rules are simplified or fictional. Quiz/source links are contextual evidence, not a claim that every rule simulates biology. This is a focused check of the changed presentation and relevant claims, not an exhaustive expert review of every existing quiz statement.

### Validation and limits

- **82/82 targeted simulation tests passed**, including the original collision, scoring, reachability, health, breath, rescue and frame-rate checks. New coverage includes hidden-prey AI parity, invalid delta, dive anticipation, shared-food ties/eligibility/cooldown, final-heart capture duration, cycling launch, snapshot sonar expiration, swimming response, repeated Medium preparation, safe lane-switch locking, input isolation and all-nine world adapters.
- TypeScript project checks and the production Vite bundle pass. The existing large-chunk and Vite config warnings remain; this pass did not restructure unrelated application bundles.
- Browser smoke checks started all nine habitats. Completed a six-question quiz, checked separate quiz/match scoring, pause/resume, keyboard focus, rules/facts and round results. Checked desktop, 390 × 844 portrait and 844 × 390 landscape layouts; tested movement buttons were at least 44 pixels. No browser errors were reported in the checked flows.
- Particle/food counts are bounded and renderer cleanup remains in place. No physical phone benchmark, GPU memory profiling, screen-reader audit, network playtest or representative human difficulty study was performed. Browser emulation does not establish mobile frame rate or two-thumb comfort.
- Preview: `docs/natura/field-station-desktop.jpg`. The screenshot records the implemented menu, not a visual mockup.

### Decisions after the first pass (superseded by approval below)

The user clarified **online multiplayer plus alternating hotseat**. Section J proposes invite-code rooms with server simulations and private views, plus equal-seed alternating runs and a handover screen. This requires new transport/authority contracts and is awaiting the user's choice, as requested before large changes. Do not expose hidden positions through a full authoritative state sent to both clients.

The separate playable-squid variant is also awaiting a choice. The ant/spider obstacle/theme packs remain larger recommendations, and audio/gamepad support remain future work. These are not implemented or covered by the passing local tests. No deployment, publication or unrelated working-tree edits were performed.

## Approved expansion: online, alternating hotseat, squid and course packs (initial transport)

**Transport superseded:** the server references in this historical ledger describe the first implementation. The Supabase revision below is the current online architecture.

The user approved the two proposed designs and the larger ant/spider packs on 4 October 2026. They are now implemented. The earlier “pending” ledger describes the first pass, not the current feature state.

- **All nine habitats:** invite-code online rooms and alternating hotseat now sit alongside solo and simultaneous local play. Shared room configuration selects habitat/course; every device uses one input controller. Hotseat pairs equal seeds/roles and unmounts the world for handover, with four turns in asymmetric studies.
- **Authority:** `server/natura/rooms.ts` owns simulation, readiness, scoring, pause, reconnect and forfeit. `protocol.ts` validates bounded intent/configuration; `privateView.ts` filters hidden state before packets are sent. `network.ts` manages per-tab reconnect and body interpolation. The small Node/ws adapter follows the project's Party pattern while keeping Natura's room lifecycle separate.
- **Privacy:** hidden vole and pursuit-opponent coordinates are absent from the other player's actual network payload. Own-player camera/visibility is independent. Sonar provides temporary coarse observations, rather than live distant coordinates. Shared-screen pursuit deliberately shows both creatures; online supplies the private views.
- **Squid:** a separate whale-versus-squid challenge retains the existing whale race/hunt as an option. The squid has only burst and ink; the whale senses, bites and manages breath. Both solo roles, online and role-balanced hotseat are implemented. Combat and sonar disruption remain labeled as game fiction.
- **Courses:** six new ant courses (16 total) and five new spider courses (8 total). Moving surfaces, wind, timed gates, slippery momentum and crumbling/wilting surfaces affect the simulation and rendering. Final ant courses combine narrow mastery landings. All courses remain reachable under actual simulation rules.
- **Supporting fixes:** seeded ocean waves and meadow respawns are isolated per world; cosmetic randomness does not change respawn schedules. Per-player targets/skin choices work through online input. Changing labels reuse sprites and dispose replaced textures. Existing Hard difficulty parameters were preserved; new courses and AI controller bug fixes affect outcomes at every difficulty.

Detailed running instructions, privacy contracts, lifecycle and limitations: [multiplayer.md](multiplayer.md). The included server is locally runnable, not deployed publicly. The existing static Cloudflare host needs a separate Node/WebSocket authority for public online play. Matches are in memory and lost on server restart. Audio, gamepad support, account matchmaking, persistence, WAN/load testing and real-phone profiling remain outside this expansion.

### Expansion validation

- **102/102 targeted tests passed**, including actual two-client WebSocket integration, authority lifecycle/private payloads, equal-role hotseat, squid objectives/cooldowns and all sixteen ant/eight spider course routes using the real physics.
- Main, Party and Natura TypeScript checks and the production Vite build passed. The existing large application chunk warning remains.
- Two browser clients joined an invite room, started a synchronized whale-versus-squid match, used squid actions, refreshed/reconnected, resumed together and recorded a leave-forfeit. The squid's own view and controls were checked at 390 × 844. A complete alternating hotseat match recorded the same seed, three dodges and 17.0 seconds for both players, correctly producing a draw. Solo squid touch actions showed their cooldowns; the sixteen/eight course selectors and final ant/spider scenes were checked. The asymmetric hotseat handover showed four turns. No browser errors appeared in these flows.
- Proof images: [online squid mobile](online-squid-mobile.jpg) and [Crown Relay](crown-relay.jpg). Browser emulation and bot reachability do not establish physical-phone performance, representative human difficulty or WAN reliability.


## Current revision: Supabase relay and browser-hosted matches

At the user's request, the dedicated Natura server was removed. `NaturaRooms` now lives in `src/games/natura/rooms.ts` and runs inside the room creator's browser. `relay.ts` manages host/guest messages, lifecycle and interpolation; `network.ts` supplies the existing Supabase Realtime channel. The Node adapter, Vite proxy, server command and Natura server settings are gone. No new database migration or Edge Function is required.

Per-seat projections remain. ECDH/AES-GCM protects the projected guest snapshots and input on the shared relay topic, with replay/context checks and bounded queues. The host holds the full world and is trusted; this no longer claims independent server privacy or anti-cheat. Public-key discovery is not authenticated competitive matchmaking. Guest refresh automatically reclaims the same seat; host closure/reload ends the room. Host hiding or stalling pauses gameplay. Guest intent and snapshots run at up to 10 Hz to reduce shared Realtime usage; short taps are latched.

All 107 targeted tests passed, covering the existing game mechanics/course routes and the real crypto/relay lifecycle through an injected message bus. Main, Party and Natura TypeScript checks and production build passed. Live two-client browser verification against the configured Supabase project covered create/join, whale-versus-squid actions, shared pause, automatic guest refresh/reconnect, both-ready resume, guest forfeit and host restart. The former Natura server was stopped for those checks. Proof: [Supabase online](supabase-online.jpg). The earlier Node/WebSocket smoke test is historical, not the current transport's validation.

This frontend revision has not been published to the public site. No production concurrency/latency benchmark or physical-phone performance test was performed. The relay still consumes Supabase's shared quotas. Current contracts: [multiplayer.md](multiplayer.md); future server priorities and Pluto Party review: [multiplayer architecture](../multiplayer-architecture.md).
