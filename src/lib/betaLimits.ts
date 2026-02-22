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
