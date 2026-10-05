# Learn and Tools

Milestone 1 provides a subject hub, learning-path outlines, a shared lesson
framework, and an app launcher. Milestone 2 publishes the Math foundations
course. Milestones 3 and 4 publish Everyday percentages and four working tools.
Other subject courses and tool functionality follow in later milestones;
preview pages are explicitly marked as coming soon.

## Math foundations (milestone 2)

`/learn/math/foundations` contains six lessons: addition/subtraction,
multiplication/division, negative numbers, fractions/decimals, order of
operations, and estimation/checks. Each math lesson has Learn, Explore, and Practice
stages, a worked example, an accessible interactive visualization, and a Did you
know? box. Practice includes the former check questions (50 exercises in total).
Addition/subtraction includes dot diagrams, a step-by-step notebook guide for
carrying and borrowing through zero, and four written-calculation exercises that
check the answer digits and carry/regrouping marks. Checks explain exact
inverse operations, alternate decompositions, units, and the limitations of
estimates. Sliders and answers work with the keyboard.

`src/data/mathFoundations.ts` owns the pure course content and exercise IDs.
`MathFoundationLesson` supplies the activities to the shared shell. Numeric
answers use a strict parser and BigInt rational comparison, without expression
evaluation or floating-point tolerance. Equivalent fractions and terminating
decimals are accepted, with a decimal point or comma. Repeating decimals need
an exact fraction; zero denominators, units, separators for thousands, expressions,
and scientific notation are rejected. Inputs are limited to 12 digits per numeric
part. A wrong answer invites another attempt; hints are available before a solution.

Solved exercise IDs are stored separately from reading completion. Opening a
solution does not award exercise completion. The course overview shows both
counts and lets users start, continue, or review. Practice again resets exercises
for one lesson, after an inline confirmation, while keeping reading/bookmarks.
This is self-directed practice, not a secure assessment or a mastery rating.
All Learn content, including subject/path outlines, explanations, hints,
solutions, diagrams, and controls, supports English, German, Bavarian, Korean,
Russian, Spanish, and Portuguese.

## Routes and catalogs

- `/learn`: subject hub, introduction, reading progress, bookmarks.
- `/learn/start`: published orientation using the shared lesson shell.
- `/learn/:subjectId`: subject paths, existing game guides, or Game Analysis.
- `/learn/game-analysis`: Chess Analysis and Go Analysis (their original routes remain valid).
- `/learn/:subjectId/:pathId`: path outline, published lessons, related tools.
- `/learn/:subjectId/:pathId/:lessonId`: published subject lesson.
- `/tools`: 13 app buttons, search, category filters, favorites, recent views.
- `/tools/:toolId`: a working app for the four available tools; other apps show a preview.

`src/data/learningCatalog.ts` defines subjects, paths, and published lessons.
Only published lessons are eligible for saved progress. Do not register planned
outlines as completed lessons. Existing game guide routes remain unchanged.
`src/data/toolCatalog.ts` defines the individual apps and cross-links to learning.

## Adding a lesson

Add a lesson with a stable ID, subject/path IDs, its direct route, and sections
for Learn, Explore, Practice, and Check. Math lessons render the Check content
as an inline Did you know? box and use three stages. `LessonLayout` supplies navigation,
bookmarks, reading completion, and saved position. Its optional `activities`
prop accepts subject-specific React content for each stage. Add a specialized
lesson component/route when an interactive lesson needs it; do not store React
components in the pure-data catalog. Keep practice separate from reading and
register stable exercise IDs in `mathExerciseIds.ts` for math courses.

## Browser persistence

`learningToolsProgress.ts` validates versioned snapshots under
`pluto-learning-tools-v1:<account-id>` (`guest` when signed out). It stores lesson
stage/read status, solved exercise IDs, bookmarks, app favorites, and the six
latest app page views. Milestone 1 snapshots without exercise data still load.
Old math snapshots saved on Check resume on Practice without losing solved
exercise IDs, bookmarks, or reading completion. State is isolated by account, survives reload, notifies subscribers, and responds
to storage events from other tabs. If storage is blocked or full, changes remain
usable for the current session. This is browser-local persistence, not Supabase
sync. Do not claim device synchronization or attach this state to game rankings.
No Supabase migrations or Edge Function deployments are required for milestones
1 through 4.

