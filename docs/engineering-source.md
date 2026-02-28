# GameweekIQ Engineering Source Document

Last updated: 2026-02-28
Primary audience: software engineers joining the project
Owner: Engineering

## 1) Purpose of This Document
This document is the canonical technical onboarding source for new engineers on GameweekIQ. It is designed to reduce ramp-up time and prevent regressions in the app’s highest-risk areas (auth, onboarding, cache/backfill, mobile interactions, and guardrails).

## 2) Product and Architecture at a Glance
- Product: FPL mini-league intelligence dashboard
- Domain: `https://gameweekiq.com`
- Stack: Next.js App Router + TypeScript + Tailwind + shadcn-style UI + Supabase + Vercel
- Core strategy: cache-first data serving with controlled backfill and explicit guardrails for free-tier infrastructure limits

### Main user surfaces
- Landing page: `/`
- Sign-in page: `/signin`
- Auth callback: `/auth/callback`
- Dashboard entry: `/dashboard` (redirects to LeagueIQ tables route for selected league)
- Main dashboard route: `/app/(dashboard)/[leagueID]`
- LeagueIQ scoped route: `/dashboard/leagueiq/[view]` (current primary view: `tables`)

## 3) Core Technical Principles
1. Preserve behavior over refactor elegance in critical flows.
2. Prefer incremental, testable changes.
3. Preserve current mobile interaction behavior (GW swipe currently disabled while horizontal card/landscape work is stabilized).
4. Do not regress auth callback and onboarding routing.
5. Assume Supabase storage and request budgets are constrained.
6. Keep historical data cache-first and immutable where intended.

## 4) Repository Structure (Key Paths)
- `src/app/page.tsx`: landing page
- `src/app/layout.tsx`: root metadata, icons, OG tags, theme provider
- `src/app/globals.css`: design tokens and global styles
- `src/app/signin/page.tsx`: sign-in route
- `src/components/common/SignInPanel.tsx`: sign-in UX (Google + email OTP)
- `src/components/common/OnboardingGate.tsx`: first-league onboarding flow
- `src/app/(dashboard)/[leagueID]/page.tsx`: server page entry for dashboard
- `src/app/(dashboard)/[leagueID]/DashboardClient.tsx`: dashboard client shell and runtime behavior
- `src/app/dashboard/leagueiq/[view]/page.tsx`: LeagueIQ scoped route entry
- `src/lib/leagueiqRoutes.ts`: LeagueIQ view keys/routes metadata
- `src/components/common/LeagueSelector.tsx`: league switcher + in-menu league management
- `src/components/common/AccountMenu.tsx`: sidebar profile trigger + account dropdown
- `src/lib/supabaseAuth.ts`: auth API integrations + cookie/session helpers
- `src/lib/authSessionRefresh.ts`: shared refresh-token rotation logic (single-flight + resilience)
- `src/lib/authTelemetry.ts`: auth/session telemetry event emitter
- `src/lib/supabaseCache.ts`: cache read/write layer for `fpl_cache`
- `src/lib/leagueCacheWarmup.ts`: cache warmup/backfill logic
- `src/lib/backfillJobs.ts`: backfill job queue table interactions
- `src/lib/userLeagues.ts`: user league persistence and cache purge logic
- `src/lib/betaLimits.ts`: all guardrail env defaults
- `src/app/api/**/route.ts`: all backend APIs
- `supabase/*.sql`: DB schema and operational SQL files
- `docs/auth-session-config.md`: required Supabase Auth dashboard settings for rolling 90-day sessions

## 5) Data Model and Persistence
## 5.1 Core tables
- `public.fpl_cache`
  - cache table keyed by `(league_id, gw, view)` unique constraint
  - views: `league`, `transfers`, `chips`, `activity_impact`, `gw1_table`
  - `payload_json` stores response payload (JSONB)
  - `is_final` differentiates immutable historical rows vs current-GW dynamic rows

- `public.user_leagues`
  - user-to-league mapping
  - unique `(user_id, league_id)`

