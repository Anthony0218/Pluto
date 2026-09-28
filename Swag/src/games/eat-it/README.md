# Eat It

Open `/games/eat-it`, choose City or Nature, choose 2–8 participants, then start a bot game or an authenticated multiplayer room. WASD/arrow keys move; dragging creates a floating joystick for touch and mouse. Escape pauses solo play. An eliminated player spectates until the final result. F3 shows colliders, direction, velocity, bot state and the radius threshold in development builds only.

## Architecture and reused systems

- The existing React Router tree lazy-loads the game. `src/data/games.ts` supplies the games page, landing cards, navigation, favorites and planets.
- React renders menus, rooms, results and the HUD (10 Hz). Canvas 2D renders the arena through `requestAnimationFrame`. Scenery is cached once per map; characters and food are vectors, not bitmap backgrounds or 3D models. No dependencies were added.
- Serializable TypeScript rules run at a fixed 30 Hz in solo play and the Supabase Edge Function. A single square-root mass-to-radius function controls logical size. Rendering independently smooths growth and camera zoom.
- Food has planar velocity, friction, pushes and an independent height/vertical velocity for falling and bouncing. Solids use circle/rectangle collision. Mouth consumption uses a front sector plus a mouth-localized sensor and line-of-sight. Food is claimed, drawn travelling into the mouth and then rewarded exactly once. Victims are eliminated immediately by the authority and animated locally for 0.56 seconds.
- Spawn management caps food at 180 and ground power-ups at 7. It cycles map sectors, rejects solid/player/food overlaps and respects the closing boundary.
- Bots use only nearby visible players, food and power-ups. They forage, flee with a sideways escape, hunt, seek power-ups and reposition around obstacles/the closing ring. They receive no mass or movement advantages.
- Supabase auth/profile names, the established Edge Function + optimistic room version + Postgres Realtime pattern, existing friend messages/dialogs, shared language store and shared audio settings are reused. No client-host authority or extra socket service exists.
- Input requests are bounded to one in flight per client, normally every 125 ms, with a 5-second request timeout and cancellation on exit. Clients submit direction only. Server-clock fixed steps, normalized inputs, membership checks, shield checks, and compare-and-swap retries protect state. A bounded snapshot buffer interpolates remote transforms 120 ms behind receipt, with at most 160 ms of movement extrapolation. Local movement is predicted for responsiveness; mass, bites, rewards and eliminations are never predicted. Stale input stops after 650 ms and a disconnected human forfeits after 20 seconds. Departed/disconnected hosts transfer ownership. Result recording retains all original humans; the next lobby removes departed seats.
- Lobby reads are idempotent apart from infrequent heartbeats, so receiving a Realtime update does not create an endless write/read cycle. Concurrent joins retry enough times for all eight seats. Navigation or account changes remount the room session instead of carrying an old match into a new route.
- Finished online matches write once into the existing immutable `user_game_results` ledger through a database trigger. The profile's existing aggregate shows Eat It games and wins. Detailed result fields are stored in its `details` JSON. Local bot games are explicitly practice and do not submit unverified profile stats.
- Audio is procedural Web Audio (snacks, bites/chews/gulps, collisions, power-ups, elimination, victory and light City/Nature ambience), using the site's master/effects/music/mute settings. Audio starts after a user gesture.
- All UI strings use the existing translation lookup. Core game labels/results have all seven site languages; additional instructions have English/German, with the existing language fallback for missing entries.

## Balance

All values live in `config.ts`. Starting mass 36 gives radius 24. Radius is `clamp(4 * sqrt(mass), 14, 132)`. Base speed is 210 units/second, acceleration 760, friction 6; the mass speed curve has exponent −0.14 with a 58% floor. Eating needs **1.20× radius** (1.44× mass before radius caps), a 115.2° front sector, mouth contact and no shield. Player mass transfer is 70%. Mouth food capacity is 49% of radius. Berry/mushroom are small; apples/donuts/soda/fries/cupcakes medium; burgers/pizza/melons large. Food gives 2–22 mass. Speed is 1.5× for 6 seconds, Shield 5 seconds, Magnet 7 seconds and Growth is **permanent +30 mass**. The arena starts closing at 90 seconds and reaches its center at 300 seconds; being outside loses 18 mass/second until elimination. Victory always requires one survivor, not simply the highest timer score.

