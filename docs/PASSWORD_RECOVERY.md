# Password recovery

Login now includes **Forgot password?**. The email request uses
`supabase.auth.resetPasswordForEmail` with a same-origin `/reset-password`
redirect. The confirmation avoids disclosing whether an account exists.
The reset page restores the Supabase session, accepts and confirms a password
of at least eight characters, and calls `supabase.auth.updateUser`.
Supabase enforces the configured password policy and authenticates the change.
The UI also handles missing/expired sessions, callback errors, failed requests,
and success. A `PASSWORD_RECOVERY` event routes to the reset page even when
Supabase falls back to the site URL. No password or recovery token is logged.

## Hosted setup

No database migration or Edge Function deployment is needed for this feature.
Deploy the frontend, then configure **Authentication → URL Configuration**:

- Site URL: the real HTTPS production origin.
- Redirect URLs: the exact `https://YOUR-DOMAIN/reset-password` URL.
- For local development, add `http://127.0.0.1:5173/reset-password` and/or
  the actual port and hostname used by the developer.

Use the default password-reset email with `{{ .ConfirmationURL }}`. Custom
templates must preserve the supplied redirect rather than hardcoding `/`.
Configure working production SMTP and review auth email rate limits.

After deployment, use a controlled test account to request an email, open its
link, choose a new password, sign out, and verify login using the new password.
Also try an expired link and a password rejected by the configured policy.
The automated tests use a mocked SDK; live email delivery and credential
changes were not performed during implementation.

References:
- https://supabase.com/docs/reference/javascript/auth-resetpasswordforemail
- https://supabase.com/docs/reference/javascript/auth-updateuser
- https://supabase.com/docs/guides/auth/redirect-urls
