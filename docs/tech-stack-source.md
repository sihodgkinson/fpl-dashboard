# GameweekIQ Tech Stack Source Document

Last updated: 2026-02-25
Owner: Product/Engineering

## 1) Stack Overview
GameweekIQ is a full-stack web app using Next.js App Router, TypeScript, Tailwind, shadcn/ui patterns, Supabase (Auth + Postgres), and Vercel deployment. The architecture is cache-first for historical FPL data and optimized for low-cost beta operation.

## 2) Core Application Framework
### Web framework
- `Next.js 15.5.9` (App Router)
- Server Components + Client Components
- Route Handlers for backend API endpoints (`src/app/api/**/route.ts`)

### Language
- `TypeScript 5`

### Runtime model
- Next.js server runtime on Vercel
- Client-side SWR for data fetching and revalidation

## 3) Frontend Stack
### UI rendering
- `React 19.1.0`
- `react-dom 19.1.0`

### Styling
- `Tailwind CSS v4`
- `tw-animate-css`
- Global design tokens and theme styles in `src/app/globals.css`

### UI components and primitives
- shadcn-style component structure under `src/components/ui/**`
- Radix UI primitives:
  - `@radix-ui/react-dropdown-menu`
  - `@radix-ui/react-hover-card`
  - `@radix-ui/react-popover`
  - `@radix-ui/react-select`
  - `@radix-ui/react-slot`
  - `@radix-ui/react-tabs`

### Theming
- `next-themes` for light/dark mode
- Geist fonts via `next/font/google`
- ThemeProvider in `src/app/layout.tsx`

### Charts and data visualization
- `recharts` (used in stats/trend visualizations)

### Client data fetching
- `swr` for client-side cache + revalidation behavior

## 4) Backend/API Stack
### API layer
- Next.js Route Handlers (`src/app/api/**/route.ts`)
- Internal operational endpoints for backfill, live refresh, and guardrails status/cleanup

### External data source
- Official Fantasy Premier League API
  - Bootstrap static
  - Classic league standings
  - Team picks/history/transfers
  - Event live data

### Auth/session strategy
- Supabase Auth endpoints called from server-side helper (`src/lib/supabaseAuth.ts`)
- Cookie-based session tokens:
  - `fpl_access_token`
  - `fpl_refresh_token`
- Middleware token refresh for `/dashboard/:path*`

## 5) Data and Persistence Stack
### Database
- Supabase Postgres

### Core tables (public schema)
- `fpl_cache` (primary cache table, JSONB payloads)
- `user_leagues`
- `league_backfill_jobs`
- `request_rate_limits`
- `waitlist_signups`

### SQL source files
- `supabase/fpl_cache.sql`
- `supabase/user_leagues.sql`
- `supabase/user_leagues_auth.sql`
- `supabase/league_backfill_jobs.sql`
- `supabase/request_rate_limits.sql`
- `supabase/waitlist_signups.sql`
- `supabase/storage_capacity.sql`

### Cache model
- Unique cache key: `(league_id, gw, view)`
- Supported views:
  - `league`
  - `transfers`
  - `chips`
  - `activity_impact`
  - `gw1_table`

## 6) Infrastructure and Deployment
### Hosting
- `Vercel` (production deployment)

### Domain
- `gameweekiq.com`

### CI/scheduled jobs
- GitHub Actions workflow:
  - `.github/workflows/live-refresh.yml`
  - Scheduled cron triggers internal live refresh endpoint every 5 minutes

### Secrets/config strategy
- Environment variables in Vercel/GitHub/Supabase
- Internal endpoints protected via shared secrets (for production)

## 7) Email and Comms Stack
### Auth email delivery
- Supabase Auth Email provider enabled
- Custom SMTP configured via Resend

### Sender pattern
- Subdomain sender approach in use (`mail.gameweekiq.com`) for domain reputation isolation

### Current auth email flows
- Google OAuth sign-in
- Passwordless email flow (magic link + OTP code support)

## 8) Product/Workflow Tooling
### Version control
- Git + GitHub repository

### Project management
- Linear configured (issues/statuses/labels workflow)
- GitHub integration enabled for issue/PR lifecycle mapping

## 9) Developer Tooling
### Package manager
- npm (`package-lock.json`)

### Linting
- ESLint (`eslint`, `eslint-config-next`)
- Command: `npm run lint`

### Build
- Command: `npm run build`

### Local dev
- Command: `npm run dev`

### Script utilities
- Backfill script:
  - `scripts/backfill-league-cache.mjs`
  - Command: `npm run backfill:league-cache`

## 10) Environment Variables (Observed)
### Supabase/Auth
- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`
- `SUPABASE_ANON_KEY`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`

### App URL/origin
- `NEXT_PUBLIC_APP_URL`
- `APP_URL`

### Backfill/live refresh secrets
- `BACKFILL_RUNNER_SECRET`
- `LIVE_REFRESH_SECRET`

### Guardrails and beta capacity controls
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

### Optional/ops
- `FPL_LIVE_CACHE_TTL_SECONDS`
- `FPL_METRICS`
- `SLACK_WEBHOOK_URL`

## 11) Non-Functional Priorities Shaping Stack Decisions
- Low-cost operation on free tiers during beta
- Cache-first historical performance
- Mobile-first interaction quality (swipe GW support)
- Operational guardrails to prevent infra overload
- Fast iteration without introducing major platform migration risk

## 12) Known Constraints / Technical Debt Areas
- Heavy reliance on `fpl_cache` storage growth management
- Need disciplined cache lifecycle and capacity monitoring
- Passwordless email deliverability depends on SMTP/domain setup and template quality
- No paid cron in Vercel plan; scheduled refresh currently handled via GitHub Actions

## 13) Canonical File References
- App metadata/theme: `src/app/layout.tsx`
- Landing page: `src/app/page.tsx`
- Dashboard shell: `src/app/(dashboard)/[leagueID]/DashboardClient.tsx`
- Auth panel: `src/components/common/SignInPanel.tsx`
- Onboarding gate: `src/components/common/OnboardingGate.tsx`
- Supabase auth glue: `src/lib/supabaseAuth.ts`
- Cache helpers: `src/lib/supabaseCache.ts`
- Guardrail config: `src/lib/betaLimits.ts`
- Guardrail docs: `docs/guardrails.md`
- Product context source: `docs/product-owner-source.md`

## 14) How to Keep This Document Up to Date
Update this file whenever one of the following changes:
1. New framework/library is added or removed
2. Version upgrades with architecture impact (Next/React/Tailwind/Supabase)
3. New infra/provider adoption (email, analytics, queueing, payments)
4. Significant auth/session model changes
5. New core table(s) or schema migrations in `supabase/`
6. New scheduled job/automation mechanism

## 15) Stack Change Log
Use this section as an append-only record.

### Template
```md
- YYYY-MM-DD: [Change summary]
  - Reason:
  - Impacted areas:
  - Files/infra touched:
```

### Entries
- 2026-02-25: Added `docs/tech-stack-source.md` as canonical stack source for PO/agent context and ongoing maintenance.
  - Reason: maintain a shareable, always-current technical baseline.
  - Impacted areas: documentation only.
  - Files/infra touched: `docs/tech-stack-source.md`.
