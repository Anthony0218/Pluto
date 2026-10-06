# Learn and Tools

Milestone 1 provides a subject hub, learning-path outlines, a shared lesson
framework, and an app launcher. Milestone 2 publishes the Math foundations
course. Milestones 3 and 4 publish Everyday percentages and four working tools.
Milestones 5 and 6 publish Algebra and functions, Derivatives and integrals,
and the Function Plotter. Milestones 7 through 9 publish Linear algebra,
Analysis in depth, and Probability and statistics. Milestones 10 through 13
publish music notation and rhythm, football rules, and positions and tactics.
Milestones 14 through 17 publish six planning, fitness, and money apps with saved records and in-app reminders. Milestones 18–19 publish Calorie Tracker and Weather Explorer. Milestone 20 adds opt-in planner push delivery; hosted rollout and real-device verification remain pending.
Football now uses the category reference described below instead of course progress.
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
- `/tools/:toolId`: a working app for all thirteen available tools.

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
register stable exercise IDs in `mathExerciseIds.ts`, the existing shared
registry for all published exercise subjects.

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
1 through 17.

New text uses the existing `ui` translator. `learnContentTranslations.json` stores
rows in English/German/Bavarian/Korean/Russian/Spanish/Portuguese order.
`milestoneToolsTranslations.json` adds percentage lessons and tool text in the
same language order. `learning-translations.test.mjs` checks active Learn and Tools prose in every
language, including Bavarian entries without relying on the German fallback.

## Remaining milestones

Milestones 1 through 19 are implemented. Milestone 20 implementation and automated delivery checks are complete; Supabase deployment, secret/scheduler setup, and live two-device checks remain pending. See [Planner push setup](TOOL_NOTIFICATIONS.md).

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


## Algebra, functions, and calculus (milestones 5–6)

`/learn/math/algebra-functions` publishes five lessons: equations and inequalities,
ratios and proportions, powers/roots/logarithms, functions and graphs, and domains
with substitution checks. `/learn/math/calculus` publishes seven lessons: slopes
and rates, derivative rules (power/sum/product/quotient/chain), signed accumulation,
antiderivatives and constants, definite integrals and the fundamental theorem,
optimization with endpoints, and numerical checks. Together these add 36 exact
numeric practice exercises, worked examples, graph explorations, and Did you know?
checks. They preserve the three-stage math flow, separate reading/practice progress,
per-account persistence, and reveal-without-credit behavior.

`advancedMath.ts` owns the content and stable exercise IDs, registered alongside
the existing math courses. Math notation is rendered separately from translated
question instructions. `advancedMathTranslations.json` supplies all new prose and
controls in German, Bavarian, Korean, Russian, Spanish, and Portuguese alongside
the English originals; translation coverage includes the new activities.

`/tools/function-plotter` is available in the app catalog and links to both courses.
The same `FunctionPlotter` component supplies the lessons’ interactive explorations:

- Plot two expressions, edit axis ranges, zoom, and inspect points with a keyboard
  slider or numeric input. Inputs support explicit `+ - * / ^`, parentheses, `x`,
  `pi`, `e`, and `sin`, `cos`, `tan`, `sqrt`, `abs`, `ln`, `log`, `exp`. Multiplication
  must use `*`; trigonometry uses radians, `ln` is natural, `log` is base 10.
- Compare central-difference slope estimates at h and h/2, with a secant and
  estimated tangent. Likely corners, invalid domains, and unsuitable steps return
  no reliable estimate. This is numerical exploration, not symbolic differentiation.
- Show signed trapezoidal accumulation, including negative contributions and
  reversed bounds. Compare the selected number of trapezoids with twice that
  resolution; each output states its resolution. The drawing uses the coarse
  trapezoids. Estimates and resolution differences are not proofs or error bounds.

`functionMath.ts` uses a bounded recursive-descent parser with no JavaScript
execution. Source is limited to 200 characters, 100 tokens, and 24 nested levels;
intermediate numeric values are limited to absolute magnitude 1e12. Plot windows
and integral endpoints are limited to ±10000. Conservative interval checks leave
possible domain gaps/poles open and refuse proper-integral estimates over them,
including off-grid singularities. These checks can also reject valid intervals
when continuity cannot be established. Graphs and estimates may miss features
between samples or very rapid oscillations. Improper integrals, symbolic answers,
complex values, and automatic root solving are outside this release.

