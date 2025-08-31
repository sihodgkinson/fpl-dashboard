import {
  getClassicLeague,
  getCurrentGameweek,
  getMaxGameweek,
} from "@/lib/fpl";
import { enrichStandings } from "@/lib/enrichStandings";
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

  const [currentGw, maxGw] = await Promise.all([
    getCurrentGameweek(),
    getMaxGameweek(),
  ]);

  const gw = Number(params.gw) || currentGw;

  const leagues: {
    id: number;
    name: string;
    standings: EnrichedStanding[] | null;
  }[] = await Promise.all(
    leagueIds.map(async (id) => {
      const data = await getClassicLeague(id);

      if (!data) {
        return {
          id,
          name: "Unavailable League",
          standings: null,
        };
      }

      // ✅ Enrich standings only for the current GW
      let standings: EnrichedStanding[] | null = null;
      if (gw === currentGw) {
        standings = await enrichStandings(data.standings.results, gw, currentGw);
      }

      return {
        id,
        name: data.league?.name ?? "Unknown League",
        standings,
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