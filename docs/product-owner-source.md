# GameweekIQ Product Owner Source Document

Last updated: 2026-02-28

## 1) Product Snapshot
- Product name: `GameweekIQ`
- Domain: `https://gameweekiq.com`
- App type: FPL mini-league intelligence dashboard
- Current maturity: MVP / beta, operating with free-tier infrastructure constraints
- Primary value proposition: explain mini-league movement gameweek-by-gameweek (not just scores, but decision impact)

## 2) Core User Problem and Jobs-to-be-Done
### Primary user
- Fantasy Premier League managers in private/classic mini-leagues who want to understand:
  - who gained/lost rank,
  - why rank changed,
  - which decisions (transfers, chips, captaincy) mattered most.

### Core jobs
- "Show me my league table for a specific GW quickly."
- "Explain who made the best/worst decisions this week."
- "Let me review historical GWs without waiting for expensive recompute."
- "Work well on mobile while checking during live game windows."

## 3) Current Product Surfaces
### Public landing page (`/`)
- Marketing site with sections: Hero, Features, Pricing, Contact.
- Theme aware (light/dark).
- Open Graph + Twitter metadata configured in `src/app/layout.tsx`.
- Waitlist capture on Pricing card via `src/components/common/WaitlistSignup.tsx` -> `POST /api/waitlist`.
- Contact link uses mailto to `hello@gameweekiq.com`.

### Authenticated app (AppShell foundation)
- Persistent AppShell with:
  - left navigation sidebar
  - main content area
  - slim utility header
- LeagueIQ is now the formal scoped surface.
- Primary LeagueIQ nav:
  - `Tables` (active page)
  - `Transfers` (placeholder, disabled)
  - `Chips` (placeholder, disabled)
- LeagueIQ table view retains in-content tabs:
  - `League`
  - `ManagerIQ`
  - `GW 1 Team`

Supporting behaviors:
- League selector
- Gameweek selector
- Stats cards with trend sparklines
- Backfill status pills in header (queued/running/success/failure + retry)
- Sidebar account/profile menu with placeholder disabled items (Account/Billing/Notifications/Settings)

### Onboarding gate (first-time auth users)
- If user has no leagues, onboarding gate asks user to add first league.
- Supports entering either:
  - league ID
  - full FPL league URL (extracts ID from `/leagues/{id}/standings/...`).
- Includes expandable helper "Where to find your league ID".

## 4) Authentication Model
### Providers currently supported
- Google OAuth (primary / preferred UX)
- Email OTP / magic link (passwordless)

### Key auth flow files
- Sign-in UI: `src/components/common/SignInPanel.tsx`
- Sign-in page: `src/app/signin/page.tsx`
- Google start endpoint: `src/app/api/auth/google/start/route.ts`
- OAuth token-to-cookie exchange: `src/app/api/auth/oauth/session/route.ts`
- Callback page (hash token parsing + redirect): `src/app/auth/callback/page.tsx`
- Email OTP start: `src/app/api/auth/email/otp/start/route.ts`
- Email OTP verify: `src/app/api/auth/email/otp/verify/route.ts`
- Cookie/session helpers: `src/lib/supabaseAuth.ts`
- Middleware token refresh on dashboard paths: `src/middleware.ts`

### Auth cookie/session approach
- Custom HTTP-only cookies:
  - `fpl_access_token`
  - `fpl_refresh_token`
- Middleware refreshes near-expiry access tokens for `/dashboard/:path*`.

### Practical note
- `SignInPanel` stores intended post-auth destination in session storage key `auth_next_path`.
- Callback resolves next path safely via `sanitizeNextPath`.

## 5) League Add, Cache, and Backfill Architecture
### High-level flow when adding a league
1. User checks league (`preview: true`) via `POST /api/user/leagues`.
2. Backend validates league existence via FPL classic league standings endpoint.
3. Backend enforces guardrails (caps/rates/capacity).
4. On add:
   - save mapping in `user_leagues`,
   - trigger short warmup,
   - enqueue full historical backfill job,
   - return control to dashboard.

