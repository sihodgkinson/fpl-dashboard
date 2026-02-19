# FPL Dashboard Improvements Summary

## Routing and API Hardening

- Added an explicit `/dashboard` route.
- Added strict query validation for:
  - `/api/league`
  - `/api/transfers`
  - `/api/chips`
- Added safe handling for empty standings in league API responses.

## Performance and Data Fetch Optimization

- Removed duplicate league/stats fetching by centralizing league data flow through `DashboardClient`.
- Added concurrency limiting in standings enrichment to reduce request spikes.
- Replaced repeated linear lookups (`players.find`) with map-based lookups for faster processing.
- Reduced initial server work by precomputing heavy standings only for the selected league.

## Supabase Cache Architecture

- Added Supabase cache schema (`fpl_cache`) with:
  - unique key: `(league_id, gw, view)`
  - useful indexes for cache access patterns.
- Implemented read-through caching for all key views:
  - `league`
  - `transfers`
  - `chips`
- Historical gameweeks now serve from immutable cached rows (`is_final = true`).
- Current gameweek cache behavior supports TTL and stale response paths.

## Backfill and Data Warm-up Utilities

- Added script-based backfill support for league cache population.
- Successfully populated historical cache across:
  - 3 leagues
  - 25 gameweeks
  - 3 views (`league`, `transfers`, `chips`).

## Cache Correctness and Stability Fixes

- Fixed Supabase upsert conflict handling with explicit `on_conflict=league_id,gw,view`.
- Added logic to promote locked current-GW `chips` and `transfers` rows to `is_final = true`.
- Added fallback for gameweek discovery:
  - if FPL bootstrap is unavailable, derive GW from latest cached league data instead of defaulting to GW1.

## Live Request Performance Improvements

- Added short-lived in-memory cache for current-GW league responses.
- Added stale-while-revalidate behavior for current-GW league data:
  - serve stale cached payload immediately
  - refresh in background.
- Added debug response headers on `/api/league` (`debug=1`) to expose cache source:
  - `memory_hit`
  - `supabase_hit`
  - `supabase_stale_served`
  - `miss`.

## Client-Side Prefetch and UX Speedups

- Added speculative SWR prefetching for likely next requests (GW and tab interactions).
- Added prefetch-on-intent in `GameweekSelector` before GW navigation.
- Result: substantially faster GW and tab transitions with reduced visible loading states.

## Stats Card Trend Visuals

- Added `/api/stats-trend` endpoint based on cached league data.
- Added interactive sparkline trend charts in the four stat cards:
  - Most GW Points
  - Fewest GW Points
  - Most GW Bench Points
  - Most GW Transfers
- Added improved tooltip content with manager/team context.
- Added gradient area fill under sparkline line for visual depth.
- Disabled sparkline tooltips on touch devices to avoid scroll-triggered popups on mobile.

## Gameweek Selector UX

- Changed gameweek dropdown ordering to descending (latest gameweek first).

