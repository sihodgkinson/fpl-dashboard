import { getClassicLeague, getTeamEventData, getCurrentGameweek, getMaxGameweek } from "@/lib/fpl";
import { LeagueStandingsEntry } from "@/types/fpl";
import { GameweekSelector } from "@/components/dashboard/GameweekSelector";
import { redirect } from "next/navigation";

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: { gw?: string };
}) {
  const leagueId = 430552;

  const [currentGw, maxGw] = await Promise.all([
    getCurrentGameweek(),
    getMaxGameweek(),
  ]);

  // Use ?gw= if provided, otherwise default to current
  const gw = searchParams.gw ? Number(searchParams.gw) : currentGw;

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
      {/* Gameweek Selector */}
      <div className="flex justify-end">
        <GameweekSelector currentGw={currentGw} maxGw={maxGw} />
      </div>

      {/* League Table */}
      <div className="overflow-x-auto">
        <table className="w-full border-collapse text-sm">
          <thead>
            <tr className="border-b">
              <th className="px-4 py-2 text-left">Pos</th>
              <th className="px-4 py-2 text-left">Team</th>
              <th className="px-4 py-2 text-left">Manager</th>
              <th className="px-4 py-2 text-left">GW Points</th>
              <th className="px-4 py-2 text-left">Transfers</th>
              <th className="px-4 py-2 text-left">Hit</th>
              <th className="px-4 py-2 text-left">Bench Points</th>
              <th className="px-4 py-2 text-left">Total Points</th>
            </tr>
          </thead>
          <tbody>
            {enrichedStandings.map((entry) => (
              <tr key={entry.entry} className="border-b">
                <td className="px-4 py-2">{entry.rank}</td>
                <td className="px-4 py-2">{entry.entry_name}</td>
                <td className="px-4 py-2">{entry.player_name}</td>
                <td className="px-4 py-2">{entry.event_total}</td>
                <td className="px-4 py-2">{entry.transfers}</td>
                <td className="px-4 py-2">{entry.hit}</td>
                <td className="px-4 py-2">{entry.benchPoints}</td>
                <td className="px-4 py-2">{entry.total}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}