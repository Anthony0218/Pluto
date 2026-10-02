# Eat It readability, rules and difficulty report

Implemented against the existing working tree, preserving the prior Eat It expansion and unrelated edits. No dependency or asset download was needed.

1. **Reused systems.** Extended the fixed-step serializable engine, mass/radius model, finite-mass prop physics, supported-edge falling, spawn sectors, underpasses, Pluto rewards, encounter state machine, Golden Scroll/Cat Tree ownership, Escape routing, lives/respawn, Hell grid and sweep planner, bot steering, review statistics, localization lookup, React HUD and Supabase authority. The inspected renderer is Three.js/WebGL with Canvas ground textures and overlays; it was retained rather than replaced with a new Canvas engine.

2. **Animals.** A shared bounded curve uses `1 + 2.2 × clamp((radius − 24) / 288, 0, 1)^0.7`. Neutral/friendly/hostile/Escape multipliers are 1 / 1.15 / 1.8 / 2.8. Neutral animals therefore cap at 3.2×; special forms remain larger. Target or owner determines relevant size; unowned animals use the nearest living participant with stable player-order ties. The authority stores scale in the NPC snapshot and uses it for collision/entry/navigation; clients may smooth the model. Snack, feeding and revenge rewards are unchanged.

3. **Maps.** City and Nature grew from 3200 × 2400 to **4000 × 3040**: +25% width, +26.7% height, +58.3% area. Bounds drive cameras, generation, sector coverage, quests, Pluto, power-ups, NPC roaming, Escape routing and bots. Nature's river/gap geometry was expanded; the Hell platform is centered in the new world. Target prop count rose from 340 to 540, hard cap from 360 to 570, power-up cap from 12 to 18, and Pluto cap from 8 to 12. Ordinary object and underpass dimensions remain physically consistent. Respawn selection now enforces an additional clearance based on nearby players' actual size.

4. **Power-up scaling.** All six collectible power meshes scale for the local viewer with a 2.2× cap. Pickup radius, durations, strengths, mass and score are unchanged.

5. **Glow.** Colored radial glows grow from 25 to at most 55 screen pixels, with bounded intensity and larger outlined symbols. Speed, Shield and Magnet retain distinct colors/symbols; Pluto keeps its separate planet model/emissive treatment. There is no fullscreen bloom pass.

6. **Settings and defaults.** Animals ON, Hell Sudden Death ON, Lives ON, solo Bot Difficulty Medium. Validated preferences persist under `eat-it-settings`. Animals OFF creates no encounter, shrine or quest item and prevents helpers/Escape. Hell OFF resolves the three-minute timer by remaining contenders' mass, then score, with explicit ties. Multiplayer freezes the host-created rules in authoritative room/match state; input requests cannot change them.

7. **Lives OFF.** Humans and bots start with one life and cannot respawn. Lives ON gives three lives in both modes. Bots automatically respawn after the existing delay, while humans use Respawn; online requests are checked by the authority. Disconnect/leave forfeits all remaining lives. HUD hearts and respawn controls follow the actual configuration.

8. **Notifications.** Important Canvas labels use cream rounded bold text, dark outlines and dark translucent plaques with colored borders. The HUD uses the same high-contrast direction; choking adds an orange accent and small shake. CSS honors reduced-motion preferences. Power pickups, Pluto bonuses, Escape and respawn join the existing event announcements. Choking visibility no longer depends on animal quests being enabled.

9. **False-positive choking cause.** The old canopy check charged `width × depth` rectangular area, including empty corners outside the visible ellipsoid. Its tree model also used independently specified canopy extents. Smoothed visible body size could disagree briefly with authoritative size.

10. **Fit correction.** `treeGeometry.ts` supplies the same trunk/canopy cross-section to models and shared fit logic. `canObjectFitMouth` checks actual horizontal radii against the rendered circular opening, including temporary-size effects. The rendered mouth now uses authoritative radius directly; camera/position smoothing remains. Trunk too wide means no entry; fitting trunk with oversized canopy means choking; a fitting canopy is consumed normally. Rotation around the trunk does not change its maximum horizontal radius. Other prop area rules remain intact.