Plot inputs are transient. Existing favorites, recent views, and course progress
remain browser-local per account. No dependencies, Supabase migrations, or Edge
Functions are required for milestones 5–6.

Validation (5 October 2026): the six Learn/Tools suites total 40 passing tests,
including ten new parser/domain/graph/numerical/content/progress cases. Run:

```sh
node --test tests/advanced-math.test.mjs tests/learning-tools-foundation.test.mjs tests/math-foundations.test.mjs tests/paper-arithmetic.test.mjs tests/practical-tools.test.mjs tests/learning-translations.test.mjs
```

`npm run check:learning` checks the Learn/Tools component and route dependency
graph independently of unrelated landing changes; `npm run test:learning` runs
the six suites above. Focused ESLint and the production build pass. Browser checks cover the working
plotter, slope and integral estimates, refusal across a pole, exact-answer grading,
reveal without completion credit, reload persistence, and desktop/360px layouts.
English and German were reviewed visually; all seven languages are covered by
the translation completeness test. The build retains the existing Vite config
loader and large-bundle warnings.


## Linear algebra, analysis, and probability/statistics (milestones 7–9)

Three courses publish all 17 topics from the roadmap:

- `/learn/math/linear-algebra`: vectors, matrices, linear systems, geometric
  transformations, eigenvalues/eigenvectors, and substitution/residual checks.
- `/learn/math/analysis`: limits/continuity, sequences, series/convergence,
  definitions/proofs, and boundary cases/counterexamples.
- `/learn/math/probability-statistics`: probability/conditional probability,
  distributions, averages/variability, sampling/uncertainty, misleading charts,
  and complements/simulation checks.

Each lesson includes explanations, a worked example, an interactive exploration,
three exact-answer exercises with hints/solutions and independent checks, and an
inline Did you know? section. `deeperMath.ts` owns content and stable IDs;
`deeperMathCalculations.ts` owns bounded pure calculations. The existing reading,
bookmark, solved-exercise, account-isolation, reset, and reveal-without-credit
behavior applies to the new courses. There are now 44 published math lessons and
164 exercises across all seven math courses. Course transitions link linear
algebra to analysis and then probability/statistics.

All 44 math lessons now show an **In everyday life** scenario and concrete
calculation on Learn. `everydayMathCases.ts` includes groceries, shared meals,
taxis, recipes, phone plans, journeys, photo rotation/resizing, ticket prices,
video watching, delivery thresholds/waits, polls, and misleading household bill
charts. These are illustrative situations with hypothetical prices/models,
including explicit assumptions where proportionality or independence matters.
The shared lesson shell displays them for earlier courses as well as new ones.

Explorations and limits:

- Linear algebra uses two-dimensional vectors and 2×2 matrices. Vector arrows
  have distinct colors/line styles and coordinate captions. Integer sliders
  expose matrix products, determinants, exact singular-system classification,
  candidate/computed residuals, and eigenvector directions, including the zero
  vector and rotations without real eigenvectors. The solver accepts integer
  coefficients/right-hand sides up to magnitude 10000; classification is exact
  within that bound. Unique solutions and their residuals use floating-point
  arithmetic, with rounded display; a small residual is not an error guarantee.
- Analysis compares both sides of a removable hole and a corner, proves a linear
  limit with ε/δ inequalities, and demonstrates why an oversized δ fails.
  Sequences compare reciprocal, alternating, and geometric models. Series compare
  geometric partial sums/exact remainder formulas with the harmonic series,
  including a block lower bound establishing divergence. Plots show finite
  samples; the inequalities supply the claims about later terms. The geometric
  ratio slider is limited to ±0.95 and displays at most 200 terms. Limit/corner
  lessons also reuse the existing bounded Function Plotter.
- Probability compares both conditional denominators in a 100-day count table,
  explicitly leaving an empty group's conditional probability undefined.
  Binomial distributions support 1–20 independent equal-probability trials.
  Data analysis accepts up to 100 values of magnitude at most 1000000, separated
  by spaces/semicolons, with decimal point/comma support. It distinguishes means,
  medians, range, population/sample variance, and population standard deviation;
  a sample variance requires two values. Fraction expressions are not data inputs.
