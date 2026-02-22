create table if not exists public.request_rate_limits (
  id bigserial primary key,
  scope text not null,
  identifier text not null,
  created_at timestamptz not null default now()
);

create index if not exists request_rate_limits_scope_identifier_created_idx
  on public.request_rate_limits (scope, identifier, created_at);

create index if not exists request_rate_limits_created_idx
  on public.request_rate_limits (created_at);

alter table public.request_rate_limits enable row level security;

create or replace function public.check_request_rate_limit(
  p_scope text,
  p_identifier text,
  p_window_seconds integer,
  p_max_requests integer
)
returns table (allowed boolean, retry_after_seconds integer)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_now timestamptz := now();
  v_window_seconds integer := greatest(coalesce(p_window_seconds, 0), 1);
  v_max_requests integer := greatest(coalesce(p_max_requests, 0), 1);
  v_count integer := 0;
  v_oldest timestamptz := null;
  v_retry_after integer := 0;
begin
  if p_scope is null or length(trim(p_scope)) = 0 then
    return query select false, 1;
    return;
  end if;

  if p_identifier is null or length(trim(p_identifier)) = 0 then
    return query select false, 1;
    return;
  end if;

  -- Serialize checks per rate-limit key to avoid race conditions.
  perform pg_advisory_xact_lock(hashtextextended(p_scope || ':' || p_identifier, 0));

  -- Opportunistic cleanup of old records.
  delete from public.request_rate_limits
  where created_at < (v_now - make_interval(secs => v_window_seconds * 2));

  select
    count(*)::int,
    min(created_at)
  into v_count, v_oldest
  from public.request_rate_limits
  where scope = p_scope
    and identifier = p_identifier
    and created_at > (v_now - make_interval(secs => v_window_seconds));

  if v_count >= v_max_requests then
    v_retry_after := greatest(
      1,
      ceil(
        extract(
          epoch from (
            coalesce(v_oldest, v_now) + make_interval(secs => v_window_seconds) - v_now
          )
        )
      )::int
    );
    return query select false, v_retry_after;
    return;
  end if;

  insert into public.request_rate_limits (scope, identifier, created_at)
  values (p_scope, p_identifier, v_now);

  return query select true, 0;
end;
$$;
