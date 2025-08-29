import {
  getClassicLeague,
  getTeamEventData,
  getCurrentGameweek,
  getMaxGameweek,
} from "@/lib/fpl";
import { LeagueStandingsEntry } from "@/types/fpl";
import { redirect } from "next/navigation";
import { ChevronUp, ChevronDown, Minus } from "lucide-react";

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

  // Get league standings (for team + manager names)
  const data = await getClassicLeague(leagueId);
  const standings: LeagueStandingsEntry[] = data.standings.results;

  // Fetch GW-specific data for each team
  const enrichedStandings = await Promise.all(
    standings.map(async (entry) => {
      const teamData = await getTeamEventData(entry.entry, gw);

      return {
        entry: entry.entry,
        entry_name: entry.entry_name,
        player_name: entry.player_name,
        gwPoints: teamData.entry_history.points,
        totalPoints: teamData.entry_history.total_points,
        transfers: teamData.entry_history.event_transfers,
        hit: -teamData.entry_history.event_transfers_cost,
        benchPoints: teamData.entry_history.points_on_bench,
      };
    })
  );

  // Sort by totalPoints (descending) to assign ranks for this GW
  let rankedStandings = enrichedStandings
    .sort((a, b) => b.totalPoints - a.totalPoints)
    .map((team, index) => ({
      ...team,
      rank: index + 1,
      movement: 0, // default
    }));

  // If not GW1, calculate movement vs previous GW
  if (gw > 1) {
    const prevStandings = await Promise.all(
      standings.map(async (entry) => {
        const teamData = await getTeamEventData(entry.entry, gw - 1);
        return {
          entry: entry.entry,
          totalPoints: teamData.entry_history.total_points,
        };
      })
    );

    const prevRanks = prevStandings
      .sort((a, b) => b.totalPoints - a.totalPoints)
      .map((team, index) => ({
        entry: team.entry,
        prevRank: index + 1,
      }));

    rankedStandings = rankedStandings.map((team) => {
      const prev = prevRanks.find((p) => p.entry === team.entry);
      const movement = prev ? prev.prevRank - team.rank : 0; // +ve = moved up
      return { ...team, movement };
    });
  }

  return (
    <div className="w-full overflow-x-auto rounded-md border border-border overflow-hidden">
  <table className="w-full table-auto text-sm">
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
      {rankedStandings.map((entry) => (
        <tr
          key={entry.entry}
          className="border-b hover:bg-muted/30 last:border-b-0"
        >
          <td className="px-4 py-2 font-mono">
            <div className="flex items-center gap-1">
              <span>{entry.rank}</span>
              {entry.movement > 0 && (
                <ChevronUp className="h-4 w-4 text-green-600" />
              )}
              {entry.movement < 0 && (
                <ChevronDown className="h-4 w-4 text-red-600" />
              )}
              {entry.movement === 0 && (
                <Minus className="h-4 w-4 text-muted-foreground" />
              )}
            </div>
          </td>
          <td className="px-4 py-2">{entry.entry_name}</td>
          <td className="px-4 py-2">{entry.player_name}</td>
          <td className="px-4 py-2 text-right font-mono">
            {entry.gwPoints}
          </td>
          <td className="px-4 py-2 text-right font-mono">
            {entry.transfers}
          </td>
          <td className="px-4 py-2 text-right font-mono">{entry.hit}</td>
          <td className="px-4 py-2 text-right font-mono">
            {entry.benchPoints}
          </td>
          <td className="px-4 py-2 text-right font-mono">
            {entry.totalPoints}
          </td>
        </tr>
      ))}
    </tbody>
  </table>
</div>
  );
}