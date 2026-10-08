# Schafkopf

Entry: `/games/schafkopf`. Local modes work without a backend or login.

- `schafkopf.ts`: pure shared engine, data-driven trump/rank definitions, immutable transitions, legal-card reasons and redacted player views.
- `bot.ts`, `botConfig.ts`, `knowledge.ts`: shared document-based bot pipeline and public information sets.
- `coach.ts`, `lessons.ts`: coaching/review and random learning cards.
- `docs/`: unchanged copies of the three supplied original documents.
- `../../components/Schafkopf/SchafkopfGame.tsx`: hotseat and AI.
- `../../components/Schafkopf/SchafkopfMultiplayerGame.tsx`: authenticated online rooms with human and AI seats.
- `../../pages/schafkopf/`: menu and lobby.

## Rules

32-card Schafkopf: Rufspiel, Farbwenz, Wenz, Solo, their legal Tout forms, Sie, optional Legen/Klopfen after the first four cards, intention/negotiation/declaration, positional bid precedence, forced following, Ruf-Sau protection, Davonlaufen, Kontra/Re/Sub/Hirsch, 61/60 victory, asymmetric Schneider, Schwarz and Laufende. After four passes the table can redeal, play Ramsch, or require the Eichel-Ober holder to call a card. In a forced call, missing aces of held plain suits take priority; otherwise the highest missing lower card in a held plain suit is available. Based on the [Schafkopfschule April 2024 rules](https://schafkopfschule.de/regeln.html). Physical handling and conduct rules are represented by the digital deal and validation; no physical cutting interaction is required. Regional variants (Geier, Ramsch, short deck, Stock, Bock) are not enabled by default.

Table convention: virtual cent values, Rufspiel 10 / Solo and Wenz 30 by default, with adjustable bonuses. Laufende minimum 3 (Wenz 2), maximum 14 for Rufspiel, 4 for Wenz, 8 otherwise. Tout doubles base + Laufende; Sie quadruples Solo + 8 Laufende. No Schneider/Schwarz surcharge on Tout/Sie. Each knock doubles the value; the 1 € coin is a table marker, not a payment. Kontra is allowed on an opponent's first card; Re, Sub and Hirsch follow on successive tricks and double the value each time. In Ramsch, the player with the most eyes pays the other three the selected base value. All tricks are played out, including a lost Tout.

Hotseat passes the device with cards hidden; this is privacy between normal players, not protection against inspecting local JavaScript memory. Local games and their score ledger are saved in browser storage. The bots use the imported rulebook in `docs/`, shared `knowledge.ts`, hard candidate restrictions (R1–R6b) and tier-specific tips T1–T12. `bot.ts` receives only a redacted player view. All random decisions accept an injected PRNG; `botConfig.ts` contains configurable thresholds, reliability values and search budgets.

AI levels are Anfänger, Amateur, Fortgeschritten, Profi and Legende. Anfänger randomly chooses inside R-rule candidates and uses no tip scoring or round memory. Amateur uses only H knowledge; Fortgeschritten adds public card/void tracking. Profi weights tips, uses exact points and basic allocation probabilities. Legende uses root information-set MCTS: UCB over permitted actions, constrained sampled hands, and complete-round rollouts whose seats receive redacted views. Default: 200 iterations / 180 ms with minimum exploration; not a guaranteed simulation count. Announcement and spritz simulations play sampled allocations through round scoring using configured tariffs. They are estimates, not proven win probabilities.

Rulebook → Bot/KI exposes the tip matrix, hand thresholds and simulation budget. The complete original Markdown documents are rendered and downloadable under Grundregeln, with a searchable learning index. The user clarifications in `docs/klarstellungen-2026-10-05.md` supersede conflicting original text. Remaining questions and the exact verification status are recorded in `IMPLEMENTATION.md`.

Anfänger displays one random rule; Amateur one rule or tip; Fortgeschritten one tip. Profi/Legende have no automatic learning banner. Every completed trick can be reviewed during and after play. Review reconstructs the own hand, prior public tricks, point totals, called-ace revelation and doubling events before the reviewed move. Future cards and final hidden team membership cannot influence the recommendation. The collection delay defaults to 6/5/4/3/2 seconds by level and can be set to 1–10 seconds in Rulebook → Design. In online rooms the host sets this delay for the whole table.

Under Rulebook → Design, a player can choose the Ruf-Sau name, a grammatically matching lead-in, Solo or Sticht, or enter custom announcement text. Empty choices use randomized standard phrases. These preferences are stored on that device; a chosen game announcement is sent with the move so all players see the same text. Hovering over it reveals the canonical contract or called ace. Automatic hand sorting runs again after a declared game except Sauspiel and Herz-Solo; manual card order then remains in place.

## Backend setup

The multiplayer backend must be deployed to the same Supabase project used by `VITE_SUPABASE_URL` and `VITE_SUPABASE_PUBLISHABLE_KEY`. From `Swag/`, with the CLI linked to your project:

```sh
npx supabase db push
npx supabase functions deploy schafkopf-multiplayer
```

Review pending migrations before pushing to an existing database. The room schema begins in `supabase/migrations/20260924150000_schafkopf.sql`; saved game days, names, AI difficulty and per-account hiding are added in `supabase/migrations/20260927120000_schafkopf_sessions.sql`. Seat changes and archived results are added in `supabase/migrations/20260927130000_schafkopf_seat_changes.sql`. The five AI levels and shared collection delay require `supabase/migrations/20260927150000_schafkopf_ai_difficulties.sql`. Deploy the migrations and function together: the current function expects these columns and the hidden-room table. The function imports the same engine as the client using a relative path; deploy from this repository so it is included in the bundle. Supabase supplies `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` to the function. Never put the service role key in Vite variables. If starting a table reports that only the host may start a full table, the deployed function is older than this repository and must be redeployed.

The table has RLS enabled and no client grants or policies. Every request verifies the user's bearer token with `auth.getUser`. Hands and the hidden partner never leave the function except for the requesting player's own private view. No hidden table contents are broadcast through realtime. Polling every 1.5 seconds restores authoritative state after reconnects. Database compare-and-swap on `version` prevents two moves or joins from overwriting each other. No browser is the authoritative host.

One to four signed-in accounts can join a game day. On start, the server fills the remaining seats with AI (up to three). The host chooses the AI difficulty. AI actions run on the server during polling, with a short delay so moves remain visible. During play the host can hand any human seat to AI; that player or the host can return control. This is manual backup, not automatic disconnect detection. Between games the host can free a guest seat. Another account can take an AI seat with the room code, including a seat that was just freed. The previous player's score is archived in the saved game day and the new player starts at zero in the next round. The host starts subsequent rounds.

Each room is a saved game day. The authenticated lobby lists the user's game days, human/AI constellations, round and account totals. The room's full game JSON stays server only; list responses return safe summaries. The host can delete a day for everyone after confirmation. Other participants can remove it from their own list without affecting the shared room. A hidden participant can still rejoin through the direct room link. The server limits the list to the 100 most recently updated rooms; older history needs pagination if usage grows. Administrators may add a retention policy for stale rooms.

## Verification

```sh
node --test tests/schafkopf*.test.mjs
npx eslint src/games/schafkopf src/components/Schafkopf src/pages/schafkopf supabase/functions/schafkopf-multiplayer/index.ts
npm run build
```

Online smoke test after deployment: create a room with one account and start with three AI seats; verify AI moves and saved scores. Create another with multiple accounts, check simultaneous joins and a rejected fifth seat, manually hand a seat to AI and return it, reconnect, play a full round, verify locked cards and hidden opponents' hands in network responses, then start the next round. Check the saved list from two accounts and both deletion behaviors. Also test expired authentication and retry after a network interruption.

Automated endpoint tests run the real Edge handler with mocked authentication and an atomic in-memory database. They cover access control, private views, conflicting joins/moves, reconnection, host transfer, AI seats, game-day lists/deletion and server-side rejection of illegal cards. They do not replace a deployed Supabase integration test.

## Reproducible simulations

```sh
node scripts/simulate-schafkopf.mjs --games 10000 --profile quick --output /tmp/schafkopf-quick.json
node scripts/simulate-schafkopf.mjs --games 10000 --profile standard --output /tmp/schafkopf-standard.json
```

The quick profile checks full games at reduced search depth (one rollout per Legend decision). It cannot establish the relative strength of the standard Legend configuration. Reports contain win rates, eyes, announcement frequency, declarer wins, score deltas and legality/candidate checks. A standard-depth balancing run remains necessary before claiming a statistically separated skill hierarchy.
