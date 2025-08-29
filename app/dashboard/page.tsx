import { getClassicLeague } from "@/lib/fpl";
import { LeagueStandingsEntry } from "@/types/fpl";

export default async function DashboardPage() {
  const leagueId = 430552;
  const data = await getClassicLeague(leagueId);

  const standings: LeagueStandingsEntry[] = data.standings.results;

  return (
    <div className="overflow-x-auto">
      <table className="w-full border-collapse text-sm">
        <thead>
          <tr className="border-b">
            <th className="px-4 py-2 text-left">Pos</th>
            <th className="px-4 py-2 text-left">Team</th>
            <th className="px-4 py-2 text-left">Manager</th>
            <th className="px-4 py-2 text-left">GW Points</th>
            <th className="px-4 py-2 text-left">Total Points</th>
          </tr>
        </thead>
        <tbody>
          {standings.map((entry) => (
            <tr key={entry.entry} className="border-b">
              <td className="px-4 py-2">{entry.rank}</td>
              <td className="px-4 py-2">{entry.entry_name}</td>
              <td className="px-4 py-2">{entry.player_name}</td>
              <td className="px-4 py-2">{entry.event_total}</td>
              <td className="px-4 py-2">{entry.total}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}