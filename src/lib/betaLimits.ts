function parsePositiveInteger(value: string | undefined, fallback: number): number {
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed <= 0) return fallback;
  return parsed;
}

function parseBoolean(value: string | undefined, fallback: boolean): boolean {
  if (value === undefined) return fallback;
  const normalized = value.trim().toLowerCase();
  if (["1", "true", "yes", "on"].includes(normalized)) return true;
  if (["0", "false", "no", "off"].includes(normalized)) return false;
  return fallback;
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
  5
);

export const ACTIVE_BACKFILL_STALE_AFTER_SECONDS = parsePositiveInteger(
  process.env.FPL_ACTIVE_BACKFILL_STALE_AFTER_SECONDS,
  900
);

export const ADD_LEAGUE_ENABLED = parseBoolean(process.env.FPL_ADD_LEAGUE_ENABLED, true);

export const GLOBAL_ACTIVE_BACKFILL_LIMIT = parsePositiveInteger(
  process.env.FPL_GLOBAL_ACTIVE_BACKFILL_LIMIT,
  25
);

export const RATE_LIMIT_RETENTION_HOURS = parsePositiveInteger(
  process.env.FPL_RATE_LIMIT_RETENTION_HOURS,
  48
);