New text uses the existing `ui` translator. `learnContentTranslations.json` stores
rows in English/German/Bavarian/Korean/Russian/Spanish/Portuguese order.
`milestoneToolsTranslations.json` adds percentage lessons and tool text in the
same language order. `learning-translations.test.mjs` checks active Learn and Tools prose in every
language, including Bavarian entries without relying on the German fallback.

## Remaining milestones

Milestones 1 through 4 are implemented.
5. Algebra/functions and Function Plotter.
6. Derivatives/integrals.
7. Linear algebra.
8. Analysis in depth.
9. Probability/statistics.
10. Music pitches and notation.
11. Music rhythm and combined reading.
12. Football rules and interactive situations, with a stated IFAB edition.
13. Football positions, roles, formations, tactics.
14. Day Planner, Time-Zone Planner, basic in-app task reminders.
15. Workout Timer, optional break reminders.
16. Bill Splitter, then shared groups/balances.
17. Budget Tracker and Subscription Tracker.
18. Calorie Tracker.
19. Weather Explorer.
20. Background notifications and cross-device delivery checks.

Signal processing follows the core roadmap.

## Validation

`node --test tests/learning-tools-foundation.test.mjs tests/math-foundations.test.mjs` covers persistence,
account isolation, corrupt storage, unavailable storage, cross-tab updates,
recent-view limits, and catalog reference integrity. Also run the production
build and inspect Learn, Tools, lesson progress, favorites, and navigation on
desktop and narrow screens.
The math suite also covers equivalent rational answers, malformed input, repeating
decimal labels, all 50 exercise answers, per-account exercise resets, and backward
compatibility with milestone 1 snapshots.

`node --test tests/paper-arithmetic.test.mjs tests/learning-translations.test.mjs`
checks carrying, chained borrowing, written-answer grading, old math stage
restoration, and complete Learn translation coverage.

## Everyday percentages and working tools (milestones 3–4)

`/learn/math/percentages` publishes nine lessons matching the nine roadmap
scenarios, with 27 exact-answer exercises, worked examples, an interactive
calculator, and inline Did you know? checks. It uses the same three math stages,
account-isolated progress, bookmarks, and reveal-without-credit behavior as
foundations. `everydayPercentages.ts` owns its course data; `mathExerciseIds.ts`
combines both course registries. Existing progress snapshots remain compatible.

Four tool routes are available:

- `/tools/percentage-calculator`: amount, share, discounts, successive discounts,
  hypothetical VAT, changes and their inverses, percentage points, compound
  growth, tips/equal shares, and serving changes. Includes formulas and checks.
- `/tools/number-system-converter`: exact BigInt signed integers in bases 2, 8,
  10, and 16, up to 256 digits, place-value decomposition, and a 16-bit editor.
  Negative numbers use sign-and-magnitude display, not two's complement.
- `/tools/unit-converter`: length, mass, absolute temperature, speed, area,
  volume, and data size, including decimal/binary prefixes and US liquid units.
  Uses NIST definitions, affine temperature conversions, reverse checks, and
  selectable display precision. No density or temperature-difference conversions.
- `/tools/recipe-scaler`: named ingredients, decimal/fraction quantities,
  proportional scaling, reusable recipes, and confirmed deletion. Recipe content
  stays user-authored when the UI language changes. Supports up to 100 ingredients
  per recipe and 50 saved recipes per account.

Recipe snapshots use `pluto-recipes-v1:<account-id>` with the same guest/account
separation. They survive reload, update across tabs, and retain a session copy
when storage fails. They have no Supabase sync; no migrations or functions need
deployment for these milestones. Calculator inputs are transient; favorites and
recent tools continue using the existing learning/tools store.

`node --test tests/practical-tools.test.mjs` checks all calculator modes and
boundaries, exact large-integer conversions, bits, unit definitions and reverse
conversions, recipe parsing/scaling/persistence/limits, and all 27 percentage
answers. Run it with the existing learning/math/translation suites.
