alter table public.user_leagues
  add column if not exists user_id uuid;

delete from public.user_leagues
where user_id is null;

drop index if exists user_leagues_user_key_idx;
drop index if exists user_leagues_user_key_league_id_unique_idx;
alter table public.user_leagues
  drop column if exists user_key;

alter table public.user_leagues
  alter column user_id set not null;

drop index if exists user_leagues_user_id_league_id_unique_idx;
create unique index if not exists user_leagues_user_id_league_id_unique_idx
  on public.user_leagues (user_id, league_id);

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
