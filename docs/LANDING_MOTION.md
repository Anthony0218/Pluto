# Landing page: scroll choreography and demos

How the landing page's motion fits together, so it can be changed without re-deriving it. Code lives in
`src/components/App/landing/`; the page is assembled in `src/pages/general/LandingPage.tsx`.

## The page

1. **Hero** (`LandingHero`, `planetary/PlanetScene`): Games / Tools / Learn tabs. The selected tab is shared state in `LandingStage`. Tools and Learn show all available items in a responsive grid.
2. **Flyby** (`UniverseFlyby`): a pinned stage the camera pushes through. What flies past depends on the tab: game planets,
   app tiles or books. The hero artwork stays fully visible until the next section fills half the viewport, then crossfades into its flyby copies through the pinning point. The objects travel into the stage while the page scrolls toward it, then the camera
   arrives at the featured object (Chess, the first tool, the first book).
3. **Sections** (`LandingSections`): only the ones for the selected hero tab, then always Community and the closing call to action.
   - **Arrivals** (`ArrivalStop`): the flyby's last beat, repeated before every item but the first of its tab. After the Chess
     section the Schafkopf planet arrives full size in the middle of the screen with its name, one line and a play button, then
     travels behind the Schafkopf section; the same goes for every later game, tool and book. An arrival is a journey stop of its own
     (`data-arrival`; `StopMeta.arrival`), so the pose table puts the planet at the centre, scale 1, ring at its flyby tilt.
     Where nothing travels behind the page (stacked layouts, reduced motion) the arrival is a compact block with the item's
     artwork inline.
   - **Games**: one section per game, Chess has four demo tabs, Go two.
   - **Tools and Learn**: every available tool and every learning path, with the four editorial picks first, as in the hero. The
     flyby shows those four picks (`landingTools` / `landingBooks` in `planetary/universeCatalog.ts`; picks first, so the flyby hands over to the
     first section). One `ItemSection` per item, with the working tool or the book's contents on the left, and title,
     description and a button in the item's colour on the right. Add a tool by giving it a component in `demos/ToolsDemo.tsx`
     and an icon in `PlanetScene.tsx`; add a path by giving it a `BookDesign` in `pathDesigns` (`universeCatalog.ts`), a cover
     in `universeScene.css`, a short cover title in `planetary/landingCopy.ts` and button colours in `LandingSections.tsx`.
     The app tile or book cover (`JourneyItems`) travels behind the text instead of the planet: it arrives large (a little
     smaller than the planet, so the caption stays readable), faces front until its section, then settles behind the text,
     turning from item to item (`itemStops`/`itemWeight` in `landingMath.ts` say which stops belong to which item). It is never
     clickable; `data-planet="off"` fades the planet out. `TravelingCaption` and `useCaptionFlight` move each arrival title and subtitle into its section heading.
     `LandingStage` measures their layout offsets without transforms, keeping the path stable during resizes and lazy loading.
     The first item travels from the flyby caption; later items travel from their arrival. The destination text takes over
     at the end of the motion, while mobile and reduced-motion layouts keep ordinary static text.
   - Numbers follow the visible order of the sections (arrivals are not numbered), so each tab reads as its own 01, 02, 03…
     Game browsing starts with Chess, Schafkopf, Watten, preserving the rest of each list's existing order.
     Eat It's demo runs the real engine and 3D renderer from `src/games/eat-it`. Natura's preview uses the actual
     `NaturaScene` renderer and archerfish simulation, including aiming, catches, the rival AI and pause controls. Each section is a `FeatureSection` with a
     lazily loaded demo.
4. **Closing call to action** (`ClosingCta`).

A single planet travels behind the sections (`JourneyPlanet`, `JourneyCanvas`). It takes each section's colour
(`data-tone`), sits behind the text column (`data-side`, or in the middle for an arrival) and gains decoration where a section asks for it (`data-feature`:
`books`, `scan`, `moons`).

## Scroll plumbing

- The app scrolls inside `.app-viewport`, not the window. `useViewportScroll` (viewport.ts) wraps Motion's `useScroll` for it and
  marks the scroller `data-journey` so it is positioned, which Motion needs.
- `LandingStage` measures the layout (flyby range, section centres, hero object positions) and exposes motion values:
  `index` (journey position: -1…0 during the flyby, 1…n per section), `flyby` (0→1 while pinned) and `enter` (0→1 as the
  hero objects travel into the stage). All the maths is in `landingMath.ts` and is unit tested (`tests/landing-motion.test.mjs`).
- **Derived motion values must read every value they depend on unconditionally.** Motion subscribes to the values read during a
  computation's first run, so a conditional `.get()` can leave a value that never updates.

## Fallbacks

- Reduced motion: no journey, flyby, WebGL or cursor lighting; sections and demos still work, the constellation is fully drawn.
- Below 1024px: no flyby and no WebGL; the planet is a small, dim CSS element.
- No WebGL, or a lost context: the CSS planet underneath carries on (`JourneyCanvas` is a lazy chunk behind an error boundary).
- Browsers without `overflow: clip`: `.journey` falls back to `clip-path`.

## Checking changes

- `npm test` includes the landing maths and the card-game engine.
- `npm run check:landing` captures screenshots at 360, 390, 768, 1024, 1440 and 200% zoom (hero, flyby, Chess, Go, Tools, closing)
  and compares them with `scripts/landing/baseline/`. Run `npm run check:landing:update` to accept a deliberate change. It needs
  a running dev server (`--url=…`) and a local Chrome (`--chrome=…` or `CHROME_PATH`).
