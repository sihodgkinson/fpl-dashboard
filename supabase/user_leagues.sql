create table if not exists public.user_leagues (
  id bigserial primary key,
  user_id uuid not null,
  league_id bigint not null,
  league_name text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, league_id)
);
create index if not exists user_leagues_user_id_idx
  on public.user_leagues (user_id, created_at);

create or replace function public.set_user_leagues_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

drop trigger if exists trg_user_leagues_set_updated_at on public.user_leagues;
create trigger trg_user_leagues_set_updated_at
before update on public.user_leagues
for each row
execute function public.set_user_leagues_updated_at();

alter table public.user_leagues enable row level security;

drop policy if exists "allow user league read" on public.user_leagues;
drop policy if exists "allow user league insert" on public.user_leagues;
drop policy if exists "allow user league delete" on public.user_leagues;

create policy "allow user league read"
on public.user_leagues
for select
to authenticated
using (user_id = auth.uid());

create policy "allow user league insert"
on public.user_leagues
for insert
to authenticated
with check (user_id = auth.uid());

create policy "allow user league delete"
on public.user_leagues
for delete
to authenticated
using (user_id = auth.uid());
