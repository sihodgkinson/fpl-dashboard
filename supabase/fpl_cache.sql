-- FPL cache table for read-through API caching.
-- Run in Supabase SQL editor.

create table if not exists public.fpl_cache (
  id bigserial primary key,
  league_id bigint not null,
  gw integer not null check (gw > 0),
  view text not null check (view in ('league', 'transfers', 'chips')),
  payload_json jsonb not null,
  is_final boolean not null default false,
  source_updated_at timestamptz not null default now(),
  fetched_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (league_id, gw, view)
);

create index if not exists fpl_cache_final_gw_idx
  on public.fpl_cache (is_final, gw);

create index if not exists fpl_cache_fetched_at_idx
  on public.fpl_cache (fetched_at desc);

create or replace function public.set_fpl_cache_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists trg_fpl_cache_set_updated_at on public.fpl_cache;
create trigger trg_fpl_cache_set_updated_at
before update on public.fpl_cache
for each row
execute function public.set_fpl_cache_updated_at();

alter table public.fpl_cache enable row level security;

-- Service role bypasses RLS. Optional read policy for authenticated users:
-- create policy "allow read cache" on public.fpl_cache
-- for select to authenticated using (true);

