# PLUTO landing page UI implementation plan

Status: the landing hero's Games / Tools / Learn tabs, distinct books, app tiles, and Motion transitions are implemented. Optional 3D, shader, and logo enhancements remain proposals.
Prepared: 5 October 2026.

Implementation constraint: UI changes are confined to the landing page. No Liquid Glass React or other glass dependency is installed. The tab bar uses CSS frost with an opaque fallback. Existing dashboard, tools, learning pages, shared navigation, and their behavior are outside this change.

## Outcome and visual direction

Make PLUTO feel like an inviting universe for games, useful apps, and learning: deep navy backgrounds, restrained atmosphere, dimensional objects, clear typography, and responsive interactions. Visitors should immediately understand the product, find a destination, and see how its features work.

Keep the existing “Play. Learn. Improve.” headline and the Play → Learn → Chess Coach → Community story. Use the hero as the main visual moment, then give product previews room to explain the features. End with a clear invitation to play.

The first release consists of phases 1–3 plus the verification in phase 5. Phase 4 contains optional enhancements that can ship independently later.

## Current implementation to build on

- `src/pages/general/LandingPage.tsx`: assembles the hero and four feature sections.
- `src/components/App/LandingHero.tsx`: headline, description, HOME button, and planet scene.
- `src/components/App/planetary/PlanetScene.tsx`: CSS-based planets rendered as ordinary React Router links.
- `src/components/App/planetary/planetConfig.ts`: game labels and route configuration.
- `src/components/App/planetary/planetScene.css`: planet appearance, layout, hover effects, and breakpoints.
- `src/components/App/FeatureSection.tsx`: alternating text and preview layout.
- `src/components/App/LandingGameCards.tsx`, `LearnShowcase.tsx`, `CoachShowcase.tsx`, and `CommunityShowcase.tsx`: existing product previews.
- `src/components/App/PublicHeader.tsx`: shared header and navigation controls; any landing appearance must be scoped to the landing route.
- `src/hooks/useReducedMotion.ts`: existing live reduced-motion preference hook.
- `src/i18n/ui.ts` and translation resources: preserve localization and add translations for new copy.

React 19, Vite, Tailwind, Three.js, React Three Fiber, and Drei are already dependencies. Motion is not currently listed. The README documents npm; use it consistently for this work and update `package-lock.json` when adding dependencies.

## Hero refinement — Games, Tools, Learn

The hero keeps “Play. Learn. Improve.” on the left. The right becomes one stable universe with a segmented tab control: Games, Tools, Learn. Default to Games on a new visit; no automatic tab rotation. Keep tab state local to the hero. The lower feature sections remain in place when the tab changes.

### Objects and content

| Tab | Visual language | Initial content | Destination |
| --- | --- | --- | --- |
| Games | Existing dimensional planets with game symbols | The existing seven game planets, with Chess as the prominent object | Existing game routes; all-games link `/games` |
| Tools | Squircle app tiles with bevels and distinctive app marks, floating in the same spatial arrangement | Percentage Calculator, Number-System Converter, Unit Converter, Recipe Scaler | `toolRoute(id)`; all-tools link `/tools` |
| Learn | Angled book covers with visible spines, page edges, subject symbols, and readable titles | Math foundations, Everyday percentages, Game guides, Game Analysis | `pathRoute(...)` for math paths and `subjectRoute(...)` for guides/analysis; all-learning link `/learn` |

Tools currently have CatalogIcon mappings rather than dedicated logo assets. Use those symbols as the first app identity: consistent tile shape, catalog accent, and a clear label. Add bespoke SVG app marks later through an explicit asset mapping; never infer asset filenames. Reuse those marks in the tools library and dashboard so the app identity stays consistent.

The initial Tools selection contains the four entries marked available in `toolApps`. Music, Football, and other planned subjects may be added as visibly marked previews later; do not present them as published courses. Books represent real subjects or paths, not invented downloadable books. Use shared availability metadata so status is consistent across the hero and Learn hub.

Show a curated set of four to seven objects per tab, with a persistent “All games / All tools / All learning” link. Give the most important object more visual weight while retaining readable labels for every destination. Object artwork can tilt; text and interaction targets stay upright and stable. On mobile, use an orderly two-column arrangement rather than squeezing desktop orbital positions into the viewport.

