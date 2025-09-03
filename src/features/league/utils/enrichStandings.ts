// lib/enrichStandings.ts
import {
  getTeamEventData,
  getLiveEventData,
  getTeamTransfers,
  getPlayers,
  TeamEventData,
  Transfer,
} from "@/lib/fpl";
import { EnrichedStanding, LeagueStandingsEntry } from "@/types/fpl";

export async function enrichStandings(
  entries: LeagueStandingsEntry[],
  gw: number,
  currentGw: number
): Promise<EnrichedStanding[]> {
  // fetch shared data once
  const players = await getPlayers();
  const liveData = await getLiveEventData(gw);
  const livePointsMap = new Map(
    (liveData ?? []).map((p) => [p.id, p.stats.total_points])
  );

  const enriched: EnrichedStanding[] = await Promise.all(
    entries.map(async (entry) => {
      const teamData: TeamEventData | null = await getTeamEventData(
        entry.entry,
        gw
      );

      if (!teamData) {
        // fallback if API failed
        return {
          ...entry,
          gwPoints: 0,
          totalPoints: entry.total,
          transfers: 0,
          transfersList: [],
          hit: 0,
          benchPoints: 0,
          rank: 0,
          movement: 0,
          gwPlayers: [],
          benchPlayers: [],
        };
      }

      let gwPoints = teamData.entry_history.points;
      let totalPoints = teamData.entry_history.total_points;

      // If current GW, recalc live points
      if (gw === currentGw) {
        gwPoints = teamData.picks.reduce((sum, pick) => {
          const playerPoints = livePointsMap.get(pick.element) ?? 0;
          return sum + playerPoints * pick.multiplier;
        }, 0);

        totalPoints =
          teamData.entry_history.total_points -
          teamData.entry_history.points +
          gwPoints;
      }

      // Split starters and bench
      const starters = teamData.picks.filter((pick) => pick.multiplier > 0);
      const bench = teamData.picks.filter((pick) => pick.multiplier === 0);

      // Build gwPlayers
      const gwPlayers = starters
        .map((pick) => {
          const player = players.find((p) => p.id === pick.element);
          const basePoints = livePointsMap.get(pick.element) ?? 0;
          return {
            name: player?.web_name ?? "Unknown",
            points: basePoints * pick.multiplier,
            isCaptain: pick.is_captain,
            isViceCaptain: pick.is_vice_captain,
          };
        })
        .sort((a, b) => b.points - a.points);

      // Build benchPlayers
      const benchPlayers = bench.map((pick) => {
        const player = players.find((p) => p.id === pick.element);
        const basePoints = livePointsMap.get(pick.element) ?? 0;
        return {
          name: player?.web_name ?? "Unknown",
          points: basePoints,
        };
      });

      const benchPoints = benchPlayers.reduce((sum, p) => sum + p.points, 0);

      // Transfers
      const transfers: Transfer[] = (await getTeamTransfers(entry.entry)) ?? [];
      const gwTransfers = transfers.filter((t) => t.event === gw);

      const transfersList = gwTransfers.map((t) => ({
        in: players.find((p) => p.id === t.element_in)?.web_name ?? "Unknown",
        out: players.find((p) => p.id === t.element_out)?.web_name ?? "Unknown",
      }));

      return {
        ...entry,
        gwPoints,
        totalPoints,
        transfers: gwTransfers.length,
        transfersList,
        hit: -teamData.entry_history.event_transfers_cost,
        benchPoints,
        rank: 0, // placeholder
        movement: 0, // placeholder
        gwPlayers,
        benchPlayers,
      };
    })
  );

  // Sort by totalPoints and assign ranks
  let ranked: EnrichedStanding[] = enriched
    .sort((a, b) => b.totalPoints - a.totalPoints)
    .map((team, index) => ({ ...team, rank: index + 1 }));

  // Calculate movement vs previous GW
  if (gw > 1) {
    const prevStandings = await Promise.all(
      entries.map(async (entry) => {
        const teamData = await getTeamEventData(entry.entry, gw - 1);
        return {
          entry: entry.entry,
          totalPoints: teamData?.entry_history.total_points ?? 0,
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
      const movement = prev ? prev.prevRank - team.rank : 0;
      return { ...team, movement };
    });
  }

  return ranked;
}