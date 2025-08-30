import {
  getClassicLeague,
  getCurrentGameweek,
  getMaxGameweek,
} from "@/lib/fpl";
import DashboardClient from "@/components/dashboard/DashboardClient";
import { EnrichedStanding } from "@/types/fpl";

const leagueIds = [430552, 4311, 1295109];

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ leagueId?: string; gw?: string }>;
}) {
  const params = await searchParams;
  const selectedLeagueId = Number(params.leagueId) || leagueIds[0];

  // Fetch current/max GW first
  const [currentGw, maxGw] = await Promise.all([
    getCurrentGameweek(),
    getMaxGameweek(),
  ]);

  const gw = Number(params.gw) || currentGw;

  // Preload all leagues (name + standings.results) for the current GW
  const leagues: {
    id: number;
    name: string;
    standings: EnrichedStanding[] | null;
  }[] = await Promise.all(
    leagueIds.map(async (id) => {
      const data = await getClassicLeague(id);

      if (!data) {
        // API failed for this league
        return {
          id,
          name: "Unavailable League",
          standings: null,
        };
      }

      return {
        id,
        name: data.league?.name ?? "Unknown League",
        standings: (data.standings?.results as EnrichedStanding[]) ?? null,
      };
    })
  );

  return (
    <DashboardClient
      leagues={leagues}
      selectedLeagueId={selectedLeagueId}
      currentGw={currentGw}
      maxGw={maxGw}
      gw={gw}
    />
  );
}