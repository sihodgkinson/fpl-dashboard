import {
  getClassicLeague,
  getCurrentGameweek,
  getMaxGameweek,
} from "@/lib/fpl";
import { enrichStandings } from "@/features/league/utils/enrichStandings";
import DashboardClient from "@/app/(dashboard)/[leagueID]/DashboardClient";
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
    stats: {
      mostPoints: EnrichedStanding | null;
      fewestPoints: EnrichedStanding | null;
      mostBench: EnrichedStanding | null;
      mostTransfers: EnrichedStanding | null;
    } | null;
  }[] = await Promise.all(
    leagueIds.map(async (id) => {
      const data = await getClassicLeague(id, gw, currentGw);

      if (!data) {
        return {
          id,
          name: "Unavailable League",
          standings: null,
          stats: null,
        };
      }

      let standings: EnrichedStanding[] | null = null;
      let stats: {
        mostPoints: EnrichedStanding | null;
        fewestPoints: EnrichedStanding | null;
        mostBench: EnrichedStanding | null;
        mostTransfers: EnrichedStanding | null;
      } | null = null;

      if (gw === currentGw && data.standings?.results) {
        // ✅ Normalize raw API standings into DB-style shape
        const normalizedEntries = data.standings.results.map((s) => ({
          manager_id: s.entry, // FPL entry ID
          team_name: s.entry_name,
          player_name: s.player_name,
          total: s.total,
        }));

        standings = await enrichStandings(normalizedEntries, gw, currentGw);

        if (standings.length > 0) {
          stats = {
            mostPoints: standings.reduce((a, b) =>
              b.gwPoints > a.gwPoints ? b : a
            ),
            fewestPoints: standings.reduce((a, b) =>
              b.gwPoints < a.gwPoints ? b : a
            ),
            mostBench: standings.reduce((a, b) =>
              b.benchPoints > a.benchPoints ? b : a
            ),
            mostTransfers: standings.reduce((a, b) =>
              b.transfers > a.transfers ? b : a
            ),
          };
        }
      }

      return {
        id,
        name: data.league?.name ?? "Unknown League",
        standings,
        stats,
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