## Backend deployment

Solo games work with just `npm run dev`. Online rooms require the new database migration and Edge Function on the same Supabase project already used by the app:

```sh
npx supabase db push
npx supabase functions deploy eat-it-match
```

Review pending migrations before `db push`, since it applies all pending migrations. `20260928230000_eat_it.sql` creates the room table/RLS/Realtime subscription, registers result recording, permits Eat It friend invites and visit tracking. `config.toml` disables the gateway JWT check for this function because the function authenticates every request using `auth.getUser` before accessing the service role. No client can write room state or verified results directly. Do not expose the service role key to Vite.

## Validation

`npm run test:eat-it` covers gameplay, bot perception, complete 2/4/8 participant matches on both maps, authority, invalid/replayed input, lobby permissions, disconnects, rematches and single rewards. `npm run build` checks the frontend; `deno check --no-config --node-modules-dir=none supabase/functions/eat-it-match/index.ts` checks the Edge Function. Browser checks cover setup, maps, player counts, movement/eating, mobile viewport, localization and no horizontal overflow. Screenshots and the local CDP verification scripts are in ignored `.dashboard-check/`.

Validation on implementation: 49 Eat It tests passed; the full existing suite reported 206 passed, 1 skipped, 0 failed. The production build, targeted ESLint check and Deno check passed. The new endpoint tests execute the real Edge handler with mocked auth/database boundaries, following the repository's Schafkopf test pattern; they exercise eight-human join races, conflicting inputs, one-time rewards, request validation, disconnected hosts and rematches. Client tests cover interpolation, prediction bounds, immutable authoritative state, stale delivery, cancellation and recovery. Chromium tested both arenas at 2/4/8 participants across 1440px and 390px widths. Deterministic browser fixtures also exercised actual arena/results components: food growth, all four HUD effects, player consumption, pause/resume, touch movement and release, results statistics, replay/lobby actions, and removal of the gameplay overlay. No browser runtime errors remained. Live hosted rooms and migration execution have not been tested.

## File inventory

Created:

- `src/games/eat-it/{config,types,maps,spawn,rules,bots,engine,renderer,audio,network,authority,presentation}.ts` and this README.
- `src/pages/games/EatIt/{EatItPage,EatItArena,EatItResults}.tsx` and `eat-it.css`.
- `src/i18n/eatItTranslations.json`, `public/images/eat-it.svg`, `tests/eat-it.test.mjs`, `tests/eat-it-multiplayer.test.mjs`, `tests/eat-it-network.test.mjs`.
- `supabase/functions/eat-it-match/index.ts`, `supabase/migrations/20260928230000_eat_it.sql`.

Modified:

- `src/main.tsx`, `src/data/games.ts`, `src/components/App/planetary/planetConfig.ts` for routes and discovery.
- `src/components/social/{RoomFriends,FriendChat}.tsx` for existing friend invite routing.
- `src/pages/social/ProfilePage.tsx`, `src/i18n/ui.ts`, `supabase/config.toml`, `package.json` for profile stats, translations, function configuration and the test command.

## Operational limits

The existing backend uses request-driven Edge Functions, not a continuously running simulation process. Rooms advance as connected clients send heartbeats; after an outage, catch-up is bounded to one second and disconnected players forfeit. Every accepted input currently persists a full snapshot. The 8 Hz request rate and Realtime/database bandwidth need hosted two-browser and eight-human load testing before a public launch. This implementation does not deploy remote schema/functions automatically. There is no ranked matchmaking, group-room sharing, or solo cloud history. The provided attachment contained the written brief only, so the vector artwork follows its flat-circle direction without a reference-image comparison.