- Sampling compares random/convenience models and withholds a normal 95% interval
  for convenience samples or fewer than ten successes/ten failures. Confidence
  describes repeated-sampling coverage, not the probability that a fixed
  parameter belongs to one realized interval. Standard errors do not measure
  selection bias or dependence. The chart activity compares equal data on
  zero/truncated bar axes. Seeded complement simulation supports at most 10000
  experiments of 20 trials, compares estimates with the analytic probability,
  and states that refinement does not guarantee improvement on every run.

`deeperMathTranslations.json` supplies prose, controls, and everyday scenarios in
all seven UI languages. Mathematical notation stays separate from prose.
`deeperMathLabels.ts` registers dynamic exploration labels for translation
coverage. Inputs to explorations are transient; lesson/progress state remains
browser-local per account. No dependencies, database migrations, or Edge Function
deployments were added.

Validation (5 October 2026): all 52 Learn/Tools tests pass, including twelve new
calculation/content/persistence cases and complete seven-language coverage.
`npm run check:learning`, focused ESLint, and `npm run build` pass. The production
build retains the existing Vite configuration and large-chunk warnings. Browser
checks open all 17 new lessons and explorations, verify keyboard vector changes,
wrong/correct equivalent fraction answers, reveal without solved credit, bookmark
and stage persistence after reload, dataset errors/outliers, empty conditional
groups, and inappropriate sampling intervals. English and German desktop/360px
layouts were inspected; the remaining languages have automated coverage.

Run `npm run test:learning` for the Learn/Tools suites, including
`tests/deeper-math.test.mjs`. Milestones 10–13 continue below.


## Music and football (milestones 10–13)

Twenty-four lessons add 24 graded multiple-choice exercises and four complete
Learn, Explore, Practice, and Check stages. Reading, bookmarks, and solved
exercises remain separately stored per account. Revealing a solution does not
award credit; an inline-confirmed practice reset enables another attempt.
`musicFootball.ts` owns lesson content and stable exercise IDs;
`SubjectLesson.tsx` supplies the shared subject shell.

- Milestone 10 publishes six pitches/notation lessons, including notation for
  piano, violin, flute, viola, cello, guitar, electric bass, B-flat clarinet,
  E-flat alto saxophone and drum kit. The studio draws treble/bass/alto/tenor
  clefs, ledger lines, key signatures and local accidentals, and separates
  written from sounding pitch. Guitar TAB and piano's bass-staff reference are
  explicitly separate examples. Drum placement follows the visible demo legend.
- Milestone 11 publishes five rhythm/combined-reading lessons, with notes,
  rests, dots, ties, simple/compound meters, tempo, original short passages,
  playhead and tap-along timing. Audio starts only on a user action and uses
  illustrative synthesized tones. Ties join matching notes/drum voices;
  silence occupies rest time. Tap positions are feedback, not a scored test.
- Milestone 12 publishes seven rules lessons pinned to IFAB 2026/27. Offside
  replay freezes the pass-time positions and line while players move. Nine
  presets cover level, behind-ball, goalkeeper location, non-involvement,
  direct throw-in, own half, deflection and deliberate play. Learners can
  change involvement, restart origin, opponent contact and body-point positions.
  Whole-ball boundary, fouls/cards, free-kick and penalty situations also have
  controllable diagrams. Reduced-motion users can inspect frames manually.
- Milestone 13 publishes six positions/tactics lessons, with 11-player 4-3-3,
  4-4-2 and 3-5-2 shapes, possession switches, role-specific responsibilities,
  pressing, overlap, and false-nine demonstrations. A 3-5-2 can defend as a
  back five. These are teaching examples, not prescriptions for every team.

The competitions lesson includes a sourced trophy explorer: nine selected
men's clubs across Bundesliga, Premier League/English top flight, La Liga,
Serie A, Ligue 1, and the Portuguese top flight. It separates domestic league,
main domestic cup, European Cup/UCL, UEFA Cup/Europa League and Conference League.
Club figures are historical snapshots through **2024/25**, not live/current
figures or all-club coverage. Men's World Cup winners are listed through 2026;
women's through 2023. Cutoffs and counting conventions are visible beside the
records. Official club/tournament logos are excluded because app usage rights
have not been established; original score/pitch drawings and plain identifying
names are used. See [Football data and visual rights](FOOTBALL_DATA_AND_MEDIA.md)
for provenance, primary sources and the asset-permission policy.

