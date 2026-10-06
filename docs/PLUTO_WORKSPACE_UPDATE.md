# Pluto tool workspace update

The existing React routes, public header, Pluto styles, account-scoped life-tool store, Supabase auth/profiles and community RPC/RLS conventions are reused. Unrelated working-tree changes are preserved.

## Changed components

- `src/components/tools/TimeZonePlanner.tsx`: IANA location pins on the existing world-map dataset, zoom controls, keyboard selector, current clocks, save/remove; selection lives in the URL.
- `src/components/tools/BillSplitter.tsx`, `src/hooks/useBillGroups.ts`: My Groups/Add Group, account invitations, per-group names, Balance/Add Expense/Expenses, participant selection, equal or direct custom subtotal amounts, independent tips, combined expense/repayment history, CSV export and legacy local ledgers.
- `src/components/tools/WorkoutTimer.tsx`: saved routine library, dedicated URL-based detail/edit/run views, exercise ordering/sets/reps/duration/rest, replay, sound cues and existing break reminders.
- `src/components/tools/DayPlanner.tsx`: month calendar, past-date editing notice, dedicated date timeline, start/end times, editable event blocks, overlap columns, repeated DST times, completion and existing notification settings.
- `src/components/tools/BudgetTracker.tsx`: Budget/Subscriptions sections, existing subscription management and billing-month projections, spending sidebar and CSV. The original subscription collection and IDs remain intact. No data-copy migration is required.
- `src/pages/tools/ToolAppPage.tsx`: the old subscription URL redirects to Budget Tracker's subscriptions section. The launcher omits the old duplicate subscription tile.
- `src/components/learning/FootballTournaments.tsx`, `src/data/footballTournaments.ts`: six extensible tournament configurations, competition-specific top-right Stats, national flags from existing `/flags/4x3` assets and Finals with score, shootout, date, venue, scorers and minutes. Existing football explanations and honours explorer remain accessible.
- `src/components/App/PublicHeader.tsx`, `src/components/learning/HubLayout.tsx`: active Home/Games/Tools/Learn navigation in the existing public header on Tools/Learn; no duplicate navigation on Home.
- Shared life-tool/learning/football CSS and `ToolTabs.tsx` provide compact responsive layouts and keyboard navigation. Existing language tables contain the new labels in all six non-English languages.

## Database migration

Apply `supabase/migrations/20261025000000_bill_splitter_groups.sql` to the target Supabase project with the project's normal migration deployment workflow before using online Bill Splitter groups.

The tool-reminder migration now uses `20261024010000_tool_push_reminders.sql`; its previous timestamp collided with the Eat-It playground migration. The linked-project dry run confirms only the reminder and Bill Splitter migrations remain pending. `tests/migration-versions.test.mjs` prevents duplicate migration versions from recurring.

New tables: `bill_groups`, `bill_members`, `bill_invitations`. These reference existing auth user and profile IDs. A group-specific display name is stored in the membership table. Ledger JSON stores cents, subtotal and tip allocations without altering existing community groups or authentication.

Only members can read a group or change its ledger; only its creator can invite users or delete it. Only an invitation's recipient can accept or decline it. Membership names can only be changed by that member. Server validation checks participants, amounts, dates, sum conservation and split metadata. Row locking plus revision checks reject stale saves rather than losing another member's edits.

Existing browser ledgers remain available under My Groups with a local-only notice. They are not automatically uploaded: their named participants have no trustworthy mapping to Pluto accounts. Newly created collaborative groups use Supabase. Personal routines, zones, planner events and budget records continue to use the existing account-scoped browser store. Storage failures retain the existing session-only warning.

## Football data coverage

The app uses static historical datasets, not a live match API. Existing World Cup honours snapshots are retained. Detailed finals are supplied for men's World Cups 2018/2022, women's World Cups 2019/2023, and each of the four UEFA competitions for 2024/2025. Club tournament winner statistics describe those recorded seasons, rather than pretending to be all-time totals. Other World Cup years explicitly show unavailable final details.

Every detailed final includes its FIFA/UEFA match-report source. Penalty shootouts are stored separately from match scores. Missing scorers, minutes and dates have explicit fallbacks. New tournaments or seasons can be added to the data configuration without changing the UI.

Time-zone coordinates are derived from the host IANA `zone.tab` dataset; map pins represent reference locations rather than political time-zone boundaries. Browser Intl supplies current offsets and daylight-saving rules.

## Validation

`tests/pluto-workspaces.test.mjs` checks monetary conservation, invalid custom splits, separate tips, multi-exercise replay, legacy persistence, subscription projection and tournament isolation. `tests/bill-groups-database.test.mjs` executes the actual migration in PostgreSQL/PGlite and checks invitations, RLS, membership, names, stale saves and hostile ledger inputs.

Browser verification covers map save/reload, workout save/reload/completion, past-date planner creation/reload, mobile layouts and tournament/Finals controls. Live invitations against the deployed Supabase project require applying the migration first.

Final checks: production build and `pnpm check:learning` pass; ESLint passes for every changed TS/TSX file. The full `pnpm test` run passes 1,303 of 1,306 tests, including the new workspace and database tests. The three existing failures are the Go time-control preset assertion (`chess-ranked-queue-client`), Eat-It solid-scenery prediction (`eat-it-network`) and fixed animal reward (`eat-it-readability`). Repository-wide lint still reports existing errors outside this update.

Responsive browser checks at 390, 768 and 1440 pixels found no horizontal overflow after the tablet header correction. The legacy subscription URL redirects correctly; a saved subscription survives reload and appears exactly once in the monthly budget. Keyboard arrows switch Bill Splitter tabs, and anonymous group creation is disabled. Final route checks produced no new browser runtime errors.