- `public.league_backfill_jobs`
  - queue/worker state for full cache backfills
  - statuses: `pending`, `running`, `succeeded`, `failed`

- `public.request_rate_limits`
  - persistent shared rate-limit store
  - used through `check_request_rate_limit` SQL function

- `public.waitlist_signups`
  - pricing waitlist capture

## 5.2 SQL source files
- `supabase/fpl_cache.sql`
- `supabase/user_leagues.sql`
- `supabase/user_leagues_auth.sql`
- `supabase/league_backfill_jobs.sql`
- `supabase/request_rate_limits.sql`
- `supabase/waitlist_signups.sql`
- `supabase/storage_capacity.sql`

## 6) Request/Data Flows
## 6.1 Sign-in flow (Google)
1. UI sends user to `/api/auth/google/start`.
2. Route builds Supabase authorize URL with redirect target `/auth/callback`.
3. Supabase redirects back with hash tokens.
4. `/auth/callback` parses tokens, calls `/api/auth/oauth/session`.
5. Server verifies token user and sets HTTP-only auth cookies.
6. Client redirects to sanitized `nextPath` (from query/session).

Relevant files:
- `src/app/api/auth/google/start/route.ts`
- `src/app/auth/callback/page.tsx`
- `src/app/api/auth/oauth/session/route.ts`
- `src/lib/supabaseAuth.ts`

## 6.2 Sign-in flow (Email OTP / magic link)
1. `SignInPanel` posts to `/api/auth/email/otp/start` with email + redirect target.
2. Route resolves redirect origin (local dev and production-safe logic).
3. `requestEmailOtp` calls Supabase `/auth/v1/otp`.
4. User can click link or enter code manually.
5. Manual code path posts to `/api/auth/email/otp/verify`.
6. Server verifies OTP and attaches auth cookies.

Relevant files:
- `src/components/common/SignInPanel.tsx`
- `src/app/api/auth/email/otp/start/route.ts`
- `src/app/api/auth/email/otp/verify/route.ts`
- `src/lib/supabaseAuth.ts`

## 6.3 Onboarding first league flow
1. If authenticated user has no leagues, onboarding gate is shown.
2. User checks league (`preview: true`) via `POST /api/user/leagues`.
3. API validates league and manager count against guardrails.
4. User adds league (`preview: false`).
5. API persists `user_leagues`, warms selected GW cache, enqueues full backfill.
6. UI redirects to dashboard for selected league.

Relevant files:
- `src/components/common/OnboardingGate.tsx`
- `src/app/api/user/leagues/route.ts`

## 6.4 Dashboard data flow
- Dashboard uses SWR + server bootstrapped data.
- Core data calls include:
  - `/api/league`
  - `/api/activity-impact`
  - `/api/gw1-table`
  - `/api/stats-trend`
- Current GW may revalidate periodically.
- Historical GWs should be cache-first.

Relevant files:
- `src/app/(dashboard)/[leagueID]/DashboardClient.tsx`
- `src/lib/supabaseCache.ts`
- `src/app/api/*/route.ts`

## 6.6 AppShell and navigation flow (GWIQ-12)
- Authenticated UI now uses a persistent AppShell:
  - left sidebar (LeagueIQ nav + account area)
  - main content column (header + cards + tables)
- LeagueIQ is formalized as a scoped surface; current nav items:
  - `Tables` (active page)
  - `Transfers` (placeholder, disabled)
  - `Chips` (placeholder, disabled)
- Sidebar profile/account block uses dropdown menu with disabled placeholders for future items.
- League management moved into `LeagueSelector` dropdown:
  - add/check/remove flows in-menu
  - league-limit messaging via tooltip next to disabled add action at cap
- Backfill status pills remain in header next to league selector.

## 6.5 Backfill and live refresh flow
### Backfill
- Add league enqueues job in `league_backfill_jobs`.
- `/api/internal/backfill/run` claims jobs, runs `warmLeagueCache` across GWs/views, finalizes job status.

### Live refresh
- GitHub Action scheduled job hits `/api/internal/refresh-live/run` every 5 minutes.
- Endpoint refreshes current GW cache for all distinct tracked leagues.