### Transition and interaction design

- Keep the scene frame, background, tabs, and surrounding page mounted. Reserve the scene's dimensions across all categories.
- Update the selected tab immediately. Use a short, damped spring for the active pill; respect reduced motion.
- Crossfade the category's object group with a small 6–10px movement and scale 0.98 → 1 over roughly 180–240ms. A 20–30ms stagger is optional; avoid making visitors wait through a long exit-then-enter sequence.
- Use stable spatial slots so switching feels like exploring the same universe. Planets, app tiles, and books share anchor positions; do not force a literal morph between their geometry or text.
- Keep the headline stable. The primary CTA follows the selected category: “Start playing” → `/games`, “Explore tools” → `/tools`, “Start learning” → `/learn`. The dashboard link remains available. Reserve enough CTA width for every translation.
- A short caption below the tabs explains the selected category. Object activation navigates directly to its real destination. Touch must not require a first tap to reveal a hover-only action.
- New tab selections supersede earlier transitions immediately. Disable interaction and remove exiting content from the accessibility tree during its decorative exit; only the active panel has reachable links. Use the active panel's semantic wrapper for focus safety, and animate an inert visual copy only if necessary.
- Keep keyboard focus on the tab trigger when switching categories. Use Base UI Tabs for tab roles and arrow-key behavior; its semantic state should change immediately even while decorative artwork is transitioning.

These timings are proposed values to tune. Emil Kowalski's principles guide the behavior: prompt feedback, small scale changes, responsive easing, motion with a purpose, and shorter animations for repeated actions.

### Component and data structure

Introduce a landing-specific `HeroUniverse` that owns the selected category and delegates:

- `UniverseTabs`: Base UI Tabs styled as a subtle frosted segmented control.
- `UniverseScene`: stable container, spatial slots, and decorative orbit/background layers.
- `UniverseItem`: one ordinary React Router link with an artwork wrapper and label.
- `PlanetArtwork`, `AppTileArtwork`, `BookArtwork`: category-specific appearance using CSS and existing symbols initially.
- `heroUniverseCatalog`: small curated selection built from shared catalog metadata and explicit IDs.

Use a typed entry with `id`, `category`, `title`, `description`, `href`, `accent`, `artworkKind`, `artworkKey`, `availability`, and `slot`. Keep selection/order and presentation in the hero configuration; titles, availability, and destinations should come from shared metadata. Preserve the existing planet configuration during the first migration.

`learningCatalog.ts` currently imports full lesson bodies. For this landing-only implementation, the four featured book titles and verified destinations are a small editorial selection in `planetary/universeCatalog.ts`; Tools uses the existing lightweight app catalog. Shared catalog restructuring is outside scope. Do not fetch progress, start engines, or load tool implementations just to display landing objects.

### Role of each visual tool

- Motion: category transitions, selected-pill movement, object feedback, and section reveals. Use AnimatePresence for decorative enter/exit layers and a scoped shared layout identifier for the selected pill if needed.
- Base UI: accessible tabs and existing navigation primitives. One tab implementation is enough.
- CSS/SVG: the first release's planets, app tiles, book geometry, and static atmospheric fallback. Reuse the existing icon system for marks.
- R3F/Drei: optional later depth, light, and material rendering. Use one persistent lazy-loaded Canvas shared across the tabs, with semantic HTML links as the interaction layer. Keep camera movement restrained and do not create a canvas for every item.
- ShaderGradient or Paper Shaders: one optional background whose palette gently follows the category. If R3F is already rendering the hero, prefer its scene background rather than stacking another animated canvas.
- Glass treatment: CSS frost/tint for the landing tab bar, with an opaque fallback. Do not add Liquid Glass React. Never distort tab text or place the whole catalog behind refraction.
- Liquid Logo: optional PLUTO brand accent outside the tab transition. App tiles need static recognizable marks, not seven continuously animated metallic logos.

### Delivery sequence and acceptance

