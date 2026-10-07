# Planner push reminders (milestone 20)

The implementation adds account-scoped delivery of opted-in Day Planner tasks
to enrolled browsers. In-app reminders still work without a server. Break
reminders remain in-app. Other tool records, food logs and learning progress are
not uploaded or synchronized between devices.

## Deployment

These steps have **not** been executed against the hosted project in this
implementation session. Live background and two-device delivery must be verified
after deployment; the automated checks use PostgreSQL and mocked push transport.

1. Apply `supabase/migrations/20261024010000_tool_push_reminders.sql` through the
   project's normal Supabase migration process. The new private tables have RLS,
   no direct browser grants, and service-role-only RPCs.
2. Generate one VAPID key pair, for example with
   `npx web-push@3.6.7 generate-vapid-keys --json`. Keep the private key outside
   this checkout. Set these Edge Function secrets:

   | Secret | Value |
   | --- | --- |
   | `TOOL_PUSH_VAPID_PUBLIC` | VAPID public key |
   | `TOOL_PUSH_VAPID_PRIVATE` | VAPID private key |
   | `TOOL_PUSH_VAPID_SUBJECT` | Real `mailto:` contact or HTTPS URL |
   | `TOOL_PUSH_CRON_SECRET` | Random secret of at least 32 bytes |
   | `TOOL_PUSH_ALLOWED_ORIGINS` | Comma-separated exact app origins, including scheme and port |

   The function also uses Supabase's supplied `SUPABASE_URL` and
   `SUPABASE_SERVICE_ROLE_KEY`. Neither private key is exposed to the frontend.
   The authenticated configuration action returns only the VAPID public key.
3. Deploy `tool-push` with `supabase functions deploy tool-push`. Its config has
   `verify_jwt = false`: browser actions explicitly validate the bearer token
   using `auth.getUser`, dispatch requires the private cron secret, and delivery
   acknowledgements require an unguessable token unique to each delivery.
4. In Supabase Vault, create secrets named `tool_push_url` (the project URL) and
   `tool_push_cron_secret` (the **same** private scheduler secret as above).
   Use the protected Vault UI or SQL editor. Do not put secret values in a
   migration, browser environment variable, or committed file.
5. Execute `supabase/tool-push-scheduler.sql` in the Supabase SQL editor. It
   registers the named `pluto-tool-push` job every minute using `pg_cron`,
   `pg_net` and Vault. Re-running it updates the named job. Confirm the job is
   active and `cron.job_run_details` shows successful invocations. The job
   deliberately makes no request while either required Vault secret is absent.
6. Deploy the web app with `public/tool-reminders-sw.js`, the web manifest, and
   existing icons, over HTTPS. Localhost supports development. The worker does
   not intercept requests or cache application assets.

The one-minute schedule means reminders can arrive after their start time.
Browsers/OS services can delay or suppress push; delivery is not guaranteed.
The free Open-Meteo endpoint used by Weather Explorer is for non-commercial use;
choose an appropriate paid/proxied endpoint before commercial deployment.

## User flow and two-device verification

Open Day Planner, sign in, and click **Enable on this device**. Permission is
requested only from this click. Enable separately on a second device signed
into the same account. On iOS/iPadOS, use the home-screen installed web app.
The manifest declares standalone mode. Physical Safari/iOS testing remains pending.

Select **Send test to all devices**, wait for notifications, then **Check devices
and delivery**. Tests are limited to one per minute per account. Device IDs let
you distinguish records without storing hardware fingerprints. States mean:

- Queued/Sending: server work awaiting completion.
- Accepted by push provider: the push provider accepted the encrypted request.
- Shown by device: the service worker successfully called `showNotification`
  and its acknowledgement reached the server. This does not prove the person read it.
- Opened on device: the notification was clicked and acknowledgement arrived.
- Delivery failed: retries exhausted or the reminder expired. A dead subscription
  (HTTP 404/410) is removed, including its delivery records.

Use this deployment check:

1. Verify tests show separately on both devices and clicking opens Day Planner.
2. Create a future task with its reminder enabled. Wait for its upload to finish,
   close both app pages, then verify both devices receive it. A powered-off
   device, browser setting or OS battery policy can prevent delivery.
3. Edit/reschedule, complete, dismiss, and delete future tasks; verify pending
   deliveries are cancelled and rescheduling uses the new time.
4. Disable one device, and verify the other continues receiving account reminders.
   Removing another device revokes its server enrollment. Signing out or switching
   accounts in this browser unsubscribes its old endpoint.
5. Disconnect before editing/deleting a task, reload, reconnect, and verify queued
   changes upload. Cancellation cannot reach the server while offline; an already
   submitted notification cannot be recalled.
6. Check permission denial, revoked permission, service outage, and revoked/expired
   subscriptions. Reconnect the device to renew enrollment after permission changes
   or a push-subscription change.

The cloud-reminder list allows cancelling tasks created on another device.
Planner task records themselves stay browser-local; there is no collaborative
calendar or full tool-data sync. Edits to one task publish individually and do
not replace another device's reminders. The local persisted outbox coalesces
updates and stores deletion tombstones, with retries every 30 seconds and on
reconnection while the app is open. Batches contain at most 200 changes. Increasing
client revisions prevent old uploads from overriding newer updates/cancellations;
clients should have reasonably accurate clocks. The latest task change wins.

## Queue, security and retention

Up to ten devices and 500 active reminders per account are allowed, with a
2,000-row total reminder cap. Claims use `FOR UPDATE SKIP LOCKED` and two-minute
leases. A delivery is unique per device, task and due timestamp. Transport retries
stop after three attempts; late reminders older than a day expire. Notifications
use a stable delivery tag so a retry replaces the previous notification. Push
provider acceptance is never treated as a device acknowledgement. Display/click
acknowledgements are monotonic and cannot be downgraded by a later transport result.
There is a small unavoidable race if a task is cancelled while a push request is
already in flight; accepted notifications cannot be recalled.

Server records include the task title/time, subscription encryption keys,
provider endpoint, and delivery diagnostics. The function permits HTTPS endpoints
for the registered Chrome/FCM, Firefox/Mozilla, Apple and Windows push hosts;
private URLs, credentials, nonstandard ports and redirects are rejected. An endpoint
cannot be claimed by a different account. Origin allowlisting is independent of
authentication. Device deletion and account deletion cascade through records.
Delivery records and expired reminders are cleaned after 30 days by the dispatcher;
disabled reminders expire 30 days after their last update. Cleanup needs the
scheduler to be running. Device subscriptions remain until removed/expired.

## Validation

- `npm run test:learning`: includes pure energy/weather calculations, storage,
  persisted reminder outbox, real PGlite queue/ownership/grant tests, Edge Function
  request/dispatch tests with mocked provider, and service-worker display/click tests.
- `npm run check:learning` and `npm run check:push`: client and Edge Function
  contract type checks. The Edge check uses a local declaration for the pinned
  `npm:web-push@3.6.7` API; a deployed Deno runtime is not tested here.
- `node scripts/tools/check-life-tools.mjs http://127.0.0.1:5173`: isolated Chrome
  regression checks, including guest notification state. Weather transport is
  deterministic in this script; the live public API was checked separately.

Implementation references: [Push API](https://developer.mozilla.org/en-US/docs/Web/API/Push_API),
[web-push](https://github.com/web-push-libs/web-push), and
[Supabase function scheduling](https://supabase.com/docs/guides/functions/schedule-functions).

## Annual birthday reminders

The Birthday Reminders app extends this service with an annual calendar schedule
and a notification destination of `/tools/birthday-reminders`. Apply the
`20261026000000_birthday_reminders.sql` migration and redeploy `tool-push` before
shipping it. The existing cron job and VAPID configuration are reused. Names,
birthday month/day and time zone are shared only for enabled reminders; birth
years and local person lists remain browser-local. See [birthdays and QR codes](BIRTHDAYS_AND_QR.md)
for behavior, deployment, and verification.