### Supabase cache strategy
- Main cache table: `public.fpl_cache`
- Cache key: `(league_id, gw, view)` unique
- Views:
  - `league`
  - `transfers`
  - `chips`
  - `activity_impact`
  - `gw1_table`
- Immutable historical GWs are served cache-first for speed.

### Backfill execution
- Jobs table: `public.league_backfill_jobs`
- Runner endpoint: `POST /api/internal/backfill/run`
- Live refresh endpoint: `POST /api/internal/refresh-live/run`
- `warmLeagueCache()` is used for both initial warmup and broader backfill.

### Automation
- GitHub Actions scheduled workflow: `.github/workflows/live-refresh.yml`
- Cron currently every 5 minutes to refresh current GW cache.

## 6) Guardrails (Beta Infrastructure Protection)
Source of truth: `docs/guardrails.md` and `src/lib/betaLimits.ts`.

### Active constraints
- Max leagues per user: `3` (default)
- Max managers per league: `30` (default)
- Add attempts rate limit: `5 per 10 minutes` (default)
- Preview/check rate limit: `10 per 5 minutes` (default)
- One active backfill per user
- Global active backfill cap: `25` (default)
- Add-league kill switch (`FPL_ADD_LEAGUE_ENABLED`)

### Important UX behavior
- UI disables add/check when blocked.
- `429` responses return `retryAfterSeconds`; countdown shown client-side.
- Explicit user-facing messages reduce support confusion.

## 7) Supabase Schema Surfaces in Use
SQL files in `supabase/`:
- `fpl_cache.sql`
- `user_leagues.sql`
- `user_leagues_auth.sql`
- `league_backfill_jobs.sql`
- `request_rate_limits.sql`
- `waitlist_signups.sql`
- `storage_capacity.sql` (capacity analysis query pack)

### Most storage-intensive table
- `public.fpl_cache` (JSONB payloads + indexes)

### Operational utility tables
- `public.request_rate_limits` for shared server-side throttling
- `public.waitlist_signups` for landing waitlist capture

## 8) Capacity and Cost Context (Free Tier Reality)
- Current concern: Supabase free tier 500MB DB storage.
- No strict row/table cap, practical cap is storage + index growth.
- Added query pack: `supabase/storage_capacity.sql` to estimate:
  - table usage,
  - per-view row size,
  - per-league footprint,
  - projected unique leagues at safe thresholds.

### PO implication
Backlog decisions should be capacity-aware:
- avoid unbounded new payloads,
- prefer summarized/computed views where possible,
- add retention/cleanup policy before feature fan-out.

## 9) Landing and Marketing State
- Pricing copy reflects beta usage limits.
- Free plan card includes current caps (3 leagues / 30 managers).
- Premium card currently "Coming soon" + waitlist CTA.
- Waitlist endpoint implemented and persisted in Supabase.

## 10) Mobile and UX Requirements (Do Not Regress)
Critical UX commitments already implemented:
- portrait touch-target tuning
- orientation hint behavior
- header parity and status pills
- full light/dark coverage across landing + dashboard
- slide-out drawer navigation for mobile, including phone landscape

Current known behavior (as of this update):
- mobile GW swipe-to-change-week is temporarily disabled while card/drawer interactions are stabilized
- phone landscape now uses slide-out navigation instead of fixed desktop sidebar to avoid content breakage

If stories touch dashboard shell/header/selectors, regression testing must include:
- iPhone Safari + Chrome
- portrait and landscape
- fast tab/GW switching

## 11) Integrations and External Services
- Supabase: auth, Postgres, rate-limit RPC, waitlist data
- Vercel: deployment
- GitHub Actions: scheduled live refresh
- Resend + custom SMTP configured in Supabase Auth email settings (operational)

Operational note:
- OTP/magic-link deliverability and redirect behavior depend on Supabase Auth URL config and email templates.

