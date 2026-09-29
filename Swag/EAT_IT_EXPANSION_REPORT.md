# Eat It expansion implementation report

1. **Existing baseline preserved.** The working tree already contained shared fixed-step physics, mouth-fit and falling rules, tree/trunk choking, City/Nature, procedural Three.js rendering on canvas, pigeon/Golden Scroll and cat/Cat Tree quests, friendly feeding/revenge, PvP bites, bots, six power-ups, shared audio/settings/localization, elapsed timer/closing ring, server authority, snapshot interpolation, immutable online results and extensive tests. The renderer was Three.js, not a flat Canvas2D arena. Those systems were extended. Unrelated existing chess/package changes were left intact.

2. **Files changed or added by this work.** Added `progression.ts`, `escape.ts`, `hell.ts`, `hellVisuals.ts`, and `review.ts` under `src/games/eat-it/`. Extended existing `config`, `types`, `engine`, `rules`, `physics`, `spawn`, `bots`, `quests`, `falling`, `models`, `questVisuals`, `renderer`, `presentation`, `authority`, `network` and `audio` modules. Updated `EatItPage`, `EatItArena`, `EatItResults`, their CSS, translations and README. Added the result migration, expansion/stress/database tests, and development visual/UI fixtures. Adjusted one existing bot obstacle test to use a medium character, since small characters should now pass under the tested house.

3. **Underpass collision.** Metadata defines visual footprint, physical footprint, clearance, devour area and render layer. Below the radius clearance (28 vehicles, 34 raised buildings), the character can traverse below the body but still collides with wheel/stilt feet. A medium character is blocked and cannot move the structure. A sufficiently large mouth uses the existing swallow geometry. Models are raised with visible supporting geometry, so the depth buffer renders the character below them. Rocks/logs/trees, shrine and terrain remain outside this behavior.

4. **Pluto spawning and rewards.** Five size tiers use 55/25/12/6/2 weighting, four initial placement attempts, one attempt per 12 seconds and at most eight active. Both maps use existing rejection against props, players, map edges, water and the shrine, plus reserved spawn areas. A Pluto is still a physical food object: mouth fit, entrance, ownership and completed swallowing are required. Its extra reward uses authoritative match settings and the existing growth soft cap. Oversized Pluto does not attract to Magnet.

5. **Default multiplier.** `EAT.pluto.multiplier` is **2×**. Host/solo settings allow **1.25–5×**, with finite-number validation/clamping. Client growth claims are ignored.

6. **Normal pigeon Escape.** A legitimate friendly pigeon approaches and scales up over 0.65 seconds, visibly carries the monster along an animated flight to a random valid position, and lands. The player cannot eat, collect powers/items or be eaten while riding. Landing is revalidated against moving occupants.

7. **Normal cat Escape.** The same earned action grows a visibly mounted cat, uses a bounded grid search for a random reachable destination, and follows grounded waypoints around large colliders. A changed obstruction can interrupt a ride safely. No valid route means activation is declined without spending the entitlement.

8. **30-second counter.** The existing friendship deadline is the authoritative availability window, displayed next to Escape. One normal ride is allowed during that window; a parallel cooldown was not added. Reconnecting to the same online match cannot reset it. Flight itself is an animated journey of approximately three seconds plus approach (longer cat routes take the required time).

9. **Three-life Singleplayer.** Humans and bots start with three lives, shown continuously in the HUD/roster. Each actual death decrements once. Third death eliminates the participant from normal play. Hell is final regardless of unused normal lives. Competitive multiplayer keeps one life by default.

10. **Five-second respawn.** Authority schedules availability five simulation seconds after death. Humans get a disabled countdown button and choose when to return; bots automatically use the identical routine. Size/mouth, powers, choking, riding, invalid NPC attachment, swallowed-object claims and carried quest state reset. Placement is safely searched rather than forced into occupied geometry.

11. **Hell entry.** Timed Singleplayer defaults to a three-minute countdown; hosts can explicitly opt multiplayer into the same finale. The existing default multiplayer closing-ring mode remains. A two-second transition retains every eligible contender, including a waiting participant with a life left, records normal-phase size and legitimate friendship, resets size/effects, clears the normal world and places contenders around the platform.

12. **Black-hole destruction.** A 280-cell grid uses compact numeric states/timestamps. Sweeps have a 1.1-second directional telegraph. Crossed cells warn for 0.65 seconds, crack/sink for 0.4 seconds, then remain gone. Speed rises gradually from 230 to a capped 390 units/second. An instanced floor and small procedural effects avoid a mesh or network object for every fragment.

