create table if not exists public.waitlist_signups (
  id bigserial primary key,
  email text not null,
  name text,
  source text not null default 'landing_waitlist',
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create unique index if not exists waitlist_signups_email_lower_uidx
  on public.waitlist_signups (lower(email));

create index if not exists waitlist_signups_created_at_idx
  on public.waitlist_signups (created_at desc);

alter table public.waitlist_signups enable row level security;