`musicFootballTranslations.json` supplies original prose and controls in all
seven UI languages. Scores and pitches support keyboard controls; long passages
scroll horizontally at narrow widths. The offside model represents foremost
eligible body points on a one-dimensional attacking axis. Involvement, controlled
play and saves remain stated scenario inputs, not automated refereeing judgements.
No dependencies, database migrations or Edge Function deployments were added.

Validation (6 October 2026): all 61 `npm run test:learning` tests, `npm run check:learning`,
focused ESLint and `npm run build` pass. The music/football suite checks audited
answers, notation/transposition, rhythm/ties, offside boundaries and exceptions,
restarts, formation integrity, trophy counts/cutoffs and account-isolated
persistence. Browser review opens all 24 new explorations, checks grading,
reveal-without-credit, reset/reload, all six league filters, offside presets,
audio/tap controls, and English/German desktop and 360px layouts. Other languages
have automated translation coverage. Existing Vite configuration/chunk warnings
remain. Milestones 14–17 continue below.


## Football category reference (6 October 2026)

This replaces the football course presentation from milestones 12–13.
`/learn/football` provides a category chooser and a highlighted Football stats
box linking to `/learn/football/stats`. Rules lists all 17 IFAB laws; Positions
lists ten role families; Tactics lists ten topics spanning formations,
possession, build-up, pressing/transitions, defensive blocks/marking, overlaps,
false nine, overloads, set pieces, and competition formats. Each topic opens
its explanation and element list directly. Interactive offside and tactical
examples remain available inline. Rules link to the full official procedures
and exceptions; tactical terminology is open-ended, not a finite legal taxonomy.

There is no football lesson order, stage navigation, quiz, completion badge,
bookmark-as-lesson control, or progress counter. Football records are excluded
from the published lesson and exercise registries, so old football course state
cannot contribute to Learn totals. Existing music/math state remains valid.
The progress parser ignores retired football fields on load; no storage-clear
operation is performed. Old football lesson URLs resolve to reference topics;
the former competitions lesson opens the stats page. Unknown topics show 404.

`footballReference.ts` owns the topic taxonomy and compatibility resolver;
`FootballReferencePage.tsx` provides lists, localized topic search, explanations,
category navigation, and the stats destination. New prose is translated in
`footballReferenceTranslations.json` with explicit entries for all seven UI
languages. Stats remain historical snapshots with their existing cutoffs.

Validation: 63 Learn/Tools tests pass, including all-law coverage, reference
routes, legacy URLs, and retired-progress isolation. Focused type checking,
ESLint, and the production build pass (existing Vite config/chunk warnings).
Desktop browser review verifies the category hub, searchable rules
list, standalone offside explanation, highlighted stats navigation, ten position
entries, and the old competitions URL redirect. The 360px hub has no horizontal
overflow. Fresh-page console error logs are empty. See the media
rights document for official-mark permissions; generic library icons remain
separate from official club or competition symbols.


## Planning, fitness, and money apps (milestones 14–17)

All six routes are available in the Tools catalog, with favorites/recent views
and English, German, Bavarian, Korean, Russian, Spanish, and Portuguese text:

- `/tools/day-planner`: create, edit, complete, and delete dated tasks with a
  start, elapsed-minute duration, IANA time zone, and optional start reminder.
  The daily timeline identifies overlapping unfinished tasks across dates.
  Nonexistent local times are rejected; repeated hours offer both occurrences
  with their UTC timestamps. Durations can cross midnight or clock changes.
- `/tools/time-zone-planner`: compare the same instant across saved IANA
  locations and their local dates. Define daily availability, including overnight
  windows, and find starts over the following 24 hours at 30-minute steps from
  the chosen instant. Every elapsed minute of the meeting must fit every window.
  This is daily availability, without holiday, weekday, or external calendar data.
  Time-zone rules come from the browser's Intl database.
- `/tools/workout-timer`: work/rest intervals, rounds, start/pause/resume/reset,
  optional synthesized sound cues, and saved editable routines. There is no
  final rest interval. It derives the phase from elapsed time after suspension;
  background audio can be delayed or unavailable. Leaving the route resets the
  active timer. Optional break reminders are off by default and use a saved
  interval of 1–240 minutes; dismissal schedules the next interval from dismissal.
