import { supabase } from "@/lib/db"; // ✅ Supabase client
import {
  ClassicLeagueResponse,
  FplEvent,
  EnrichedStanding,
} from "@/types/fpl";

/**
 * Generic FPL fetch wrapper with error handling
 */
async function fplFetch<T>(
  url: string,
  options?: RequestInit
): Promise<T | null> {
  try {
    const res = await fetch(url, {
      ...options,
      cache: "no-store", // always bypass Next.js cache
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
    `https://fantasy.premierleague.com/api/leagues-classic/${leagueId}/standings/?event=${gw}`
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
  const bootstrap = await getCachedBootstrapStatic();
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
      team_name: s.entry_name,
      player_name: s.player_name,
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
    `/api/league?leagueId=${leagueId}&gw=${gw}&currentGw=${currentGw}`
  );
}

/* -------------------------------------------------------------------------- */
/*                              Bootstrap Static                              */
/* -------------------------------------------------------------------------- */

interface BootstrapStatic {
  events: FplEvent[];
  elements: Player[];
  teams: {
    id: number;
    name: string;
    short_name: string;
    strength: number;
    strength_attack_home: number;
    strength_attack_away: number;
    strength_defence_home: number;
    strength_defence_away: number;
  }[];
  element_types: {
    id: number;
    singular_name: string;
    plural_name: string;
    squad_select: number;
    squad_min_play: number;
    squad_max_play: number;
  }[];
  game_settings: {
    league_join_private_max: number;
    league_join_public_max: number;
    squad_squadsize: number;
    squad_team_limit: number;
    squad_total_spend: number;
    transfers_cost: number;
    ui_currency_multiplier: number;
  };
}

export async function getCachedBootstrapStatic(): Promise<BootstrapStatic | null> {
  const { data: cached, error } = await supabase
    .from("bootstrap_cache")
    .select("data, updated_at")
    .eq("id", 1)
    .maybeSingle();

  if (error) {
    console.error("Supabase bootstrap cache error:", error);
  }

  const now = new Date();
  if (cached) {
    const updatedAt = new Date(cached.updated_at);
    const ageMinutes = (now.getTime() - updatedAt.getTime()) / 1000 / 60;

    if (ageMinutes < 5) {
      return cached.data as BootstrapStatic;
    }
  }

  const res = await fetch(
    "https://fantasy.premierleague.com/api/bootstrap-static/",
    { cache: "no-store" }
  );

  if (!res.ok) {
    console.error("Failed to fetch bootstrap-static:", res.statusText);
    return cached ? (cached.data as BootstrapStatic) : null;
  }

  const fullData = await res.json();

  const slimData: BootstrapStatic = {
    events: fullData.events,
    elements: fullData.elements,
    teams: fullData.teams,
    element_types: fullData.element_types,
    game_settings: fullData.game_settings,
  };

  const { error: upsertError } = await supabase.from("bootstrap_cache").upsert(
    {
      id: 1,
      data: slimData,
      updated_at: now.toISOString(),
    },
    { onConflict: "id" }
  );

  if (upsertError) {
    console.error("Supabase bootstrap upsert error:", upsertError);
  }

  return slimData;
}

export async function getCurrentGameweek(): Promise<number> {
  const data = await getCachedBootstrapStatic();
  if (!data) return 1;
  const current = data.events.find((e) => e.is_current);
  return current?.id ?? 1;
}

export async function getMaxGameweek(): Promise<number> {
  const data = await getCachedBootstrapStatic();
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
  const data = await getCachedBootstrapStatic();
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
    `https://fantasy.premierleague.com/api/entry/${entryId}/event/${gw}/picks/`
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
    `https://fantasy.premierleague.com/api/event/${gw}/live/`
  );
  return data?.elements ?? [];
}

/* -------------------------------------------------------------------------- */
/*                                Transfers                                   */
/* -------------------------------------------------------------------------- */

// FPL API transfer
export interface Transfer {
  element_in: number;
  element_in_cost: number;
  element_out: number;
  element_out_cost: number;
  event: number;
}

// Supabase cached transfer
export interface CachedTransfer {
  manager_id: number;
  gameweek_id: number;
  player_in: number;
  player_out: number;
  cost: number;
}

export async function getTeamTransfers(
  entryId: number
): Promise<Transfer[] | null> {
  return fplFetch<Transfer[]>(
    `https://fantasy.premierleague.com/api/entry/${entryId}/transfers/`
  );
}

// ✅ Cached version
export async function getCachedTransfers(
  managerId: number,
  gw: number,
  currentGw: number
): Promise<CachedTransfer[]> {
  // ✅ Cache both past and current GWs
  if (gw <= currentGw) {
    const { data: cached, error } = await supabase
      .from("transfers")
      .select("*")
      .eq("manager_id", managerId)
      .eq("gameweek_id", gw);

    if (error) {
      console.error("Supabase transfers cache error:", error);
    }

    if (cached && cached.length > 0) {
      return cached as CachedTransfer[];
    }

    // Not cached yet → fetch from API
    const transfers = (await getTeamTransfers(managerId)) ?? [];
    const gwTransfers = transfers.filter((t) => t.event === gw);

    if (gwTransfers.length > 0) {
      // Deduplicate
      const seen = new Set<string>();
      const rows: CachedTransfer[] = [];

      for (const t of gwTransfers) {
        const key = `${managerId}-${gw}-${t.element_in}-${t.element_out}`;
        if (!seen.has(key)) {
          seen.add(key);
          rows.push({
            manager_id: managerId,
            gameweek_id: gw,
            player_in: t.element_in,
            player_out: t.element_out,
            cost: t.element_in_cost - t.element_out_cost,
          });
        }
      }

      const { error: insertError } = await supabase
        .from("transfers")
        .upsert(rows, {
          onConflict: "manager_id,gameweek_id,player_in,player_out",
        });

      if (insertError) {
        console.error("Supabase transfers insert error:", insertError);
      }

      return rows;
    }

    return [];
  }

  // Future GWs → nothing to return
  return [];
}

/* -------------------------------------------------------------------------- */
/*                                  Chips                                     */
/* -------------------------------------------------------------------------- */

// FPL API chip
export interface Chip {
  name: string;
  time: string;
  event: number;
}

// Supabase cached chip
export interface CachedChip {
  manager_id: number;
  gameweek_id: number;
  chip_name: string;
  played_at: string;
}

export async function getTeamChips(entryId: number): Promise<Chip[] | null> {
  const data = await fplFetch<{ chips: Chip[] }>(
    `https://fantasy.premierleague.com/api/entry/${entryId}/history/`
  );
  return data?.chips ?? [];
}

// ✅ Cached version
export async function getCachedChips(
  managerId: number,
  gw: number,
  currentGw: number
): Promise<CachedChip[]> {
  if (gw <= currentGw) {
    const { data: cached, error } = await supabase
      .from("chips")
      .select("*")
      .eq("manager_id", managerId)
      .eq("gameweek_id", gw);

    if (error) {
      console.error("Supabase chips cache error:", error);
    }

    if (cached && cached.length > 0) {
      return cached as CachedChip[];
    }

    const chips = (await getTeamChips(managerId)) ?? [];
    const gwChips = chips.filter((c) => c.event === gw);

    if (gwChips.length > 0) {
      // Deduplicate
      const seen = new Set<string>();
      const rows: CachedChip[] = [];

      for (const c of gwChips) {
        const key = `${managerId}-${gw}-${c.name}`;
        if (!seen.has(key)) {
          seen.add(key);
          rows.push({
            manager_id: managerId,
            gameweek_id: gw,
            chip_name: c.name,
            played_at: c.time,
          });
        }
      }

      const { error: insertError } = await supabase
        .from("chips")
        .upsert(rows, { onConflict: "manager_id,gameweek_id,chip_name" });

      if (insertError) {
        console.error("Supabase chips insert error:", insertError);
      }

      return rows;
    }

    return [];
  }

  // Future GWs → nothing to return
  return [];
}