# GameweekIQ Guardrails

Last updated: 2026-02-25
Owner: Engineering

## Purpose
Define beta-stage operational limits that protect reliability and cost while running on constrained infrastructure.

## Source of Truth
- Runtime config and defaults: `src/lib/betaLimits.ts`
- League add/check API behavior: `src/app/api/user/leagues/route.ts`
- Operational status/cleanup endpoints:
  - `GET /api/internal/guardrails/status`
  - `POST /api/internal/guardrails/cleanup`

## Current Defaults
- Max leagues per user: `3`
  - Env: `FPL_MAX_LEAGUES_PER_USER`
- Max managers per league: `30`
  - Env: `FPL_MAX_MANAGERS_PER_LEAGUE`
- League preview/check rate limit: `10 requests / 300 seconds`
  - Envs:
    - `FPL_LEAGUE_PREVIEW_RATE_LIMIT_MAX_REQUESTS`
    - `FPL_LEAGUE_PREVIEW_RATE_LIMIT_WINDOW_SECONDS`
- League add rate limit: `5 requests / 600 seconds`
  - Envs:
    - `FPL_LEAGUE_ADD_RATE_LIMIT_MAX_REQUESTS`
    - `FPL_LEAGUE_ADD_RATE_LIMIT_WINDOW_SECONDS`
- Active backfill stale threshold: `900` seconds
  - Env: `FPL_ACTIVE_BACKFILL_STALE_AFTER_SECONDS`
- Global active backfill cap: `25`
  - Env: `FPL_GLOBAL_ACTIVE_BACKFILL_LIMIT`
- Add-league kill switch: enabled by default
  - Env: `FPL_ADD_LEAGUE_ENABLED`
- Rate-limit retention: `48` hours
  - Env: `FPL_RATE_LIMIT_RETENTION_HOURS`

## Product/UX Expectations
- Guardrail blocks return explicit user-facing errors.
- Rate-limit (`429`) responses include `retryAfterSeconds`.
- Onboarding and league-management flows should surface retry countdown and clear limits messaging.

## Change Management
- Any guardrail default change must update:
  - `src/lib/betaLimits.ts`
  - this document
  - relevant user-facing copy if behavior changes
- If limits are tightened, include rollback guidance in PR notes.

