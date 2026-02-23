# Guardrails Reference

This document summarizes the active guardrails in GameweekIQ to protect free-tier infrastructure during beta.

## Scope

Guardrails currently focus on:
- League add/check flow (`POST /api/user/leagues`)
- Backfill queue pressure
- Cache/backfill operational safety
- User-facing feedback to reduce confusion and support noise

## Active Guardrails

### 1) Per-user league cap

- Users can add up to `MAX_LEAGUES_PER_USER` leagues.
- Default: `3`.
- Enforced server-side in `src/app/api/user/leagues/route.ts`.

### 2) Per-league manager cap

- League is rejected if manager count exceeds `MAX_MANAGERS_PER_LEAGUE`.
- Default: `30`.
- Manager count is determined from FPL standings (`league.standings.results.length`).
- Enforced server-side in `src/app/api/user/leagues/route.ts`.

### 3) Supabase-backed rate limiting

- Implemented via:
  - Table: `public.request_rate_limits`
  - RPC: `public.check_request_rate_limit(...)`
  - SQL file: `supabase/request_rate_limits.sql`
- App helper: `src/lib/supabaseRateLimit.ts`

Split limits:
- Preview/check (`preview: true`): default `10` requests / `5` minutes.
- Add (`preview: false`): default `5` requests / `10` minutes.

If exceeded:
- API returns `429`.
- Includes `retryAfterSeconds` and `Retry-After` header.
- Message for add path: `Too many league add attempts. Please wait 10mins before trying again.`

### 4) One active backfill per user

- Add requests are blocked if user already has fresh `pending/running` backfill jobs for their leagues.
- Enforced server-side in `src/app/api/user/leagues/route.ts`.

### 5) Global active backfill capacity cap

- Add requests are blocked when active global backfill count reaches `GLOBAL_ACTIVE_BACKFILL_LIMIT`.
- Default: `25`.
- Enforced server-side in `src/app/api/user/leagues/route.ts`.

### 6) Add-league kill switch

- New adds can be paused with `ADD_LEAGUE_ENABLED=false`.
- API returns `503` with clear message.
- Enforced server-side in `src/app/api/user/leagues/route.ts`.

### 7) UI guardrail visibility and blocking

Guardrail state is exposed via `GET /api/user/leagues` and consumed by:
- `src/components/common/AccountMenu.tsx`
- `src/components/common/OnboardingGate.tsx`

UI behavior:
- Disables add/check controls when blocked (limit reached, active backfill, capacity full, or kill switch).
- Shows clear reason text.
- For `429`, shows retry countdown from `retryAfterSeconds` (e.g. “Try again in Xs”).

### 8) Internal ops endpoints

- `GET /api/internal/guardrails/status`
  - Returns guardrail settings + runtime metrics (active backfills, capacity state, rate-limit row count).
- `POST /api/internal/guardrails/cleanup`
  - Deletes old `request_rate_limits` rows based on retention config.

Files:
- `src/app/api/internal/guardrails/status/route.ts`
- `src/app/api/internal/guardrails/cleanup/route.ts`

## Environment Variables

Defined via `src/lib/betaLimits.ts`:

- `FPL_MAX_LEAGUES_PER_USER` (default `3`)
- `FPL_MAX_MANAGERS_PER_LEAGUE` (default `30`)
- `FPL_LEAGUE_PREVIEW_RATE_LIMIT_WINDOW_SECONDS` (default `300`)
- `FPL_LEAGUE_PREVIEW_RATE_LIMIT_MAX_REQUESTS` (default `10`)
- `FPL_LEAGUE_ADD_RATE_LIMIT_WINDOW_SECONDS` (default `600`)
- `FPL_LEAGUE_ADD_RATE_LIMIT_MAX_REQUESTS` (default `5`)
- `FPL_ACTIVE_BACKFILL_STALE_AFTER_SECONDS` (default `900`)
- `FPL_ADD_LEAGUE_ENABLED` (default `true`)
- `FPL_GLOBAL_ACTIVE_BACKFILL_LIMIT` (default `25`)
- `FPL_RATE_LIMIT_RETENTION_HOURS` (default `48`)

## Notes

- Rate limiting is now shared and durable via Supabase (not per-instance memory).
- `request_rate_limits` cleanup is available via internal endpoint; no cron is required for correctness, but periodic cleanup is recommended to control table size.
