create table if not exists public.user_leagues (
  id bigserial primary key,
  user_key text,
  user_id uuid,
  league_id bigint not null,
  league_name text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (user_key is not null or user_id is not null)
);

alter table public.user_leagues
  drop column if exists nickname;

create index if not exists user_leagues_user_key_idx
  on public.user_leagues (user_key, created_at);
create index if not exists user_leagues_user_id_idx
  on public.user_leagues (user_id, created_at);
create unique index if not exists user_leagues_user_key_league_id_unique_idx
  on public.user_leagues (user_key, league_id)
  where user_key is not null;
create unique index if not exists user_leagues_user_id_league_id_unique_idx
  on public.user_leagues (user_id, league_id)
  where user_id is not null;

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