- `/tools/bill-splitter`: named groups with 2–30 participants, one currency per
  group, equal/custom weighted shares, tips entered as amounts, expense
  editing, group balances, suggested repayments, recorded manual repayments,
  confirmed deletion, and CSV export. Allocation uses exact integer-cent and
  BigInt arithmetic with largest remainders; ties use participant order.
  Positive balances are owed to that person. Participants and group currency
  are fixed after creation to preserve ledger references. Groups are local
  ledgers of expenses shared by named people: no invitations, remote membership,
  collaborative edits, or synchronized access are supplied. Repayment records
  do not send money.
- `/tools/budget-tracker`: manual income/expense entries, user categories,
  per-month/currency spending limits, category bars, net totals, optional monthly
  plans, editing/deletion, and CSV export. Monthly plans recur from their anchor
  month, clamping to month end, without creating duplicate stored transactions.
  Reports explicitly combine plans and manual entries. Changing/deleting a
  recurring source affects all generated months. Subscription costs stay
  separate to avoid automatically counting the same expense twice.
- `/tools/subscription-tracker`: manual monthly/yearly subscriptions with
  an anchor renewal date, price, currency, active status, editing/deletion,
  future renewals, annualized commitments, monthly equivalents, and CSV export.
  Renewal dates retain the original day after short months and leap years.
  The monthly equivalent of an annual invoice is an estimate, not a billing
  schedule. Deactivation does not cancel with a provider. Use Day Planner
  to create an optional renewal reminder.

`lifeTools.ts` owns calendar, interval, cent allocation, balance, renewal, budget,
and CSV calculations. Money inputs accept decimal point/comma and at most two
fraction digits. EUR, USD, GBP, and CHF use separate totals; no exchange rates
or automatic currency conversion are performed. CSV fields quote user text and
neutralize leading spreadsheet formula characters.

`lifeToolsStorage.ts` validates version-1 snapshots at
`pluto-life-tools-v1:<account-id>` (`guest` when signed out). It stores tasks,
routines, groups, entries, limits, subscriptions, locations, and break settings.
Caps: 500 tasks, 50 routines, 30 groups, 500 expenses and 500 repayments per group,
2,000 budget entries, 1,200 limits, 200 subscriptions, and 10 saved locations.
Invalid records are discarded independently, without erasing valid collections.
`useLifeTools` subscribes to account-isolated snapshots and cross-tab storage
events, guards writes while auth loads, and preserves a session copy if storage
is blocked/full. Editors and active timers remount when the account changes.
Older learning/progress and recipe keys are unchanged. No dependencies, database
migrations, or Edge Functions were added.

`ToolReminders` runs in the shared root layout, including other tool/game routes.
Only opted-in, unfinished, undismissed tasks trigger a reminder. Missed reminders
appear when the app is reopened; dismissal is stored and observed by other tabs.
Multiple open tabs can show the same reminder until one dismisses it. Milestone 20 adds an opt-in push worker and account-device delivery for planner tasks; email delivery and background break notifications are not supplied. See below for deployment and validation limits.

Validation commands:

```sh
npm run test:learning
npm run check:learning
npm run build
node scripts/tools/check-life-tools.mjs http://127.0.0.1:5173
```

The browser check uses an isolated temporary Chrome profile and an existing local
server. Set `CHROME_PATH` if Chrome is elsewhere. It exercises saved tasks,
conflicts/DST, time conversion, workout completion/pause, groups/repayments,
budget totals/currency isolation, subscription costs/deactivation, and global
missed-reminder dismissal/reload. It saves English/German screenshots at 1440px
and 360px under the system temporary directory.

Validation (6 October 2026): all 80 Learn/Tools tests, focused TypeScript/ESLint,
and the production build pass. The browser check passes for all six routes,
persistence and reminders, with no runtime exceptions or page overflow in the
24 English/German desktop/narrow captures. Selected screenshots were visually
reviewed. Existing Vite configuration and large-chunk warnings remain.


## Calorie Tracker and Weather Explorer (milestones 18–19)

