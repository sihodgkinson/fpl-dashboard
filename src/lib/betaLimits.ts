function parsePositiveInteger(value: string | undefined, fallback: number): number {
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed <= 0) return fallback;
  return parsed;
}

export const MAX_LEAGUES_PER_USER = parsePositiveInteger(
  process.env.FPL_MAX_LEAGUES_PER_USER,
  3
);

export const MAX_MANAGERS_PER_LEAGUE = parsePositiveInteger(
  process.env.FPL_MAX_MANAGERS_PER_LEAGUE,
  30
);

export const LEAGUE_PREVIEW_RATE_LIMIT_WINDOW_SECONDS = parsePositiveInteger(
  process.env.FPL_LEAGUE_PREVIEW_RATE_LIMIT_WINDOW_SECONDS,
  300
);

export const LEAGUE_PREVIEW_RATE_LIMIT_MAX_REQUESTS = parsePositiveInteger(
  process.env.FPL_LEAGUE_PREVIEW_RATE_LIMIT_MAX_REQUESTS,
  10
);

export const LEAGUE_ADD_RATE_LIMIT_WINDOW_SECONDS = parsePositiveInteger(
  process.env.FPL_LEAGUE_ADD_RATE_LIMIT_WINDOW_SECONDS,
  600
);

export const LEAGUE_ADD_RATE_LIMIT_MAX_REQUESTS = parsePositiveInteger(
  process.env.FPL_LEAGUE_ADD_RATE_LIMIT_MAX_REQUESTS,
  2
);

export const ACTIVE_BACKFILL_STALE_AFTER_SECONDS = parsePositiveInteger(
  process.env.FPL_ACTIVE_BACKFILL_STALE_AFTER_SECONDS,
  900
);
