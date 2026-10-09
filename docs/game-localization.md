# Game localization

Games use the existing shared language preference: English (`en`), German (`de`), Bavarian (`bar`), Korean (`ko`), Russian (`ru`), Spanish (`es`) and Portuguese (`pt`). The header selector changes the presentation without resetting a match.

`src/i18n/gameUi.ts` translates presentation strings. `useGameLanguage()` subscribes React components to language changes. The translation table uses `[source, en, de, bar, ko, ru, es, pt]` rows. Game state, storage keys, protocol values and React elements stay intact. Translate user-facing notices when rendering them, rather than saving translated strings in game state.

`{0}`, `{1}` and named placeholders retain values verbatim. `gameTemplateValues.json` lists slots containing built-in labels that may themselves be localized. Player names, room codes and move notation must not be listed there. Display player names directly, including names that happen to match a dictionary word such as “White”.

`gameTerms.ts` preserves regional card and contract names (including Blaue and Pumpe), declarations and established notation. Their explanations are translated. Language-quiz sentences retain their original language because they are the clue being tested. Atlas country names and search options use localized names while retaining canonical aliases.

## Translation status

The bulk additions are translation drafts. Core Schafkopf vocabulary, the glossary and introductory rules have been reviewed; those rows are also recorded in `scripts/i18n/reviewed-game-translations.json`. New Bavarian prose is derived from the German text and still needs dialect review.

The work is not fully translated yet. `gameTranslationPending.json` explicitly lists source texts and language columns that currently contain a source-language fallback. It must be updated as these translations are completed; a non-empty table column alone does not establish translation coverage. No translation requests are made by the app at runtime.

Run `node scripts/i18n/check-games.mjs` to audit source coverage and remaining translations. It exits unsuccessfully while translations remain pending. `node --test tests/game-translations.test.mjs` checks structure, placeholder preservation, regional terminology, dynamic values and country localization; it does not certify translation quality or completion.
