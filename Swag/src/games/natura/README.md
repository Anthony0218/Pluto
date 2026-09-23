# Natura: Spit & Sprint

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
