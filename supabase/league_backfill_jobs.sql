create table if not exists public.league_backfill_jobs (
  id bigserial primary key,
  league_id bigint not null,
  status text not null check (status in ('pending', 'running', 'succeeded', 'failed')),
  attempts integer not null default 0,
  last_error text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  started_at timestamptz,
  finished_at timestamptz
);

create unique index if not exists league_backfill_jobs_active_league_idx
  on public.league_backfill_jobs (league_id)
  where status in ('pending', 'running');

create index if not exists league_backfill_jobs_status_created_idx
  on public.league_backfill_jobs (status, created_at);

create or replace function public.set_league_backfill_jobs_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

drop trigger if exists trg_league_backfill_jobs_set_updated_at on public.league_backfill_jobs;
create trigger trg_league_backfill_jobs_set_updated_at
before update on public.league_backfill_jobs
for each row
execute function public.set_league_backfill_jobs_updated_at();

alter table public.league_backfill_jobs enable row level security;