1. Build the three static categories from real metadata, their routes, and responsive layouts.
2. Add tabs, contextual CTA, immediate semantic switching, and keyboard behavior.
3. Add Motion transitions and consistent hover/press/focus treatment.
4. Verify rapid switching, long translations, touch, keyboard focus, and reduced motion.
5. Compare optional 3D, shader, and optical glass effects against the verified CSS version.

Acceptance: changing tabs does not change the hero's height, focus cannot reach an inactive category, rapid clicking leaves the last requested category visible, all items have real working destinations, and both tool/learning availability match their hubs. No app implementations or lesson bodies load just to render this hero.

## Phase 1 — Layout, hierarchy, and copy

Deliver a complete static design before adding animation.

1. Introduce a landing-only wrapper and small set of shared visual tokens for backgrounds, text, borders, spacing, radii, and accent colors. Keep new styles scoped to this page.
2. Keep the two-column desktop hero. Give the headline and actions a clear reading order, and soften the planet panel's frame so the universe feels integrated with the page.
3. Replace the ambiguous HOME label with the contextual category CTA described above. Add a quieter “Open dashboard” link to `/dashboard`.
4. Build the Games / Tools / Learn hero described above. On mobile, place the headline and actions before the universe; use a two-column object arrangement with readable labels.
5. Refine the alternating feature sections with consistent spacing and preview framing. Keep text close to its relevant demonstration and avoid excessive empty height on small screens.
6. Add a compact final CTA, repeating “Start playing” with supporting copy about games and learning.
7. Check planet status badges against actual product availability. The current scene labels every non-primary planet “In progress”; visual prominence should not determine availability copy.

Acceptance: the page makes sense with animation disabled, actions lead to existing routes, translations fit, and no labels overlap at 360px width.

## Phase 2 — Motion foundation and hero

Use Motion for React, the animation library associated with Framer Motion. Install `motion`, use the documented `motion/react` entry point, and use `LazyMotion` with `m` components from `motion/react-m` if choosing the reduced bundle setup. Do not install both Motion and Framer Motion.

Keep the implementation small:

- A landing-scoped motion provider with `MotionConfig reducedMotion="user"`.
- A shared file of animation timings and variants.
- One reusable reveal component for below-the-fold sections.

Apply these initial animation specifications; tune them during visual review:

| Element | Behavior | Starting specification |
| --- | --- | --- |
| Hero description and actions | Gentle entrance on mount | 12–16px rise; 350–450ms; 60–80ms stagger |
| Planet artwork | Staggered arrival | 12px rise and scale 0.97 → 1; approximately 450ms; 50–70ms stagger |
| Planet hover | Small lift and highlight | 3–4px lift; scale up to 1.04; short damped spring |
| Buttons | Responsive hover and press | Hover scale up to 1.02; press scale 0.98; 120–180ms |
| Feature section | Reveal once near viewport entry | 16px rise; 400–500ms; approximately 20% visible |
| Preview cards | Small stagger inside a revealed group | 50–70ms between cards |

Keep the main headline readable on first paint and all links immediately interactive. Avoid delaying content behind an intro animation. Treat the timing values as design choices, not requirements from the library.

Put transforms on nested artwork wrappers rather than moving link hit areas. Assign CSS and Motion separate elements when they need different transforms; remove conflicting existing hover transforms. Reuse the project's reduced-motion hook for CSS loops, pointer effects, and any later canvas rendering: MotionConfig alone does not control those systems.

Acceptance: the hero settles within approximately one second, entrances do not restart on ordinary rerenders, keyboard focus remains clear, and reduced motion removes spatial movement and ambient loops.

## Phase 3 — Product demonstrations and interaction polish

1. Play: retain real game links and artwork; animate the card group into view and make hover/focus feedback consistent.
2. Learn: use the existing preview to show an understandable learning path. Keep motion brief and tied to selection or progression.
3. Chess Coach: preserve the existing chess demo and its sample review data. Animate explanation changes with a short crossfade or small transition that keeps controls stable. Do not remount the board during section reveals or add live engine work for decoration.
4. Community: show existing supported interactions clearly. If preview data is illustrative, keep it identifiable as a demo rather than suggesting real player counts or live activity.
5. Add subtle atmosphere around preview frames and consistent CTA feedback. Decorative overlays must not intercept pointer events.