Relevant files:
- `src/app/api/internal/backfill/run/route.ts`
- `src/app/api/internal/refresh-live/run/route.ts`
- `src/lib/leagueCacheWarmup.ts`
- `.github/workflows/live-refresh.yml`

## 7) Guardrails and Beta Capacity Controls
Source docs: `docs/guardrails.md`
Source config: `src/lib/betaLimits.ts`

Defaults:
- max leagues per user: `3`
- max managers per league: `30`
- league add rate limit: `5 / 10 minutes`
- league preview rate limit: `10 / 5 minutes`
- one active backfill per user
- global active backfill cap: `25`
- add-league kill switch: enabled by env

### Internal ops endpoints
- `GET /api/internal/guardrails/status`
- `POST /api/internal/guardrails/cleanup`

## 8) Mobile and Interaction-Critical Behavior
High regression risk areas in `DashboardClient`:
- orientation hints
- prefetching and leader-tab live polling
- header status pills for backfill progress and retries
- drawer-vs-fixed-nav switching in landscape phone scenarios

Current mobile nav behavior:
- narrow/mobile and phone-landscape use slide-out drawer nav
- fixed desktop sidebar is hidden in those modes
- GW swipe gesture is currently feature-flagged off (`MOBILE_GW_SWIPE_ENABLED = false`) pending follow-up UX work

Any change touching:
- gameweek selector,
- tabs,
- touch handlers,
- layout container sizing,
should include manual mobile QA (iPhone Safari + Chrome).

## 9) Auth and Session Technical Notes
- Session cookies are HTTP-only and set by backend routes.
- Middleware refreshes access token when near expiry for dashboard requests.
- If refresh fails, cookies are cleared to avoid stale-auth loops.
- Callback route is client-side because it needs token hash parsing.

