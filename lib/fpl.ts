import {
  ClassicLeagueResponse,
  FplEvent,
  EnrichedStanding,
} from "@/types/fpl";

/**
 * Fetch a classic league standings
 */
export async function getClassicLeague(
  leagueId: number
): Promise<ClassicLeagueResponse> {
  const res = await fetch(
    `https://fantasy.premierleague.com/api/leagues-classic/${leagueId}/standings/`,
    {
      next: { revalidate: 60 }, // safe to cache, small response
    }
  );

  if (!res.ok) {
    throw new Error(`Failed to fetch league ${leagueId}`);
  }

  return res.json();
}

/**
 * Fetch enriched standings from our API route
 * (used client-side with SWR for auto-refresh)
 */
export async function getEnrichedStandings(
  leagueId: number,
  gw: number,
  currentGw: number
): Promise<EnrichedStanding[]> {
  const res = await fetch(
    `/api/standings?leagueId=${leagueId}&gw=${gw}&currentGw=${currentGw}`,
    { cache: "no-store" }
  );

  if (!res.ok) {
    throw new Error("Failed to fetch enriched standings");
  }

  return res.json();
}

/**
 * Team picks type
 */
export interface TeamPick {
  element: number; // player ID
  multiplier: number; // 1, 2 (captain), 3 (triple captain)
  is_captain: boolean;
  is_vice_captain: boolean;
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
  picks: TeamPick[];
}

export async function getTeamEventData(
  entryId: number,
  gw: number
): Promise<TeamEventData> {
  const res = await fetch(
    `https://fantasy.premierleague.com/api/entry/${entryId}/event/${gw}/picks/`,
    {
      next: { revalidate: 60 }, // small response, can cache
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
      cache: "no-store", // disable caching (response > 2MB)
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
      cache: "no-store", // disable caching (response > 2MB)
    }
  );

  if (!res.ok) {
    throw new Error("Failed to fetch bootstrap-static");
  }

  const data = await res.json();
  const events: FplEvent[] = data.events;

  return events.filter((e) => e.finished || e.is_current).length;
}

/**
 * Live player stats type
 */
export interface LivePlayerStats {
  id: number;
  stats: {
    total_points: number;
  };
}

/**
 * Fetch live event data (real-time player points)
 */
export async function getLiveEventData(
  gw: number
): Promise<LivePlayerStats[]> {
  const res = await fetch(
    `https://fantasy.premierleague.com/api/event/${gw}/live/`,
    {
      cache: "no-store", // always fetch fresh
    }
  );

  if (!res.ok) {
    throw new Error(`Failed to fetch live data for GW ${gw}`);
  }

  const data = await res.json();
  return data.elements as LivePlayerStats[];
}

export interface Transfer {
  element_in: number;
  element_in_cost: number;
  element_out: number;
  element_out_cost: number;
  event: number;
}

export async function getTeamTransfers(entryId: number): Promise<Transfer[]> {
  const res = await fetch(
    `https://fantasy.premierleague.com/api/entry/${entryId}/transfers/`,
    { cache: "no-store" }
  );

  if (!res.ok) {
    throw new Error(`Failed to fetch transfers for team ${entryId}`);
  }

  return res.json();
}

export interface Player {
  id: number;
  web_name: string;
  team: number;
  element_type: number;
}

export async function getPlayers(): Promise<Player[]> {
  const res = await fetch(
    "https://fantasy.premierleague.com/api/bootstrap-static/",
    { cache: "force-cache" }
  );

  if (!res.ok) {
    throw new Error("Failed to fetch players");
  }

  const data = await res.json();
  return data.elements as Player[];
}