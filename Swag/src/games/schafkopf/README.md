# Schafkopf

Entry: `/games/schafkopf`. Local modes work without a backend or login.

- `schafkopf.ts`: pure shared engine, immutable transitions, legal-card reasons, redacted player views and heuristic AI (own hand + public information only).
- `../../components/Schafkopf/SchafkopfGame.tsx`: hotseat and AI.
- `../../components/Schafkopf/SchafkopfMultiplayerGame.tsx`: authenticated four-player rooms.
- `../../pages/schafkopf/`: menu and lobby.

## Rules

32-card Schafkopf: Rufspiel, Farbwenz, Wenz, Solo, their legal Tout forms, Sie, intention/negotiation/declaration, positional bid precedence, all-pass redeal, forced following, Ruf-Sau protection, Davonlaufen, Kontra/Re, 61/60 victory, asymmetric Schneider, Schwarz and Laufende. Based on the [Schafkopfschule April 2024 rules](https://schafkopfschule.de/regeln.html). Physical handling and conduct rules are represented by the digital deal and validation; no physical cutting interaction is required. Regional variants (Geier, Ramsch, short deck, Stock, Legen, Bock) are not enabled.

Table convention: virtual units only, Rufspiel 1 / solos 5 / bonus 1. Laufende minimum 3 (Wenz 2), maximum 14 for Rufspiel, 4 for Wenz, 8 otherwise. Tout doubles base + Laufende; Sie quadruples solo + 8 Laufende. No Schneider/Schwarz surcharge on Tout/Sie. Kontra/Re ×2/×4. All tricks are played out, including a lost Tout. There is a turn-based Kontra/Re window before play so hotseat players get an opportunity; online players can also double before the second card of the first trick.

Hotseat passes the device with cards hidden; this is privacy between normal players, not protection against inspecting local JavaScript memory. The AI is a lightweight heuristic, not an expert solver.

## Backend setup

The multiplayer backend must be deployed to the same Supabase project used by `VITE_SUPABASE_URL` and `VITE_SUPABASE_PUBLISHABLE_KEY`. From `Swag/`, with the CLI linked to your project:

```sh
npx supabase db push
npx supabase functions deploy schafkopf-multiplayer
```

Review pending migrations before pushing to an existing database. The migration is `supabase/migrations/20260924150000_schafkopf.sql`. The function imports the same engine as the client using a relative path; deploy from this repository so it is included in the bundle. Supabase supplies `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` to the function. Never put the service role key in Vite variables.

The table has RLS enabled and no client grants or policies. Every request verifies the user's bearer token with `auth.getUser`. Hands and the hidden partner never leave the function except for the requesting player's own private view. No hidden table contents are broadcast through realtime. Polling every 1.5 seconds restores authoritative state after reconnects. Database compare-and-swap on `version` prevents two moves or joins from overwriting each other. No browser is the authoritative host.

Four distinct signed-in accounts are required. Waiting players can leave; host ownership then transfers. After starting, seats remain reserved for reconnecting players; no bot takeover, kicks or midgame replacement. The host starts subsequent rounds. An absent player pauses progress until they return. Rooms persist; administrators can remove stale rooms by `updated_at` as appropriate for their retention policy.

## Verification

```sh
node --test tests/schafkopf*.test.mjs
npx eslint src/games/schafkopf src/components/Schafkopf src/pages/schafkopf supabase/functions/schafkopf-multiplayer/index.ts
npm run build
```

Online smoke test after deployment: create a room in one account and join with three others; check simultaneous joins and a rejected fifth seat; start, reconnect, play a full round, verify locked cards and hidden opponents' hands in network responses, then start the next round. Also test expired authentication and retry after a network interruption.

Automated endpoint tests run the real Edge handler with mocked authentication and an atomic in-memory database. They cover access control, private views, conflicting joins/moves, reconnection, host transfer and server-side rejection of illegal cards. They do not replace a deployed Supabase integration test.
