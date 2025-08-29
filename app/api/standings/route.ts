import { NextResponse } from "next/server";
import {
  getClassicLeague,
  getTeamEventData,
  getLiveEventData,
  TeamEventData,
} from "@/lib/fpl";
import { EnrichedStanding } from "@/types/fpl";

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const leagueId = Number(searchParams.get("leagueId"));
  const gw = Number(searchParams.get("gw"));
  const currentGw = Number(searchParams.get("currentGw"));

  const data = await getClassicLeague(leagueId);
  const standings = data.standings.results as {
    entry: number;
    entry_name: string;
    player_name: string;
  }[];

  const enrichedStandings: EnrichedStanding[] = await Promise.all(
    standings.map(async (entry) => {
      const teamData: TeamEventData = await getTeamEventData(entry.entry, gw);

      let gwPoints = teamData.entry_history.points;
      let totalPoints = teamData.entry_history.total_points;

      // If current GW, recalc live points
      if (gw === currentGw) {
        const liveData = await getLiveEventData(gw);
        const livePointsMap = new Map(
          liveData.map((p) => [p.id, p.stats.total_points])
        );

        gwPoints = teamData.picks.reduce((sum, pick) => {
          const playerPoints = livePointsMap.get(pick.element) ?? 0;
          return sum + playerPoints * pick.multiplier;
        }, 0);

        totalPoints =
          teamData.entry_history.total_points -
          teamData.entry_history.points +
          gwPoints;
      }

      return {
        entry: entry.entry,
        entry_name: entry.entry_name,
        player_name: entry.player_name,
        gwPoints,
        totalPoints,
        transfers: teamData.entry_history.event_transfers,
        hit: -teamData.entry_history.event_transfers_cost,
        benchPoints: teamData.entry_history.points_on_bench,
        rank: 0, // placeholder, will assign below
        movement: 0, // placeholder, will assign below
      };
    })
  );

  // Sort by totalPoints and assign ranks
  let ranked: EnrichedStanding[] = enrichedStandings
    .sort((a, b) => b.totalPoints - a.totalPoints)
    .map((team, index) => ({ ...team, rank: index + 1 }));

  // --- Calculate movement vs previous GW ---
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

    ranked = ranked.map((team) => {
      const prev = prevRanks.find((p) => p.entry === team.entry);
      const movement = prev ? prev.prevRank - team.rank : 0; // +ve = moved up
      return { ...team, movement };
    });
  }

  // --- Calculate card stats ---
  const mostPoints = ranked.reduce((max, team) =>
    team.gwPoints > max.gwPoints ? team : max
  );
  const fewestPoints = ranked.reduce((min, team) =>
    team.gwPoints < min.gwPoints ? team : min
  );
  const mostBench = ranked.reduce((max, team) =>
    team.benchPoints > max.benchPoints ? team : max
  );
  const mostTransfers = ranked.reduce((max, team) =>
    team.transfers > max.transfers ? team : max
  );

  return NextResponse.json({
    standings: ranked,
    stats: {
      mostPoints,
      fewestPoints,
      mostBench,
      mostTransfers,
    },
  });
}