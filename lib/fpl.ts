// lib/fpl.ts
import {
  ClassicLeagueResponse,
  FplEvent,
  EnrichedStanding,
} from "@/types/fpl";

/**
 * Generic FPL fetch wrapper with caching + error handling
 */
async function fplFetch<T>(
  url: string,
  options?: RequestInit & { revalidate?: number }
): Promise<T | null> {
  try {
    const res = await fetch(url, {
      ...options,
      next: options?.revalidate
        ? { revalidate: options.revalidate }
        : undefined,
    });

    if (!res.ok) {
      console.error(`FPL API error: ${res.status} ${res.statusText} (${url})`);
      return null;
    }

    return res.json();
  } catch (err) {
    console.error(`FPL API fetch failed (${url}):`, err);
    return null;
  }
}

/* -------------------------------------------------------------------------- */
/*                                League Data                                 */
/* -------------------------------------------------------------------------- */

export async function getClassicLeague(
  leagueId: number
): Promise<ClassicLeagueResponse | null> {
  return fplFetch<ClassicLeagueResponse>(
    `https://fantasy.premierleague.com/api/leagues-classic/${leagueId}/standings/`,
    { revalidate: 60 }
  );
}

export async function getEnrichedStandings(
  leagueId: number,
  gw: number,
  currentGw: number
): Promise<EnrichedStanding[] | null> {
  return fplFetch<EnrichedStanding[]>(
    `/api/standings?leagueId=${leagueId}&gw=${gw}&currentGw=${currentGw}`,
    { cache: "no-store" }
  );
}

/* -------------------------------------------------------------------------- */
/*                              Bootstrap Static                              */
/* -------------------------------------------------------------------------- */

interface BootstrapStatic {
  events: FplEvent[];
  elements: Player[];
  // add other fields if needed
}

export async function getBootstrapStatic(): Promise<BootstrapStatic | null> {
  return fplFetch<BootstrapStatic>(
    "https://fantasy.premierleague.com/api/bootstrap-static/",
    { revalidate: 300 } // cache for 5 minutes
  );
}

export async function getCurrentGameweek(): Promise<number> {
  const data = await getBootstrapStatic();
  if (!data) return 1;
  const current = data.events.find((e) => e.is_current);
  return current?.id ?? 1;
}

export async function getMaxGameweek(): Promise<number> {
  const data = await getBootstrapStatic();
  if (!data) return 1;
  return data.events.filter((e) => e.finished || e.is_current).length;
}

export interface Player {
  id: number;
  web_name: string;
  team: number;
  element_type: number;
}

export async function getPlayers(): Promise<Player[]> {
  const data = await getBootstrapStatic();
  return data?.elements ?? [];
}

/* -------------------------------------------------------------------------- */
/*                                Team Events                                 */
/* -------------------------------------------------------------------------- */

export interface TeamPick {
  element: number;
  multiplier: number;
  is_captain: boolean;
  is_vice_captain: boolean;
}

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
): Promise<TeamEventData | null> {
  return fplFetch<TeamEventData>(
    `https://fantasy.premierleague.com/api/entry/${entryId}/event/${gw}/picks/`,
    { revalidate: 60 }
  );
}

/* -------------------------------------------------------------------------- */
/*                                Live Events                                 */
/* -------------------------------------------------------------------------- */

export interface LivePlayerStats {
  id: number;
  stats: {
    total_points: number;
  };
}

export async function getLiveEventData(
  gw: number
): Promise<LivePlayerStats[] | null> {
  const data = await fplFetch<{ elements: LivePlayerStats[] }>(
    `https://fantasy.premierleague.com/api/event/${gw}/live/`,
    { cache: "no-store" }
  );
  return data?.elements ?? [];
}

/* -------------------------------------------------------------------------- */
/*                                Transfers                                   */
/* -------------------------------------------------------------------------- */

export interface Transfer {
  element_in: number;
  element_in_cost: number;
  element_out: number;
  element_out_cost: number;
  event: number;
}

export async function getTeamTransfers(
  entryId: number
): Promise<Transfer[] | null> {
  return fplFetch<Transfer[]>(
    `https://fantasy.premierleague.com/api/entry/${entryId}/transfers/`,
    { revalidate: 60 }
  );
}

/* -------------------------------------------------------------------------- */
/*                                  Chips                                     */
/* -------------------------------------------------------------------------- */

export interface Chip {
  name: string;
  time: string;
  event: number;
}

export async function getTeamChips(entryId: number): Promise<Chip[] | null> {
  const data = await fplFetch<{ chips: Chip[] }>(
    `https://fantasy.premierleague.com/api/entry/${entryId}/history/`,
    { revalidate: 60 }
  );
  return data?.chips ?? [];
}