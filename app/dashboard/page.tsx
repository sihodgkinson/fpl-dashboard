import {
  getClassicLeague,
  getTeamEventData,
  getCurrentGameweek,
  getMaxGameweek,
} from "@/lib/fpl";
import { LeagueStandingsEntry } from "@/types/fpl";
import { redirect } from "next/navigation";

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ gw?: string }>;
}) {
  const leagueId = 430552;

  const [currentGw, maxGw] = await Promise.all([
    getCurrentGameweek(),
    getMaxGameweek(),
  ]);

  // Await searchParams (required in Next.js 15)
  const params = await searchParams;

  // Use ?gw= if provided, otherwise default to current
  const gw = params.gw ? Number(params.gw) : currentGw;

  // Prevent selecting future GWs
  if (gw > maxGw) {
    redirect(`/dashboard?gw=${maxGw}`);
  }

  const data = await getClassicLeague(leagueId);
  const standings: LeagueStandingsEntry[] = data.standings.results;

  const enrichedStandings = await Promise.all(
    standings.map(async (entry) => {
      const teamData = await getTeamEventData(entry.entry, gw);

      return {
        ...entry,
        transfers: teamData.entry_history.event_transfers,
        hit: -teamData.entry_history.event_transfers_cost,
        benchPoints: teamData.entry_history.points_on_bench,
      };
    })
  );

  return (
    <div className="space-y-4">
      
      {/* League Table */}
      <div className="overflow-x-auto">
        <table className="w-full border-collapse text-sm">
          <thead>
            <tr className="border-b bg-muted/50 text-foreground">
              <th className="px-4 py-2 text-left">Pos</th>
              <th className="px-4 py-2 text-left">Team</th>
              <th className="px-4 py-2 text-left">Manager</th>
              <th className="px-4 py-2 text-right">GW Points</th>
              <th className="px-4 py-2 text-right">Transfers</th>
              <th className="px-4 py-2 text-right">Hit</th>
              <th className="px-4 py-2 text-right">Bench Points</th>
              <th className="px-4 py-2 text-right">Total Points</th>
            </tr>
          </thead>
          <tbody>
            {enrichedStandings.map((entry) => (
              <tr
                key={entry.entry}
                className="border-b hover:bg-muted/30"
              >
                <td className="px-4 py-2 font-mono">{entry.rank}</td>
                <td className="px-4 py-2">{entry.entry_name}</td>
                <td className="px-4 py-2">{entry.player_name}</td>
                <td className="px-4 py-2 text-right font-mono">
                  {entry.event_total}
                </td>
                <td className="px-4 py-2 text-right font-mono">
                  {entry.transfers}
                </td>
                <td className="px-4 py-2 text-right font-mono">{entry.hit}</td>
                <td className="px-4 py-2 text-right font-mono">
                  {entry.benchPoints}
                </td>
                <td className="px-4 py-2 text-right font-mono">{entry.total}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}