11. **Stuck leaves and spit-out.** The serialized tree stays reserved at the mouth for the three-second choke, with trunk below the rim and tilted canopy visibly lodged at the entrance. Distressed eyes and rim shaking remain visible. A bounded local placement search starts a 0.55-second arcing, rotating/tumbling spit animation, followed by settling and a short reacquisition cooldown. No growth/score is awarded. Death also releases the tree. Quaternion tilt avoids an Euler-angle flip that visual QA caught during tumbling.

12. **Quest items and hand.** Golden Scroll and Cat Tree adapt with a 3.4× cap; ground presentation follows the viewer and carried/delivered presentation follows the owner. Rewards, collection rules and non-devourability are preserved. Carried arm reach and hand size grow, while arm thickness stays at or below 2.4 world units.

13. **Burps.** Humans and bots use staggered deterministic 27–33-second timers and a brief 0.85-second rim/eye/puff animation. Timers do not consume gameplay RNG. Movement and stats are unaffected. Death, respawn, choking, swallowing, Escape and major state animations suppress/delay burps; Hell never uses them.

14. **Hell expressions.** Eyes widen, pupils track the actual black hole relative to character facing, and characters tremble slightly near unsafe ground. The mouth remains dominant.

15. **Bot difficulty.** Hard preserves the previous policy constants and capabilities: 0.18-second decisions, 0.2-second pursuit prediction and 16 Hell direction samples. Medium uses 0.42-second decisions, reduced hunt/threat ranges, 0.1-second prediction and 12 Hell samples. Easy uses 0.75-second decisions, much less pursuit, no prediction and eight Hell samples; nearby food matters more. Escape is less immediately triggered on the easier policies. Shared speed, physics, growth and visibility are unchanged. Multiplayer bots retain Hard, so the solo preference cannot alter another match.

16. **Hell AI.** Difficulty adds 0 / 0.3 / 0.65 seconds of warning reaction delay for Hard / Medium / Easy. Safe-ground checks and route scoring use only current terrain and publicly telegraphed paths. Delayed policies do not inspect the destination before their warning reaction point.

17. **Black hole and laser.** Reused the planner's existing **1.1-second** warning and locked destination. A deep center, layered rotating/warped rings and 40 instanced particles improve its appearance. A red laser with a cream core, bounded glow and arrowhead is projected from the same serialized destination used by movement. It disappears when sweeping begins. Unit tests inspect the actual arrow transform and compare sweep displacement with the advertised vector.

18. **Verification.**
    - `npm run test:eat-it`: **158/158 passed**, including 30 new settings/scaling/choking/burp/difficulty/telegraph tests and existing multiplayer, network, quests, physics, underpass, Pluto, Hell and stress tests.
    - `node --test tests/*.test.mjs`: **335/335 passed**. Subsequent small renderer/bounds/timer refinements were covered by the final full Eat It run.
    - Result-migration test rerun with explicit persisted-settings/start-life assertions: **1/1 passed**.
    - `npx tsc -b --pretty false`: passed. Final `npm run build` also includes TypeScript checks and passed.
    - ESLint on `src/games/eat-it`, `src/pages/games/EatIt` and `tests/eat-it*.test.mjs`: passed, no scoped failures.
    - `git diff --check`: passed.
    - Browser QA: huge pigeon/cat, ground and carried quests, power-ups/glows, burp, stuck canopy, complete spit-out, fitting-tree consumption, black-hole laser, actual settings defaults/persistence, and a one-life Animals/Hell OFF solo game. Browser preferences restored to ON/ON/ON/Medium afterward.
    - Existing Vite warnings remain about `__dirname` in future native config loading and large unrelated application chunks. No repository-wide lint cleanup was attempted.

19. **Limits and deployment.** Live hosted multiplayer was not deployed or load-tested. Deploy the shared `eat-it-match` Edge Function with the frontend and apply `20261001000000_eat_it_match_settings.sql` to persist settings in result details (existing migrations must already be applied). Historical ledger rows stay unchanged. The existing request-driven authority, full-snapshot bandwidth cost, WebGL2 requirement, approximate planar colliders and bounded cat routing remain. Spit-out is a deterministic short ballistic-style animation, not a general rigid-body solver; in dense geometry it chooses the best local clearance rather than transporting the tree across the map. No mobile-device GPU benchmark was performed. The new development-only fixture is `tests/eat-it-readability-preview.html`.
