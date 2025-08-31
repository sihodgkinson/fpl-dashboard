// src/lib/fpl.ts
import { supabase } from "@/lib/db"; // ✅ Supabase client
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

/**
 * Fetch league standings with Supabase caching
 */
export async function getClassicLeague(
  leagueId: number,
  gw: number,
  currentGw: number
): Promise<ClassicLeagueResponse | null> {
  // 1. For past GWs, check Supabase first
  if (gw < currentGw) {
    const { data, error } = await supabase
      .from("standings")
      .select("*")
      .eq("league_id", leagueId)
      .eq("gameweek_id", gw);

    if (error) {
      console.error("Supabase select error:", error.message);
    }

    if (data && data.length > 0) {
      console.log("✅ Returning cached standings from Supabase");

      // ✅ Fetch league name from Supabase
      const { data: leagueData, error: leagueError } = await supabase
        .from("leagues")
        .select("name")
        .eq("id", leagueId)
        .single();

      if (leagueError) {
        console.error("Supabase league fetch error:", leagueError.message);
      }

      return {
        league: { id: leagueId, name: leagueData?.name ?? "Unknown League" },
        standings: { results: data },
      } as ClassicLeagueResponse;
    }
  }

  // 2. Otherwise, fetch from FPL API
  const json = await fplFetch<ClassicLeagueResponse>(
    `https://fantasy.premierleague.com/api/leagues-classic/${leagueId}/standings/?event=${gw}`,
    { cache: "no-store" }
  );

  if (!json) return null;

  // ✅ 2a. Ensure league exists in Supabase
  if (json.league) {
    const { error: leagueError } = await supabase.from("leagues").upsert(
      {
        id: json.league.id,
        name: json.league.name,
      },
      { onConflict: "id" }
    );

    if (leagueError) {
      console.error("Supabase league insert error:", leagueError.message);
    } else {
      console.log(`✅ League ${json.league.name} ensured in Supabase`);
    }
  }

  // ✅ 2b. Ensure managers exist in Supabase
  if (json.standings?.results) {
    const managerRows = json.standings.results.map((s) => ({
      id: s.entry,
      name: s.player_name,
      team_name: s.entry_name,
      league_id: leagueId,
    }));

    const { error: managerError } = await supabase
      .from("managers")
      .upsert(managerRows, { onConflict: "id" });

    if (managerError) {
      console.error("Supabase manager insert error:", managerError.message);
    } else {
      console.log("✅ Managers ensured in Supabase");
    }
  }

  // ✅ 2c. Ensure gameweek exists in Supabase
  const bootstrap = await getBootstrapStatic();
  if (bootstrap) {
    const gwData = bootstrap.events.find((e) => e.id === gw);
    if (gwData) {
      const { error: gwError } = await supabase.from("gameweeks").upsert(
        {
          id: gwData.id,
          deadline: gwData.deadline_time,
        },
        { onConflict: "id" }
      );
      if (gwError) {
        console.error("Supabase gameweek insert error:", gwError.message);
      } else {
        console.log(`✅ Gameweek ${gwData.id} ensured in Supabase`);
      }
    }
  }

  // 3. Save standings to Supabase if it's a past GW
  if (gw < currentGw && json.standings?.results) {
    const rows = json.standings.results.map((s) => ({
      league_id: leagueId,
      manager_id: s.entry,
      gameweek_id: gw,
      gw_points: s.event_total,
      total_points: s.total,
      rank: s.rank,
      transfers: s.event_transfers ?? 0,
      bench_points: s.entry_bench_points ?? 0,
      chip_used: s.active_chip ?? null,
    }));

    const { error } = await supabase.from("standings").upsert(rows, {
      onConflict: "league_id,manager_id,gameweek_id",
    });

    if (error) {
      console.error("Supabase insert error:", error.message, error.details);
    } else {
      console.log("✅ Cached standings in Supabase");
    }
  }

  return json;
}

export async function getEnrichedStandings(
  leagueId: number,
  gw: number,
  currentGw: number
): Promise<EnrichedStanding[] | null> {
  return fplFetch<EnrichedStanding[]>(
    `/api/league?leagueId=${leagueId}&gw=${gw}&currentGw=${currentGw}`,
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