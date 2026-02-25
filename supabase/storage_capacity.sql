-- Storage capacity queries for GameweekIQ (Supabase free tier: 500 MB)
-- Run each section independently in Supabase SQL editor.

-- ============================================================================
-- 1) Current storage usage by table (includes table + indexes + TOAST)
-- ============================================================================
select
  c.relname as table_name,
  pg_size_pretty(pg_relation_size(c.oid)) as table_only,
  pg_size_pretty(pg_indexes_size(c.oid)) as indexes_only,
  pg_size_pretty(pg_total_relation_size(c.oid)) as total_size
from pg_class c
join pg_namespace n on n.oid = c.relnamespace
where n.nspname = 'public'
  and c.relkind = 'r'
order by pg_total_relation_size(c.oid) desc;

-- ============================================================================
-- 2) fpl_cache internals: payload size + full-row size by view
-- ============================================================================
select
  view,
  count(*) as rows,
  round(avg(pg_column_size(payload_json)) / 1024.0, 2) as avg_payload_kb,
  round(percentile_cont(0.5) within group (order by pg_column_size(payload_json)) / 1024.0, 2)
    as p50_payload_kb,
  round(percentile_cont(0.9) within group (order by pg_column_size(payload_json)) / 1024.0, 2)
    as p90_payload_kb,
  round(avg(pg_column_size(t.*)) / 1024.0, 2) as avg_row_kb
from public.fpl_cache t
group by view
order by view;

-- ============================================================================
-- 3) Identify heavy cache rows (largest records)
-- ============================================================================
select
  league_id,
  gw,
  view,
  round(pg_column_size(payload_json) / 1024.0, 2) as payload_kb,
  round(pg_column_size(t.*) / 1024.0, 2) as row_kb,
  fetched_at
from public.fpl_cache t
order by pg_column_size(t.*) desc
limit 50;

-- ============================================================================
-- 4) Per-league storage footprint from actual data
--    Useful to see real spread between "light" and "heavy" leagues.
-- ============================================================================
with league_usage as (
  select
    league_id,
    count(*) as row_count,
    sum(pg_column_size(t.*))::bigint as total_row_bytes
  from public.fpl_cache t
  group by league_id
)
select
  count(*) as unique_leagues,
  round(avg(row_count), 1) as avg_rows_per_league,
  percentile_cont(0.5) within group (order by row_count) as p50_rows_per_league,
  percentile_cont(0.9) within group (order by row_count) as p90_rows_per_league,
  round(avg(total_row_bytes) / 1024.0 / 1024.0, 2) as avg_mb_per_league,
  round(percentile_cont(0.5) within group (order by total_row_bytes) / 1024.0 / 1024.0, 2)
    as p50_mb_per_league,
  round(percentile_cont(0.9) within group (order by total_row_bytes) / 1024.0 / 1024.0, 2)
    as p90_mb_per_league
from league_usage;

-- ============================================================================
-- 5) Projection from observed row size (500 MB plan)
--    Assumes season shape: 5 views x 38 GWs = 190 rows per unique league.
-- ============================================================================
with constants as (
  select
    (500::numeric * 1024 * 1024) as db_limit_bytes,
    190::numeric as rows_per_league_full_season
),
observed as (
  select
    avg(pg_column_size(t.*))::numeric as avg_row_bytes,
    percentile_cont(0.9) within group (order by pg_column_size(t.*))::numeric as p90_row_bytes
  from public.fpl_cache t
)
select
  round(avg_row_bytes / 1024.0, 2) as avg_row_kb,
  round(p90_row_bytes / 1024.0, 2) as p90_row_kb,
  floor((db_limit_bytes * 0.90) / avg_row_bytes) as est_rows_90pct_using_avg,
  floor((db_limit_bytes * 0.90) / p90_row_bytes) as est_rows_90pct_using_p90,
  floor(((db_limit_bytes * 0.90) / avg_row_bytes) / rows_per_league_full_season)
    as est_unique_leagues_90pct_using_avg,
  floor(((db_limit_bytes * 0.90) / p90_row_bytes) / rows_per_league_full_season)
    as est_unique_leagues_90pct_using_p90
from constants, observed;

-- ============================================================================
-- 6) Practical operating thresholds (alerts)
--    Recommended: soft alert at 70%, hard alert at 85%.
-- ============================================================================
with constants as (
  select (500::numeric * 1024 * 1024) as db_limit_bytes
),
size_now as (
  select pg_total_relation_size('public.fpl_cache'::regclass)::numeric as cache_bytes
),
totals as (
  select
    cache_bytes,
    db_limit_bytes,
    cache_bytes / db_limit_bytes as usage_ratio
  from size_now, constants
)
select
  pg_size_pretty(cache_bytes::bigint) as cache_size_now,
  pg_size_pretty(db_limit_bytes::bigint) as db_plan_limit,
  round(usage_ratio * 100, 2) as cache_pct_of_plan_limit,
  case
    when usage_ratio >= 0.85 then 'HARD_ALERT'
    when usage_ratio >= 0.70 then 'SOFT_ALERT'
    else 'OK'
  end as status;

-- ============================================================================
-- 7) Optional: season progress and completion signal
--    Helps explain why projections move a lot early in the season.
-- ============================================================================
select
  count(*) as rows_total,
  count(distinct league_id) as leagues_total,
  count(distinct gw) as gws_present,
  count(distinct view) as views_present,
  min(gw) as min_gw,
  max(gw) as max_gw
from public.fpl_cache;