13. **Lava elimination.** Losing support starts a visible 0.75-second falling sequence, then records lava death and a splash. The black hole does not kill at arbitrary distance. No normal respawns or bite interactions run in Hell.

14. **Simultaneous ties.** Every lava elimination within one fixed authoritative tick is committed before checking survivors. No survivor means Tie; tied finalists share first placement and persist as draws. A still-falling participant cannot be declared winner. Player array order and request delivery order cannot select a winner from that batch.

15. **Hell pigeon.** Only an active, completed friendly quest at transition earns one final assist. It provides two seconds of flight using normal directional input, protects above missing ground, and is consumed immediately. At expiry, landing can correct to safe ground within 120 units; otherwise the player falls.

16. **Hell cat.** One two-second grounded dash uses the same entitlement. Small leaps are bounded to 96 units of missing ground and 0.4 seconds unsupported; it cannot fly over an unlimited gap. Landing correction is limited to 80 units. Expired/hostile/unearned NPC states are excluded, and revenge ends on transition.

17. **Hell bots.** Bots use the current destroyed/warning cells, public sweep telegraph, black-hole distance, reachable directional probes, edges and neighboring safe ground. They use earned assists when threatened and share movement/lava rules. No future random destination is available before the shared telegraph.

18. **Game Review and storage.** Each participant has placement/result, normal final and maximum mass, objects/opponents eaten, deaths/lives/respawns, Pluto count/bonus growth, both quest completions, normal/final assists, Hell survival time/cause/lava/survival flags, buildings/trees/chokes, friendly growth and hostile loss. Normal and Hell timelines contain meaningful events, bounded to 256 entries. The additive SQL trigger revision preserves historical rows and retains legacy detail keys while storing the new stats and proper draw outcomes. Local practice remains unsubmitted to profile storage.

19. **Validation.** See the final validation section below. Browser checks covered the real Singleplayer HUD, countdown and enabled Respawn button, actual respawn, raised car/house, all Pluto sizes, mounted pigeon/cat, Hell overview/lava/cracks/destruction, final Escape control, and Tie review. Development fixtures allow deterministic replay of these scenarios.

20. **Limits and rollout.** Frontend, updated shared Edge Function imports and the new SQL migration must be deployed together for live online behavior. No remote deployment or authenticated multi-browser session was performed. Network authority and persistence were exercised locally. Spawn/route searches are bounded and may decline when no safe space exists; cat routing and animal anatomy are stylized approximations. Small landing corrections remain bounded rather than guaranteeing rescue. Existing Vite warnings about bundle size and future config-loader compatibility remain. Additional playtesting is appropriate for spawn frequencies and Hell difficulty across devices.

## Final validation

- `npm run test:eat-it`: **128 passed, 0 failed**. Includes existing mouth/physics/quest/network/multiplayer tests, the new 27 expansion cases, two full eight-bot timed matches and the real result migration executed with PGlite.
- `npm run build`: **passed**, including `tsc -b`. Vite completed successfully; the existing large-chunk advisory remains.
- `npx eslint src/games/eat-it src/pages/games/EatIt tests/eat-it-ui-preview.tsx`: **passed**, no output/errors.
- Repository-wide `npm run lint`: **fails on pre-existing unrelated files**, including Medieval Kingdoms, chess/other game components and older Supabase functions. Its one new preview export diagnostic was corrected and the scoped check rerun successfully. Unrelated lint violations were not modified.
- `git diff --check` on the tracked Eat It changes: **passed**.
- Final stress run: City reached a winner at 266.97 simulated seconds; Nature reached a Tie at 314.03 seconds. Average Hell step cost was 0.52 ms / 0.20 ms respectively during the concurrent test run. Finished serialized snapshots were approximately 21 KB / 24 KB. These are local simulation measurements, not live deployment latency or mobile GPU benchmarks.
- Browser: checked real HUD and controls, all five Pluto tiers, raised geometry/depth occlusion, mounted normal pigeon/cat, Hell camera/telegraph/cracking floor/lava, falling before elimination, final flight, and the Tie review with phase timelines. The visual fixture reported no browser console errors. The local game remains available at `http://127.0.0.1:5173/games/eat-it`.
- New interface strings use the existing translation tables for English, German, Bavarian, Spanish, Portuguese, Korean and Russian.
