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
import { withTiming } from "@/lib/metrics";

const TEAM_CONCURRENCY = 8;

async function mapWithConcurrency<T, R>(
  items: T[],
  limit: number,
  mapper: (item: T, index: number) => Promise<R>
): Promise<R[]> {
  const results: R[] = new Array(items.length);
  let nextIndex = 0;

  async function worker() {
    while (true) {
      const currentIndex = nextIndex;
      nextIndex += 1;

      if (currentIndex >= items.length) return;
      results[currentIndex] = await mapper(items[currentIndex], currentIndex);
    }
  }

  await Promise.all(
    Array.from({ length: Math.min(limit, items.length) }, () => worker())
  );

  return results;
}

export async function enrichStandings(
  entries: LeagueStandingsEntry[],
  gw: number,
  currentGw: number
): Promise<EnrichedStanding[]> {
  return withTiming(
    "enrichStandings",
    { entries: entries.length, gw, currentGw, concurrency: TEAM_CONCURRENCY },
    async () => {
      // fetch shared data once
      const players = await getPlayers();
      const playersById = new Map(players.map((player) => [player.id, player]));
      const liveData = await getLiveEventData(gw);
      const livePointsMap = new Map(
        (liveData ?? []).map((p) => [p.id, p.stats.total_points])
      );

      const enriched: EnrichedStanding[] = await mapWithConcurrency(
        entries,
        TEAM_CONCURRENCY,
        async (entry) => {
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
              const player = playersById.get(pick.element);
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
            const player = playersById.get(pick.element);
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
            in: playersById.get(t.element_in)?.web_name ?? "Unknown",
            out: playersById.get(t.element_out)?.web_name ?? "Unknown",
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
        }
      );

      // Sort by totalPoints and assign ranks
      let ranked: EnrichedStanding[] = enriched
        .sort((a, b) => b.totalPoints - a.totalPoints)
        .map((team, index) => ({ ...team, rank: index + 1 }));

      // Calculate movement vs previous GW
      if (gw > 1) {
        const prevStandings = await mapWithConcurrency(
          entries,
          TEAM_CONCURRENCY,
          async (entry) => {
            const teamData = await getTeamEventData(entry.entry, gw - 1);
            return {
              entry: entry.entry,
              totalPoints: teamData?.entry_history.total_points ?? 0,
            };
          }
        );

        const prevRankMap = new Map(
          prevStandings
            .sort((a, b) => b.totalPoints - a.totalPoints)
            .map((team, index) => ({
              entry: team.entry,
              prevRank: index + 1,
            }))
            .map((team) => [team.entry, team.prevRank])
        );

        ranked = ranked.map((team) => {
          const prevRank = prevRankMap.get(team.entry);
          const movement = prevRank ? prevRank - team.rank : 0;
          return { ...team, movement };
        });
      }

      return ranked;
    }
  );
}
