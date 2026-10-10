# schafkopf_rebuild integration into feat/bugfixes

Source: `origin/schafkopf_rebuild` at `0c59870`. Local starting point: `86bb5ec`.
Backup: `backup/feat-bugfixes-before-schafkopf-rebuild-20261010`.

The complete remote branch history is merged locally. No remote push or database/function deployment is part of this change.

## Incoming commits

- `abc3b0c` feat(schafkopf): refresh table and game experience
- `8cf4589` feat(i18n): add shared game translations and coverage auditing
- `418130c` feat(schafkopf): localize game screens and rulebook
- `b7c1269` feat(watten): localize matches, lobbies and rules
- `f88df35` feat(chess): localize variants, multiplayer and analysis screens
- `6f7b2de` feat(chess-custom): localize variant editor and simulation
- `9097c32` feat(card-builder): localize editor, play and simulation
- `2dfe6b6` feat(atlas): localize arena, trials and match results
- `3918def` feat(medieval-kingdoms): localize world, battles and minigames
- `95053d1` feat(party): localize board, lobby and minigame screens
- `dd51b3c` feat(natura): localize matches and canvas scene labels
- `60a813c` feat(strategy): localize Go, Shogi and ranked views
- `ecf6f0d` feat(eat-it): localize arena and collection screens
- `39af36e` feat(nutrition): add nutrient storage, recipe sharing and label scan
- `1325c49` feat(tools): add ToDo history and connected shopping lists
- `3c6185f` feat(nutrition): redesign tracker with foods, macros and recipes
- `0c59870` feat(nutrition-site): include standalone Naehrwert Kompass files

## Integration choices

- Keep the newer local game logic, responsive layouts, Atlas touch/keyboard gestures, multiplayer invitation routing, and XP rewards.
- Incorporate the scene/simple Schafkopf interfaces, responsive table controls, accessible dialogs, card tabs, coaching, next-level offers, per-variant tariffs, shared avatars, and host-controlled AI difficulty.
- Retain friend-invite buttons and online XP in the redesigned Schafkopf screens.
- Add the ToDo/history/shopping-list workspace, bill links, nutrition database/macros/recipes, and standalone Naehrwert Kompass assets.
- Keep the first four existing tools in their original catalog order; add ToDo List afterward.
- Preserve saved nutrition records and meal templates. Restore adjustable recipe portions and the option to save an individual meal. Validate fractional recipe sizes without mutating templates.
- Assign the incoming nutrition migration the unused version `20261115000000`, keeping existing local migration identifiers intact.
- Retain the incoming localization dictionary and record 629 newer local game strings as pending translations. Pending entries preserve their source wording; they are not represented as completed translations. Add missing tool-status translations in the existing six-language tool dictionary.
- Update isolated UI test mocks for the translation module, keeping the newer local assertions.
- Fix the nutrition scanner to read typed `output` messages from HTTP responses; `output_text` is an SDK helper, per [official OpenAI documentation](https://developers.openai.com/api/docs/guides/text). The scanner tests use mocked responses and make no paid API calls. Document its server secrets in `.env.example`.

## Verification

- Production build: passed (`npm run build`, including application, Party, and Natura TypeScript checks).
- Schafkopf: 115 tests passed, including 250 complete AI games, legal moves/scoring, server authority, shared avatars, and difficulty configuration.
- Integration checks: 75 tests passed across game/learning translation coverage, migrations, nutrition parsing and saved meal compatibility, ToDo/shopping-list storage, calculator/catalog, invite routes/room leave, and chess XP.
- Real local networking: 44 tests passed across Edravane and Party after allowing localhost sockets.
- Full baseline suite: 1,844 tests; 1,814 passed and 30 failed. Fourteen failures were sandbox socket restrictions; all relevant network tests passed on rerun with sockets enabled.
- Full initial merged suite: 1,866 tests; 1,823 passed and 43 failed. The 13 added failures were fixed and passed in targeted retests. The full expensive simulation suite was not rerun after these integration fixes.
- All 234 local-only changed files were preserved byte-for-byte.
- Desktop/mobile browser smoke checks cover Schafkopf menu, persisted interface preference, AI/hotseat, multiplayer login screen, dialog focus/Escape, ToDo and shopping-list routing, nutrition, and calculator. Online production services and real label recognition require deployment/configuration and are not exercised by these local browser checks.

## Existing failures remaining outside this merge

- `tests/atlas-random-series.test.mjs`: final scorecard names each game winner and marks the unused third game
- `tests/atlas-random-series.test.mjs`: local series Continue waits for both players and ignores a repeated click
- `tests/atlas-random-series.test.mjs`: trial completion reports the actual final score once without an extra results click
- `tests/auth-profile-session.test.mjs`: signed-in users retain the profile while profile data is loading
- `tests/auth-profile-session.test.mjs`: profile renders the loaded player name immediately without a blank first frame
- `tests/auth-profile-session.test.mjs`: token and focus events for the same account do not restart the stats load
- `tests/auth-profile-session.test.mjs`: profile header shows all ranks on General and only the selected game's ranks on game tabs
- `tests/casual-invites.test.mjs`: each open Party seat opens its own room invite without relying on the URL
- `tests/chess-ranked-queue-client.test.mjs`: Go restores both supported modes and replaces removed presets with Normal while Chess retains its defaults
- `tests/eat-it-network.test.mjs`: prediction is bounded during a network outage and respects solid scenery
- `tests/eat-it-readability.test.mjs`: scaled animals give the same fixed base reward
- `tests/learning-tools-foundation.test.mjs`: catalog routes are unique and all learning/tool cross-links resolve
- `tests/multiplayer-invite-progression.test.mjs`: game picker covers every game and preserves its selected online settings
- `tests/registration-feedback.test.mjs`: confirmation box contains English spam reminder and switches to German with the active language
- `tests/registration-feedback.test.mjs`: immediately signed-in registrations do not ask users to check email or spam
- `tests/registration-feedback.test.mjs`: failed registrations display an error without a success or spam message

## Deployment dependencies

Cloud recipe sharing requires the nutrition SQL migration. Shared Schafkopf avatar/difficulty operations require deployment of the updated `schafkopf-multiplayer` function. Label scanning requires deployment of `nutrition-scan` and its server-side `OPENAI_API_KEY`; `NUTRITION_SCAN_MODEL` is optional. No secrets were read or changed.