Use viewport-triggered entrances for the initial implementation. Reserve scroll-linked parallax for decorative hero layers, with a small movement range, if visual review justifies it. Keep native page scrolling.

Acceptance: previews remain functional, dialogs retain keyboard behavior, navigation works on touch, and the page feels coherent without requiring every element to move.

## Phase 4 — Optional visual enhancements

Evaluate each enhancement independently after the first release. Compare screenshots and performance against the CSS version before keeping it.

| Enhancement | Implementation approach | Condition for keeping it |
| --- | --- | --- |
| Real 3D universe | One persistent lazy-loaded R3F/Drei layer for planets, app tiles, and books; retain semantic HTML links and shared metadata | Adds visible depth and interaction while preserving usable mobile navigation |
| Shader atmosphere | Choose one of ShaderGradient or Paper Shaders; constrain it to the hero background | Improves atmosphere without reducing text contrast or competing with planets |
| Frosted tabs | CSS frost, tint, and a subtle highlight on the landing-page tab control | Remains readable and functional in Chrome, Safari, and Firefox |
| Liquid logo | Use an exported animation in a reserved decorative area, with a static image fallback | Adds recognizable branding without making the primary navigation logo harder to read |

For canvas effects, reserve dimensions before loading, keep the CSS/static fallback visible while loading and on failure, cap rendering resolution, pause rendering when hidden or offscreen, and choose the static version for reduced motion. Start with one animated hero canvas and no postprocessing. Keep ambient loops slow and provide a pause mechanism if they run continuously.

Do not make the completion of optional effects a dependency for launching the core redesign.

## Phase 5 — Verification and release criteria

Capture a production-preview baseline before implementation, then compare the final version using the same viewport and performance settings.

- Review at 360, 390, 768, 1024, and 1440px widths, plus 200% zoom.
- Check the longest supported translations and verify all CTA and game destinations.
- Use keyboard navigation through planets, cards, menus, and the coach dialog; confirm visible focus and no decorative overlays blocking controls.
- Test reduced motion both on load and after changing the preference. Test touch without hover.
- Check Chrome, Safari, and Firefox, especially blur and any optional glass or canvas layers.
- Check that preview interactions do not reset on unrelated rerenders and that shared header changes do not alter the dashboard or game pages.
- Run `npm run build` and appropriate lint checks. Record existing unrelated failures separately if they prevent a clean repository-wide result.
- Measure production loading and scroll behavior. Aim for LCP ≤ 2.5s and CLS ≤ 0.1 under the agreed representative mobile test setup; treat these as targets to verify, not guaranteed results. Record added JavaScript and avoid loading optional 3D/shader code on dashboard and game routes.
- Save before/after screenshots and report which phases were implemented, the measured performance, and any remaining limitations.

## Suggested implementation batches

1. Static layout, copy, Games / Tools / Learn objects, shared metadata, and final CTA.
2. Accessible tabs, Motion setup, hero interactions, and feature reveals.
3. Preview transitions, browser/mobile review, and fixes.
4. Optional 3D, shader, glass, or logo experiments as separate changes.

## Official references

- Motion installation: https://motion.dev/docs/react-installation
- Motion reduced-motion handling: https://motion.dev/docs/react-accessibility
- Motion viewport and scroll animation: https://motion.dev/docs/react-scroll-animations
- LazyMotion: https://motion.dev/docs/react-lazy-motion
- Motion enter/exit transitions: https://motion.dev/docs/react-animate-presence
- Motion layout animations: https://motion.dev/docs/react-layout-animations
- Base UI Tabs: https://base-ui.com/react/components/tabs
- Emil Kowalski animation tips: https://emilkowal.ski/ui/7-practical-animation-tips
- Emil Kowalski on purposeful animation: https://emilkowal.ski/ui/you-dont-need-animations
- React Three Fiber: https://github.com/pmndrs/react-three-fiber
- Drei: https://github.com/pmndrs/drei
- ShaderGradient: https://github.com/ruucm/shadergradient
- Paper Shaders: https://github.com/paper-design/shaders
- Liquid Logo: https://github.com/collidingScopes/liquid-logo
