# Auth Session Configuration (Supabase Free + App Hardening)

This project uses app-managed session persistence with refresh-token rotation. On Supabase Free, session time-box and inactivity controls are not configurable, so we harden refresh behavior in application code.

## Supabase Dashboard Settings

In Supabase Dashboard:

1. Open `Authentication` -> `Settings` -> `Sessions`.
2. Ensure `Detect and revoke potentially compromised refresh tokens` is enabled.
3. Set `Refresh token reuse interval` to **120 seconds**.
4. Save changes.

## App-Side Session Hardening (Implemented)

The app applies these protections to reduce accidental sign-outs:

1. **Deferred middleware invalidation**
   - Middleware no longer clears auth cookies immediately on first invalid refresh.
   - Invalid refresh handling is deferred to API session confirmation.

2. **Double-confirm invalid refresh before logout**
   - Refresh logic now re-attempts once after a short delay when the first result is invalid.
   - Users are only forced to re-authenticate if invalid refresh is reproduced.

3. **Reduced middleware refresh contention**
   - Middleware refresh is limited to document navigations (HTML requests), not all dashboard requests.
   - Middleware only refreshes when access token is actually expired (no near-expiry skew).

## Expected Behavior

- Users generally remain signed in across browser restarts while cookies/site data are retained.
- Transient refresh failures should not immediately log users out.
- Forced re-auth should primarily happen for true invalid sessions (revoked/expired/invalid refresh token), explicit logout, or cleared browser data.
- Mobile browsers may still clear site data under OS/browser policies; this is outside app control.
