# Natura field journeys

The Field Station now offers a field journal and three-study expeditions alongside the existing habitat collection. No additional packages, server or audio assets are required.

## Learning and progress

- Single-player introductions offer **Learn by playing**. Practice uses the real simulation with an idle rival, a held match timer and restored hearts. Each habitat checks an actual skill: perch refill, tunnel use, catch, concealment, landing, lane dodge, or a sonar-assisted dive and return. Finishing or skipping practice starts a fresh scored world. Practice never writes a scored run.
- Completed single-player runs save once, including when players select Replay or Next course before opening round results. The journal separates records by habitat, course, difficulty, rule set, variant and animal role. Replays from results retain the same course and rules.
- Wins collect original SVG specimen illustrations and existing sourced biological observations. Quizzes retain the best score out of six, separate from match points. Bronze marks a win, silver/gold mark remaining hearts; spider medals use falls and completion time. The kestrel's successful hunt earns gold because its finale uses a single lethal hit rather than hearts.
- The `natura.field-journal.v1` browser storage entry contains progress. Storage errors and malformed entries do not prevent play. Records remain local to this browser; online and alternating-hotseat games do not affect solo personal bests.

## Wild challenges

Select **Wild challenge** in supported single-player introductions, or for a standard expedition. Classic worlds remain the default, including online and hotseat play.

| Habitat | Additional decision |
| --- | --- |
| Flying fish | Space chooses the air/water crossing. Air drains glide energy and water refills it. Both gull and tuna waves remain visible and only threats in the current zone can collide. |
| Coconut octopus | Two marked reef pockets offer shelter without a shell. Central meals award two food; outside meals award one. Ties split the meal's total value. |
| Cuttlefish | Some patches change pattern every 12 seconds. Central shrimp award two food; outside routes offer one. The renderer and detection use the same changed patterns. |
| Trap-jaw ant | Optional broad lower stepping stones offer detours while preserving the main checkpoint sequence. |
| Jumping spider | Optional side leaves offer shorter jumps. Their landing indices map back to the original 24-platform progress and checkpoint sequence. |
| Sperm whale | Deep-water currents add drift and the final prey lives deeper. Breathing, sonar snapshots and surfacing remain essential. |

Moths, archerfish and kestrels retain their existing tactical rules and gain the shared learning and presentation improvements.

## Expeditions

Three themed routes connect three habitats each. Runs award at most 100 expedition points each: up to 60 for progress, 30 for a win and 10 for remaining health. Daily expeditions use a date-derived seed, classic rules, course one and Medium difficulty. The day changes at midnight in Europe/Berlin; an already-started expedition keeps its original trail. Standard expedition bests are separated by route, difficulty and rule set. Total score is at most 300.

## Presentation and controls

The shared runner displays hearts, breath/detection meters, cooldown rings, pattern swatches and post-run observations. Touch and narrow-screen layouts use a movement pad for free-moving animals and grouped action buttons; lane, aiming and launch modes retain dedicated controls. Keyboard controls remain active.

Meshes animate wingbeats, leg strides, moth wings, swimming tails and tentacles. A fixed-capacity cosmetic particle pool adds movement trails, underwater bubbles, catch/impact bursts and checkpoint effects. Cosmetic state never affects seeded simulation randomness or hidden opponent visibility. Particles use simulation time and freeze while paused. Reduced-motion preferences suppress additional motion and particles.

Web Audio synthesizes quiet habitat ambience, action cues, catches, checkpoint chimes, injury sounds and sonar. Audio begins on a player gesture, suspends when the habitat is paused, and is released on exit. The mute preference is saved separately as `natura.sound`.

## Verification

Run `node --test tests/natura-*.test.mjs tests/wildModes.test.mjs tests/toolAnimals.test.mjs tests/archerfish.test.mjs` and `npm run check:natura`. The journey tests cover storage recovery, comparable records, Berlin day boundaries, practice isolation and success criteria, fair rich-food collection, reef shelter, tides, currents, manual crossings, bounded particles and completion of all wild ant/spider courses.

Browser checks cover practice completion and fresh-run reset, persisted journal skills, pause, challenge selection, expedition navigation and responsive HUD/control layout. Viewport checks do not substitute for physical phone performance or touch testing.