All thirteen catalog apps are available. Calorie Tracker (`/tools/calorie-tracker`)
logs named foods with a date and breakfast/lunch/dinner/snack category. Label
energy uses kcal per 100 g or per serving; quantities and label values accept
two decimal places and decimal comma. Energy rounds per entry to a tenth of a
kcal, and daily totals sum those displayed entry values. Food editing/deletion,
reusable meal templates, portion multipliers, daily history and all-history CSV
export are supplied. Templates copy portions when logged and preserve their
original quantities when an entry changes. Daily history shows the latest 90
logged dates; all records are exported. Labels are manually supplied estimates;
there is no food database, calorie prescription, or automatic nutritional advice.

Weather Explorer (`/tools/weather-explorer`) uses the existing Natural Earth
world boundaries on an original equirectangular SVG picker. Clicking, arrow
keys or bounded latitude/longitude inputs select a point. Open-Meteo geocoding
searches named locations; favorite places persist per account. A three-day
hourly forecast provides two selectable 24-hour windows from the current hour,
a temperature chart/table, Celsius temperature, precipitation probability,
precipitation in mm, wind in km/h, and translated WMO weather conditions.
Compare a saved place beside the selected place at matching UTC hours with
location-specific local dates and time zones. Missing values remain missing.
Refresh refetches, requests time out after 12 seconds, abandoned requests are
aborted, and invalid units/arrays/values are rejected. HTTP errors and location
search failures have visible retry paths. Forecasts are not stored offline.

Weather data attribution links are visible beside the app: Open-Meteo/CC BY 4.0,
GeoNames, and Natural Earth. The current public endpoints permit non-commercial
API use; production commercial use needs the appropriate provider plan or proxy.
References: [forecast API](https://open-meteo.com/en/docs),
[geocoding API](https://open-meteo.com/en/docs/geocoding-api), and
[provider pricing and usage](https://open-meteo.com/en/pricing).

Version-1 browser snapshots load older records unchanged and add independently
validated `foodEntries` (5,000), `savedMeals` (100, up to 50 foods each), and
`weatherPlaces` (20). Local snapshots over five million characters are rejected
before writing, preserving earlier data. New UI text and dynamic meal/weather
labels have explicit translations in all seven UI languages. No frontend
package dependency was added.

## Background reminders (milestone 20)

Day Planner exposes background reminder settings for signed-in users. Each
browser opts in from an explicit permission action. Tests fan out to all enrolled
account devices, and status distinguishes queued/sending/provider acceptance,
confirmed display, opening, and failure. Cloud task reminders can be cancelled
from another device, and enrollment can be removed individually. Planner task
records and other tool data remain browser-local; this supplies reminder delivery,
not full data synchronization. Break reminders stay in-app.

`toolNotifications.ts` computes per-task changes. `lifeToolsStorage.ts` persists
coalesced pending updates and deletion tombstones. The root `useToolPush` bridge
uploads batches, retries offline/service failures, and unsubscribes old-account
endpoints after sign-out/account changes. Client revisions prevent stale requests
from reversing newer updates or cancellations. The service worker displays and
acknowledges push notifications and opens Day Planner on click. A standalone
manifest uses existing Pluto icons for home-screen installation.

The new private Supabase migration and `tool-push` Edge Function implement device
enrollment, individual reminder schedules, leased deliveries, three-attempt
retries, account isolation, caps, test rate limiting, cancellation and retention.
The dispatcher uses pinned `npm:web-push@3.6.7` for encrypted VAPID requests;
the frontend has no new dependency. The optional scheduler setup SQL registers
an every-minute job using Vault secrets. See [deployment and two-device checks](TOOL_NOTIFICATIONS.md).
**Hosted migration/function deployment, VAPID/cron secrets, scheduler installation,
and physical two-device/iOS delivery checks are pending.** Automated provider and
worker tests do not establish live delivery. Existing in-app reminders keep working.

Validation (6 October 2026): 95 Learn/Tools tests pass, including energy/weather,
local persistence/outbox, real PGlite queue/grant tests, mocked Edge dispatch and
worker acknowledgement tests, and seven-language coverage. Focused client and
Edge contract type checks, ESLint, and production build pass. The isolated Chrome
script exercises all eight life apps, new calorie templates/edits/reload, weather
search/map-keyboard/coordinates/favorites/compare/error/retry/reload, and guest
notification settings. English/German layouts at 1440px and 360px pass overflow
checks. Weather browser regression uses deterministic responses; a separate live
Open-Meteo request passed the actual parser with 72 hours in Europe/Berlin.
Existing Vite configuration and large-bundle warnings remain.