## 12) Environment Variables (Observed)
Used across app/scripts:
- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`
- `SUPABASE_ANON_KEY`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `NEXT_PUBLIC_APP_URL`
- `APP_URL`
- `BACKFILL_RUNNER_SECRET`
- `LIVE_REFRESH_SECRET` (GitHub Action secret)
- `SLACK_WEBHOOK_URL` (ops notifications)
- Guardrail envs (`FPL_*`):
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

## 13) Current Product Constraints and Tradeoffs
- MVP-first, infra-limited approach is intentional.
- Priority is stable experience under low-cost infra, not max throughput.
- Some functionality optimized for correctness + explainability over real-time granularity.
- Significant logic is cache/backfill dependent; stale/failed backfills are high-impact incidents.

## 14) Recommended Product Owner Working Agreements
### Story quality standard
Every story should define:
1. User outcome (not implementation only)
2. Constraints/guardrails impact
3. Success metric and failure mode
4. Non-regression checklist
5. Rollback/fallback behavior

### Definition of done (minimum)
- Server and client behavior covered
- Guardrails respected
- Error states and retry UX specified
- Mobile portrait + landscape QA pass
- No auth/onboarding regression
- No cache/backfill integrity regression

## 15) Suggested Story Template
```md
Title

[Short, outcome-focused title]

Description

[1-2 short paragraphs describing the user problem and the change needed. Keep this product-focused and avoid implementation detail.]

Acceptance Criteria

- [ ] [Clear behavior the user should experience]
- [ ] [Validation/error handling expectation]
- [ ] [Any important guardrail/business rule outcome]
- [ ] [No regression to key existing user flows]
```

## 16) Suggested Bug Template
```md
Title

[Concise bug summary]

Simple Description

[One short paragraph describing the issue and impact.]

Steps to reproduce
1.
2.
3.

Expected behaviour
-

Actual behaviour
-
```

## 17) Initial Backlog Themes for PO Agent
1. Capacity hardening
- Add storage threshold alerts and operational runbooks
- Define add-league soft/hard gating based on measured DB usage

2. Auth polish
- Improve email OTP/magic-link copy and deliverability monitoring
- Add clearer auth state transitions and edge-case handling

3. Onboarding conversion
- Reduce friction in "find league ID" journey
- Add better detection/validation messaging for bad URLs/IDs

4. Reliability and observability
- Backfill failure visibility and auto-remediation
- Better instrumentation around cache hit/miss and API latency

5. Premium/waitlist strategy
- Validate demand signals from waitlist
- Define premium feature slicing and sequencing

## 18) Key File Map (Fast Start)
- Landing: `src/app/page.tsx`
- Global metadata/theme: `src/app/layout.tsx`, `src/app/globals.css`
- Dashboard shell: `src/app/(dashboard)/[leagueID]/DashboardClient.tsx`
- Onboarding gate: `src/components/common/OnboardingGate.tsx`
- Sign-in UX: `src/components/common/SignInPanel.tsx`
- League add/check API: `src/app/api/user/leagues/route.ts`
- Backfill status API: `src/app/api/user/backfill-status/route.ts`
- Internal backfill runner: `src/app/api/internal/backfill/run/route.ts`
- Internal live refresh: `src/app/api/internal/refresh-live/run/route.ts`
- Guardrails status/cleanup: `src/app/api/internal/guardrails/*`
- Cache helpers: `src/lib/supabaseCache.ts`, `src/lib/leagueCacheWarmup.ts`
- Guardrail config: `src/lib/betaLimits.ts`
- Supabase auth glue: `src/lib/supabaseAuth.ts`
- SQL schemas: `supabase/*.sql`

## 19) Product Narrative (for assistant context priming)
GameweekIQ is a beta-stage FPL intelligence product focused on helping mini-league managers understand decision impact. The core strategy is cache-backed speed with explicit infrastructure guardrails while running on free-tier services. Product decisions should optimize user clarity, reliability, and low-cost scalability. Any new feature must preserve auth stability, onboarding success, mobile usability, and cache/backfill integrity.
