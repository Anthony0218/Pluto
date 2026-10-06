# QR codes, birthdays, and the hero handoff

## Tools

- `/tools/qr-code-creator` creates static QR codes for web links or plain text.
  Generation runs locally with `qrcode` (MIT), including a four-module quiet
  zone and medium error correction. PNG downloads are 1024 pixels wide; SVG
  downloads stay sharp when printed. Input is capped at 2,000 UTF-8 bytes.
  No content is uploaded, saved, or tracked by this tool. Changing a URL's
  destination later does not change the encoded URL.
- `/tools/birthday-reminders` stores up to 300 people per account in the
  existing browser-local tools snapshot. A name, month, day, time zone, and
  reminder choice are required; birth year is optional and used only to show
  the upcoming age. Entries can be edited or deleted. Guests can use it too.
  Existing version-1 snapshots remain compatible.
- Birthday reminders repeat at 09:00 in each person's selected time zone.
  February 29 is observed on February 28 in non-leap years. In-app reminders
  appear only on the birthday after 09:00 and can be dismissed for that year.
  Birth years stay in the browser. With background reminders enabled, name,
  birthday month/day, and time zone are sent to the existing delivery service.
  Local person records do not synchronize between devices.

Both apps appear in the Tools catalog and landing-page Tools grid and demos.
Their interface text is available in all seven app languages. The build
regenerates the software inventory and notices, including the QR dependency.

## Background reminder deployment

The base push setup is documented in `TOOL_NOTIFICATIONS.md`. These additional
steps have not been executed against a hosted project during this change:

1. Apply `supabase/migrations/20261026000000_birthday_reminders.sql` after the
   existing `20261024010000_tool_push_reminders.sql` migration.
2. Redeploy `supabase/functions/tool-push` through the project's existing
   Supabase deployment process. No additional secret or cron job is required.
3. Deploy the web app, including the updated `/tool-reminders-sw.js`.
4. Enroll each desired browser through **Reminder settings → Enable on this
   device**. Sign-in, permission, HTTPS, VAPID secrets, and the existing cron
   scheduler are required. Guest reminders remain in-app.
5. Verify a birthday notification on real enrolled devices and confirm clicking
   it opens Birthday Reminders. If already enrolled, reconnect to refresh
   localized birthday notification labels. Missing labels fall back to English.

The new server RPC validates an annual calendar schedule and preserves the
scheduler's next occurrence during later edits. The existing queue fans out to
account devices, retries transient failures, and advances to the following
birthday after all devices have a terminal outcome or the one-day delivery
window expires. Annual schedules survive the usual 30-day cleanup; cancelled
records retain the original cleanup policy. A delayed/offline scheduler skips
missed birthdays rather than notifying years late. The existing account caps,
RLS restrictions, revision checks, and cancellation behavior still apply.
Notifications remain subject to browser/OS delivery behavior and scheduler
availability; local tests do not establish real-device delivery.

## Landing hero

The Games / Tools / Learn hero artwork stays fully visible until the next
section fills half of the viewport. It then crossfades into the flyby through
its pinning point. The hero and flyby share a handoff motion value. Stacked and
reduced-motion layouts keep the static hero artwork.

## Checks

- `npm run build` and `npm run check:push`.
- `node --test tests/birthday-qr.test.mjs tests/tool-push-database.test.mjs
  tests/tool-push-endpoint.test.mjs tests/tool-push-worker.test.mjs`.
- `node --import ./tests/helpers/typescript-paths.mjs --test
  tests/landing-motion.test.mjs tests/final-tools.test.mjs
  tests/life-tools.test.mjs tests/learning-translations.test.mjs
  tests/migration-versions.test.mjs`.

Tests decode the generated PNG using an independent QR decoder, exercise leap
and DST dates and persisted cancellation, and execute the migrations/queue in
PGlite. Browser verification covers creation, editing, deletion and responsive
layout. Physical browser-push delivery must be checked after deployment.