## 10) Environment Variables
### Required core
- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`
- `SUPABASE_ANON_KEY` or `NEXT_PUBLIC_SUPABASE_ANON_KEY`

### App URL handling
- `NEXT_PUBLIC_APP_URL`
- `APP_URL`

### Secrets for internal endpoints
- `BACKFILL_RUNNER_SECRET`
- `LIVE_REFRESH_SECRET` (GitHub Actions secret)

### Guardrail/beta controls
- `FPL_MAX_LEAGUES_PER_USER`
- `FPL_MAX_MANAGERS_PER_LEAGUE`
- `FPL_LEAGUE_PREVIEW_RATE_LIMIT_WINDOW_SECONDS`
- `FPL_LEAGUE_PREVIEW_RATE_LIMIT_MAX_REQUESTS`
- `FPL_LEAGUE_ADD_RATE_LIMIT_WINDOW_SECONDS`
- `FPL_LEAGUE_ADD_RATE_LIMIT_MAX_REQUESTS`
- `FPL_ACTIVE_BACKFILL_STALE_AFTER_SECONDS`
- `FPL_ADD_LEAGUE_ENABLED`
- `FPL_GLOBAL_ACTIVE_BACKFILL_LIMIT`
- `FPL_RATE_LIMIT_RETENTION_HOURS`

### Optional
- `FPL_LIVE_CACHE_TTL_SECONDS`
- `FPL_METRICS`
- `SLACK_WEBHOOK_URL`

## 11) Local Development and Commands
- install deps: `npm install`
- dev server: `npm run dev`
- lint: `npm run lint`
- build check: `npm run build`
- manual cache backfill script: `npm run backfill:league-cache`

## 12) Reliability and Incident Triage Runbook
## 12.1 "League add failing"
Check in order:
1. `POST /api/user/leagues` response code/message (429/400/409/503)
2. Guardrail state via `/api/internal/guardrails/status`
3. Backfill queue saturation (`activeBackfillJobs` vs limit)
4. Supabase auth/session validity
5. FPL endpoint health

## 12.2 "Backfill stuck/failing"
1. Inspect `league_backfill_jobs` rows/status/attempts/last_error
2. Trigger runner manually (authorized) `POST /api/internal/backfill/run`
3. Validate secrets and origin
4. Confirm cache rows are being written in `fpl_cache`

## 12.3 "Current GW stale"
1. Confirm GitHub Action ran and succeeded
2. Check `/api/internal/refresh-live/run` logs/response
3. Verify `listDistinctLeagueIds()` returns expected leagues
4. Verify current GW `fpl_cache` rows `fetched_at` progression

## 12.4 "Email OTP problems"
1. Check Supabase Auth email templates (magic link + confirm signup)
2. Confirm redirect URL config and callback URL allowlist
3. Confirm SMTP sender/domain settings (Resend)
4. Check rate-limit responses from `/api/auth/email/otp/start`

## 13) Storage and Capacity Monitoring
- Use `supabase/storage_capacity.sql` routinely.
- `fpl_cache` is the dominant storage consumer.
- Capacity planning should use both average and p90 row-size projections.
- Recommended operational thresholds:
  - soft alert ~70%
  - hard alert ~85%

## 14) Engineering Do-Not-Break Checklist
Before merging significant changes, verify:
1. Auth callback signs in and routes correctly (`/signin` -> provider -> `/auth/callback` -> destination)
2. Onboarding gate can check and add first league
3. Guardrail error messages still surface correctly (including retry countdown for 429)
4. Backfill status pills show expected transitions
5. Mobile swipe GW still works
6. Historical GW loads from cache quickly
7. Landing page CTA behavior is correct for signed in/out users

## 15) Testing Strategy (Current State)
Automated tests are limited. Current quality gate is primarily:
- lint + build pass
- focused manual QA on:
  - auth and onboarding,
  - league add/check guardrails,
  - dashboard tabs/GW navigation,
  - mobile interactions.

Recommendation: expand automated coverage around auth routes and `/api/user/leagues` guardrail logic.

## 16) Change Management Guidance
When changing behavior, always include in PR/commit notes:
- impacted routes/components
- migration/config changes required
- risk and rollback steps
- manual QA checklist run

For schema-related changes:
- add/update SQL file in `supabase/`
- include explicit rollout and rollback instructions in PR description

## 17) Dependency Snapshot
From `package.json`:
- Next.js `15.5.9`
- React `19.1.0`
- TypeScript `5`
- Tailwind `4`
- SWR `2.3.6`
- Recharts `3.7.0`
- Radix UI primitives as listed in package.json

## 18) Related Context Docs
- Product context: `docs/product-owner-source.md`
- Tech stack source: `docs/tech-stack-source.md`
- Git workflow: `docs/git-workflow.md`
- Guardrails: `docs/guardrails.md`
- Historical improvements: `docs/improvements-summary.md`
- Handoff doc: `docs/agent-handoff.md`

## 19) Maintenance Protocol for This File
Update this document when any of the following change:
- authentication flow or provider behavior
- guardrail logic/defaults
- cache/backfill architecture
- internal ops endpoints
- table schema or retention strategy
- mobile interaction logic in dashboard shell

## 20) Engineering Change Log
Use append-only entries.

Template:
```md
- YYYY-MM-DD: [summary]
  - Why:
  - Impacted files:
  - Operational impact:
```

Entries:
- 2026-02-28: Expanded `docs/git-workflow.md` with explicit Linear automation runbook.
  - Why: make issue status updates reliable across all engineers using a single, command-driven PR process.
  - Impacted files: `docs/git-workflow.md`, `docs/engineering-source.md`.
  - Operational impact: documentation/process only.
- 2026-02-25: Added GitHub/Linear delivery workflow documentation.
  - Why: standardize branch -> PR -> merge flow and keep branch hygiene consistent.
  - Impacted files: `docs/git-workflow.md`, `docs/engineering-source.md`.
  - Operational impact: process documentation only.
- 2026-02-25: Added `docs/engineering-source.md` as canonical engineer onboarding reference.
  - Why: speed up engineer onboarding and reduce regressions in critical flows.
  - Impacted files: `docs/engineering-source.md`.
  - Operational impact: documentation only.
