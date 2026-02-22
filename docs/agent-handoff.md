# GameweekIQ Agent Handoff

## Project Overview
- **GameweekIQ** is an FPL mini-league intelligence app.
- Public landing page is at **`/`**.
- Authenticated product experience is at **`/dashboard`**.
- Main goal: help managers understand who gained/lost and why, gameweek by gameweek.

## Core App Functionality
- **Authentication**
  - Google OAuth via Supabase Auth.
  - User data is tied to `user_id` (anonymous mode removed).
- **League Management**
  - Users can add/remove leagues from the account menu.
  - Adding a league triggers backfill for required historical data.
- **Dashboard Views**
  - `League Table`
  - `Manager Influence`
  - `GW 1 Table`
- **Manager Influence Logic**
  - Transfer impact, chip impact, captain impact.
  - Tooltip breakdowns for decision transparency.
- **Widgets**
  - Good/Poor toggle behavior (per card interaction).
  - Trend sparkline behavior and tooltip support.
- **Mobile UX**
  - Swipe left/right to change gameweek.
  - Improved swipe reliability with GW feedback overlay.
  - Portrait touch target improvements for selectors.

## Landing Page Functionality
- Styled marketing page with light/dark support.
- Sticky header with smooth anchor scrolling (`Features`, `Pricing`).
- Dynamic CTA:
  - Logged-out: **Get started**
  - Logged-in: **Go to dashboard**
- Hero with theme-specific screenshots.
- Core features section with theme-specific card images.
- Pricing section with:
  - Free (highlighted)
  - Premium (coming soon)

## Current Tech Stack
- **Next.js 15 (App Router)**
- **TypeScript**
- **Tailwind CSS + shadcn/ui**
- **SWR**
- **Supabase** (Auth + Postgres + RLS)
- **Vercel** deployment
- **GitHub Actions** for scheduled refresh workflow

## Data Handling & Performance

### Caching
- Cache table: `public.fpl_cache`
- Supported `view` values:
  - `league`
  - `transfers`
  - `chips`
  - `activity_impact`
  - `gw1_table`
- Historical browsing is designed to be cache-first for speed.

### Backfill
- Jobs table: `public.league_backfill_jobs`
- On new league add:
  - backfill job runs,
  - expected to populate required GW rows for all views.
- Header status supports:
  - updating,
  - success,
  - failure + retry.

### Live Refresh
- GitHub Action calls refresh endpoint on schedule.
- Keeps active GW data current without paid cron infrastructure.

## Important Files
- `src/app/page.tsx` - landing page
- `src/app/layout.tsx` - global metadata/layout
- `src/app/globals.css` - theme tokens and base styles
- `src/app/(dashboard)/[leagueID]/DashboardClient.tsx` - dashboard shell/header/mobile interactions
- `src/components/common/LeagueSelector.tsx`
- `src/components/common/GameweekSelector.tsx`
- `supabase/*.sql` - schema and policy scripts

## Assets
- Landing hero screenshots:
  - `public/landing/dashboard-light.png`
  - `public/landing/dashboard-dark.png`
  - `public/landing/mobile-light.png`
  - `public/landing/mobile-dark.png`
- Feature section screenshots:
  - `public/landing/feature-live-league-light.png`
  - `public/landing/feature-live-league-dark.png`
  - `public/landing/feature-impact-analysis-light.png`
  - `public/landing/feature-impact-analysis-dark.png`
  - `public/landing/feature-speed-light.png`
  - `public/landing/feature-speed-dark.png`

## Environment / Deployment Notes
- Production domain: **`gameweekiq.com`**
- Ensure Supabase settings align with production:
  - Site URL
  - Redirect URLs
  - Google provider config
- Ensure Vercel env vars stay aligned with Supabase/auth/backfill settings.

---

## Agent Handoff Prompt
```text
You are taking over the GameweekIQ codebase (Next.js 15 + TypeScript + Tailwind + shadcn + Supabase + Vercel).

Current product:
- Public landing page is at `/`.
- Authenticated app dashboard is at `/dashboard`.
- Core dashboard tabs: League Table, Manager Influence, GW 1 Table.
- Users authenticate with Supabase Google OAuth.
- Users manage their leagues (add/remove) from account menu.
- Adding league triggers backfill jobs and writes full multi-view cache.
- Cache-backed views: league, transfers, chips, activity_impact, gw1_table.
- Backfill status UI exists in header with success/failure/retry UX.
- Mobile supports swipe GW changes, portrait touch-target tuning, and orientation hints.
- Light/dark mode is fully supported across landing + dashboard.

Recent priorities already completed:
- Landing page redesign (Linear-inspired structure).
- Theme and border contrast cleanup, especially dark mode.
- Header parity between landing and dashboard.
- Feature card images switch by theme:
  - /public/landing/feature-live-league-light.png / dark.png
  - /public/landing/feature-impact-analysis-light.png / dark.png
  - /public/landing/feature-speed-light.png / dark.png
- Domain is gameweekiq.com.

Please start by:
1) Reviewing `src/app/page.tsx`, `src/app/(dashboard)/[leagueID]/DashboardClient.tsx`, and `src/app/globals.css`.
2) Running through UX parity in mobile portrait/landscape and desktop.
3) Verifying cache/backfill integrity for all views when adding a fresh league.
4) Preserving existing behavior (especially auth, backfill status, and mobile swipe GW) while implementing any new work.

Coding constraints:
- Keep styles consistent with existing design system.
- Avoid regressions in mobile interactions and cache performance.
- Prefer incremental, testable changes with clear commit messages.
```

