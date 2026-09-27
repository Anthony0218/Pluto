# Natura minigames

## Snap Launch — trap-jaw ants

Choose from five courses: Root Ridge, Fallen Logs, Fern Staircase, Stone Hollows,
and Canopy Run. Each has five or six ledges and uses the same jaw-powered launch. Walk to a takeoff point,
choose a launch angle, then snap. There is no mid-air steering. Each ledge saves
a checkpoint; falls cost one of three hearts. First to the nest or last survivor
wins. At 60 seconds, highest ledge wins, with hearts breaking ties.

Coral uses A/D to walk, W/S to aim steeper/flatter, and Space to snap. Gold uses
arrows and Enter. Release the snap key before launching again. Local two-player,
AI racing, and on-screen hold controls are supported.

## Hide in Plain Sight — cuttlefish

Collect six shrimp on your numbered route while avoiding predator search cones.
Match pattern **and** skin texture to the current habitat, then stay still to
reduce detection. Each round generates 24 irregular patches across six habitats:
sand, pebbles, reef, seagrass, shell beds and dark gravel. Patch labels show the
required pattern and texture; the map is mirrored for equivalent player routes.
Three predators now patrol at 140–160 pixels/second (previously 65–72).
Moving can reveal even a correctly disguised cuttlefish. Full detection costs a
heart and returns the animal to the start while preserving collected food.

Coral uses WASD, Space to cycle pattern, and Left Shift to toggle texture. Gold
uses arrows, Enter, and Right Shift. Touch movement and direct skin selectors
are also available. First to six shrimp or last survivor wins; at 60 seconds,
food is compared first, then hearts. Both local and AI play are supported.

These modes pause with Escape, on window blur, or while rules are open. They
use Natura's existing match scoring, six-question banks, and replay flow.

## Midnight Lasso — bolas spider

Move along a night-time branch, aim a sticky thread and swing to catch moths.
Scent lures attract nearby prey for 3.5 seconds, with a five-second recharge.
Only the sticky tip catches; one moth per swing. First to eight catches wins,
or the highest score after 60 seconds. Equal simultaneous catches split a point.

Coral: A/D move, W/S aim left/right, Space swing, Left Shift lure.
Gold: left/right move, up/down aim, Enter swing, Right Shift lure.

## Carry Your Cover — coconut octopus

Pick up a numbered shell and carry it between six personal food markers.
Carrying reduces speed from 165 to 100 pixels/second. Drop it to travel faster,
or assemble it into shelter before a predator crosses the warned lane.
Assembly takes 0.45 seconds. Covered octopuses cannot move or collect food.
Three hits eliminate a player; first to six food or last survivor wins.
At 60 seconds compare food, then hearts.

Coral: WASD move, Space pick/drop, Left Shift cover/emerge.
Gold: arrows move, Enter pick/drop, Right Shift cover/emerge.

Both modes have touch controls, AI/local play, pause, six quiz questions and
source-linked facts. `toolAnimals.ts` holds the simulation, `toolAnimalsDrawing.ts`
the canvas scenes, `toolAnimalsData.ts` the rules/questions, and
`ToolAnimalsGame.tsx` the UI. The briefings distinguish animal behaviour from
arcade mechanics. Tests cover catches, lure cooldowns, shelter assembly,
protection, movement cost, food routes, AI and frame-rate consistency.

## Did you know?

Every scenario now has a browsable, source-linked fact box in the menu, briefing,
and results. Facts also appear alongside games; the existing flying-fish field
guide is preserved. New fact content lives in `naturaFacts.ts`, with a shared
`DidYouKnow` component. Facts stay put until the player chooses **Next fact**.

The ant and cuttlefish simulations are in `wildModes.ts`, their canvas scenes are in
`wildModesDrawing.ts`, and their rules and questions are in `wildModesData.ts`.
`WildModesGame.tsx` shares input, pause, rendering lifecycle, and result handling.

Run `npm run test:natura` from `Swag` for all simulation tests, including jump
landings, checkpoints, camouflage detection, AI completion, ties, frame rates,
and scenario/fact data. Node 22.18+ is required. `npm run build` checks TypeScript
and the production bundle. Browser visual verification still needs a local run.

## Spit & Sprint — archerfish

Open `/games/natura`, choose **Spit & Sprint**, and select local two-player or AI play.
Shoot insects from mangrove branches, then intercept them at the water surface.
Either fish can collect a falling insect. First to 7 food wins; otherwise the higher
food total after 60 seconds wins. Exactly tied catches split one food point.

| Fish | Swim | Rotate aim left / right | Spit | Dash while moving |
| --- | --- | --- | --- | --- |
| Coral / Player 1 | A / D | W / S | Space | Left Shift |
| Gold / Player 2 | Left / right arrows | Up / down arrows | Enter | Right Shift |

Both players have on-screen hold controls. Coral can also aim with the pointer and
click or tap above the water to spit. Escape and the Pause button pause the round.
Opening the animal rules freezes play; leaving the window pauses until resumed.

The scenario uses Natura's existing win bonus, quiz, results, and replay flow.
Food is separate from the match score. Six questions provide three per player.
No runtime dependencies or online multiplayer services were added.

- `archerfish.ts`: physics, input interpretation, AI, catches, and round outcome.
- `archerfishDrawing.ts`: canvas mangrove scene, fish, shots, and landing guides.
- `../../components/natura/ArcherfishGame.tsx`: controls, pause, and round UI.
- `naturaData.ts`: scenario rules, biological source, and quiz questions.

Run `npm run test:natura` from `Swag` with Node 22.18+ for the simulation and quiz
data tests. Run `npm run build` for the TypeScript and production build checks.

Archerfish water jets and predictive interception are documented in
[The archerfish predictive C-start](https://epub.uni-bayreuth.de/id/eprint/7360/).
Timers, cooldowns, landing rings, food points, and insect respawns are game rules;
the briefing explicitly distinguishes them from the animal behaviour.
