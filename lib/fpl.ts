import { ClassicLeagueResponse, FplEvent } from "@/types/fpl";

/**
 * Fetch a classic league standings
 */
export async function getClassicLeague(
  leagueId: number
): Promise<ClassicLeagueResponse> {
  const res = await fetch(
    `https://fantasy.premierleague.com/api/leagues-classic/${leagueId}/standings/`,
    {
      next: { revalidate: 60 }, // revalidate every 60s
    }
  );

  if (!res.ok) {
    throw new Error(`Failed to fetch league ${leagueId}`);
  }

  return res.json();
}

/**
 * Fetch a team's event data (transfers, hits, bench points, etc.)
 */
export interface TeamEventData {
  entry_history: {
    event: number;
    points: number;
    total_points: number;
    event_transfers: number;
    event_transfers_cost: number;
    points_on_bench: number;
  };
}

export async function getTeamEventData(
  entryId: number,
  gw: number
): Promise<TeamEventData> {
  const res = await fetch(
    `https://fantasy.premierleague.com/api/entry/${entryId}/event/${gw}/picks/`,
    {
      next: { revalidate: 60 },
    }
  );

  if (!res.ok) {
    throw new Error(`Failed to fetch team ${entryId} for GW ${gw}`);
  }

  return res.json();
}

/**
 * Get the current gameweek ID
 */
export async function getCurrentGameweek(): Promise<number> {
  const res = await fetch(
    "https://fantasy.premierleague.com/api/bootstrap-static/",
    {
      next: { revalidate: 60 },
    }
  );

  if (!res.ok) {
    throw new Error("Failed to fetch bootstrap-static");
  }

  const data = await res.json();
  const events: FplEvent[] = data.events;

  const current = events.find((e) => e.is_current);
  return current?.id ?? 1;
}

/**
 * Get the maximum available gameweek (finished or current)
 */
export async function getMaxGameweek(): Promise<number> {
  const res = await fetch(
    "https://fantasy.premierleague.com/api/bootstrap-static/",
    {
      next: { revalidate: 60 },
    }
  );

  if (!res.ok) {
    throw new Error("Failed to fetch bootstrap-static");
  }

  const data = await res.json();
  const events: FplEvent[] = data.events;

  return events.filter((e) => e.finished || e.is_current).length;
}