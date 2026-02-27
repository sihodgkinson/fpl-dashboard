import { enrichStandings } from "@/features/league/utils/enrichStandings";
import { getClassicLeague, getCurrentGameweek, getMaxGameweek } from "@/lib/fpl";
import { getServerSessionUser } from "@/lib/supabaseAuth";
import { listUserLeagues } from "@/lib/userLeagues";
import { EnrichedStanding } from "@/types/fpl";

interface QueryParams {
  leagueId?: string;
  gw?: string;
}

export interface LeagueSummary {
  id: number;
  name: string;
  standings: EnrichedStanding[] | null;
  stats: {
    mostPoints: EnrichedStanding | null;
    fewestPoints: EnrichedStanding | null;
    mostBench: EnrichedStanding | null;
    mostTransfers: EnrichedStanding | null;
  } | null;
}

export type LeagueIQPageState =
  | {
      status: "unauthenticated";
      currentGw: number;
      maxGw: number;
    }
  | {
      status: "onboarding";
      currentGw: number;
      maxGw: number;
    }
  | {
      status: "ready";
      currentGw: number;
      maxGw: number;
      gw: number;
      selectedLeagueId: number;
      leagues: LeagueSummary[];
    };

export async function loadLeagueIQPageData(
  searchParams: QueryParams
): Promise<LeagueIQPageState> {
  const [currentGw, maxGw] = await Promise.all([getCurrentGameweek(), getMaxGameweek()]);
  const sessionUser = await getServerSessionUser();

  if (!sessionUser?.id) {
    return {
      status: "unauthenticated",
      currentGw,
      maxGw,
    };
  }

  const configuredLeagues = await listUserLeagues(sessionUser.id);
  if (configuredLeagues.length === 0) {
    return {
      status: "onboarding",
      currentGw,
      maxGw,
    };
  }

  const leagueIds = configuredLeagues.map((league) => league.id);
  const selectedLeagueIdParam = Number(searchParams.leagueId);
  const selectedLeagueId =
    Number.isInteger(selectedLeagueIdParam) && leagueIds.includes(selectedLeagueIdParam)
      ? selectedLeagueIdParam
      : leagueIds[0];

  const gwParam = Number(searchParams.gw);
  const gw = Number.isInteger(gwParam) && gwParam > 0 ? Math.min(gwParam, maxGw) : currentGw;

  const leagueDataEntries = await Promise.all(
    configuredLeagues.map(async (league) => [league.id, await getClassicLeague(league.id)] as const)
  );

  const leagueDataById = new Map(leagueDataEntries);
  const selectedLeagueData = leagueDataById.get(selectedLeagueId) ?? null;

  let selectedStandings: EnrichedStanding[] | null = null;
  let selectedStats: LeagueSummary["stats"] = null;

  if (selectedLeagueData && gw === currentGw) {
    selectedStandings = await enrichStandings(
      selectedLeagueData.standings.results,
      gw,
      currentGw
    );

    if (selectedStandings.length > 0) {
      selectedStats = {
        mostPoints: selectedStandings.reduce((a, b) => (b.gwPoints > a.gwPoints ? b : a)),
        fewestPoints: selectedStandings.reduce((a, b) => (b.gwPoints < a.gwPoints ? b : a)),
        mostBench: selectedStandings.reduce((a, b) => (b.benchPoints > a.benchPoints ? b : a)),
        mostTransfers: selectedStandings.reduce((a, b) => (b.transfers > a.transfers ? b : a)),
      };
    }
  }

  const leagues: LeagueSummary[] = configuredLeagues
    .map((league) => {
      const officialLeagueName = leagueDataById.get(league.id)?.league?.name?.trim();
      const leagueName = officialLeagueName || league.name;

      return {
        id: league.id,
        name: leagueName,
        standings: league.id === selectedLeagueId ? selectedStandings : null,
        stats: league.id === selectedLeagueId ? selectedStats : null,
      };
    })
    .sort((a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: "base" }));

  return {
    status: "ready",
    currentGw,
    maxGw,
    gw,
    selectedLeagueId,
    leagues,
  };
}
