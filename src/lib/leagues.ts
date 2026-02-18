const DEFAULT_LEAGUE_IDS = [430552, 4311, 1295109];

export function getLeagueIds(): number[] {
  const envValue = process.env.FPL_LEAGUE_IDS;
  if (!envValue) return DEFAULT_LEAGUE_IDS;

  const parsed = envValue
    .split(",")
    .map((value) => Number(value.trim()))
    .filter((value) => Number.isInteger(value) && value > 0);

  return parsed.length > 0 ? parsed : DEFAULT_LEAGUE_IDS;
}

export const LEAGUE_IDS = getLeagueIds();

