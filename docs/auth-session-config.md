# Rolling 90-Day Session Configuration (Supabase)

This project now supports sliding session refresh in app code, but Supabase Auth settings must also be configured for the full 90-day behavior.

## Required Supabase Dashboard Settings

In Supabase Dashboard for this project:

1. Open `Authentication` -> `Settings` -> `Sessions`.
2. Set `Time-box user sessions` to **90 days**.
3. Enable `Refresh token rotation`.
4. Keep `Reuse interval` at a non-zero safety window (recommended: **30 seconds** or more) to reduce race-related refresh failures.
5. Save changes.

## Expected Behavior

- Active users stay signed in as long as they return within each 90-day window.
- Users are asked to sign in again after 90 days of inactivity, explicit logout, revoked sessions, or cleared cookies/site data.
- Transient refresh failures do not immediately clear cookies.
- Invalid refresh failures (401/403 or invalid grant) clear auth cookies and force re-auth.
