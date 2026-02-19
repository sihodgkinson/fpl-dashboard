alter table public.user_leagues
  add column if not exists user_id uuid;

alter table public.user_leagues
  alter column user_key drop not null;

alter table public.user_leagues
  drop constraint if exists user_leagues_user_key_league_id_key;

create unique index if not exists user_leagues_user_key_league_id_unique_idx
  on public.user_leagues (user_key, league_id)
  where user_key is not null;

create unique index if not exists user_leagues_user_id_league_id_unique_idx
  on public.user_leagues (user_id, league_id)
  where user_id is not null;

create index if not exists user_leagues_user_id_idx
  on public.user_leagues (user_id, created_at);

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
