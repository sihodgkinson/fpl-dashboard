import { NextResponse } from "next/server";
import { getClassicLeague, getLiveEventData, getPlayers, getTeamEventData } from "@/lib/fpl";
import { incrementCounter, withTiming } from "@/lib/metrics";

interface LeagueEntry {
  entry: number;
  entry_name: string;
  player_name: string;
}

interface GW1Standing {
  entry: number;
  entry_name: string;
  player_name: string;
  rank: number;
  movement: number;
  gwPoints: number;
  totalPoints: number;
  benchPoints: number;
  gwPlayers: {
    name: string;
    points: number;
    isCaptain: boolean;
    isViceCaptain: boolean;
  }[];
  benchPlayers: {
    name: string;
    points: number;
  }[];
}

interface FrozenEntry {
  entry: number;
  entry_name: string;
  player_name: string;
  picks: {
    element: number;
    multiplier: number;
    is_captain: boolean;
    is_vice_captain: boolean;
  }[];
}

const ENTRY_CONCURRENCY = 6;

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

function rankByTotal(rows: Array<{ entry: number; totalPoints: number }>) {
  return [...rows]
    .sort((a, b) => {
      if (b.totalPoints !== a.totalPoints) return b.totalPoints - a.totalPoints;
      return a.entry - b.entry;
    })
    .map((row, index) => ({ ...row, rank: index + 1 }));
}

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const leagueId = Number(searchParams.get("leagueId"));
  const gw = Number(searchParams.get("gw"));
  const currentGw = Number(searchParams.get("currentGw"));

  return withTiming("api.gw1-table.GET", { leagueId, gw, currentGw }, async () => {
    if (
      !Number.isInteger(leagueId) ||
      leagueId <= 0 ||
      !Number.isInteger(gw) ||
      gw <= 0 ||
      !Number.isInteger(currentGw) ||
      currentGw <= 0
    ) {
      return NextResponse.json(
        {
          error:
            "Invalid query params. Expected positive integers for leagueId, gw and currentGw.",
        },
        { status: 400 }
      );
    }

    const clampedGw = Math.min(gw, currentGw);

    const [league, players] = await Promise.all([getClassicLeague(leagueId), getPlayers()]);
    if (!league) {
      return NextResponse.json(
        { error: `Failed to fetch league ${leagueId}` },
        { status: 500 }
      );
    }

    const entries = (league.standings.results as LeagueEntry[]) ?? [];
    if (entries.length === 0) {
      incrementCounter("cache.gw1_table.empty");
      return NextResponse.json({ standings: [] });
    }

    const playersById = new Map(players.map((player) => [player.id, player.web_name]));

    const pointsByGw = new Map<number, Map<number, number>>();
    await Promise.all(
      Array.from({ length: clampedGw }, async (_, index) => {
        const eventGw = index + 1;
        const liveData = await getLiveEventData(eventGw);
        pointsByGw.set(
          eventGw,
          new Map((liveData ?? []).map((p) => [p.id, p.stats.total_points]))
        );
      })
    );

    const frozenEntries = await mapWithConcurrency(
      entries,
      ENTRY_CONCURRENCY,
      async (entry): Promise<FrozenEntry | null> => {
        const gw1Data = await getTeamEventData(entry.entry, 1);
        if (!gw1Data) return null;

        return {
          entry: entry.entry,
          entry_name: entry.entry_name,
          player_name: entry.player_name,
          picks: gw1Data.picks,
        };
      }
    );

    const usableEntries = frozenEntries.filter(
      (entry): entry is FrozenEntry => entry !== null
    );

    const totalsByEntry = new Map<number, number[]>();

    for (const entry of usableEntries) {
      const runningTotals: number[] = [];
      let running = 0;

      for (let gwNumber = 1; gwNumber <= clampedGw; gwNumber += 1) {
        const pointsMap = pointsByGw.get(gwNumber) ?? new Map<number, number>();
        const gwPoints = entry.picks.reduce((sum, pick) => {
          const playerPoints = pointsMap.get(pick.element) ?? 0;
          return sum + playerPoints * pick.multiplier;
        }, 0);

        running += gwPoints;
        runningTotals.push(running);
      }

      totalsByEntry.set(entry.entry, runningTotals);
    }

    const currentRows = usableEntries.map((entry) => ({
      entry: entry.entry,
      totalPoints: totalsByEntry.get(entry.entry)?.[clampedGw - 1] ?? 0,
    }));

    const previousRows = usableEntries.map((entry) => ({
      entry: entry.entry,
      totalPoints:
        clampedGw > 1 ? (totalsByEntry.get(entry.entry)?.[clampedGw - 2] ?? 0) : 0,
    }));

    const currentRanked = rankByTotal(currentRows);
    const previousRankMap = new Map(
      rankByTotal(previousRows).map((row) => [row.entry, row.rank])
    );
    const currentRankMap = new Map(currentRanked.map((row) => [row.entry, row.rank]));

    const standings: GW1Standing[] = usableEntries
      .map((entry) => {
        const pointsMap = pointsByGw.get(clampedGw) ?? new Map<number, number>();

        const starters = entry.picks.filter((pick) => pick.multiplier > 0);
        const bench = entry.picks.filter((pick) => pick.multiplier === 0);

        const gwPlayers = starters
          .map((pick) => {
            const playerPoints = pointsMap.get(pick.element) ?? 0;
            return {
              name: playersById.get(pick.element) ?? "Unknown",
              points: playerPoints * pick.multiplier,
              isCaptain: pick.is_captain,
              isViceCaptain: pick.is_vice_captain,
            };
          })
          .sort((a, b) => b.points - a.points);

        const benchPlayers = bench.map((pick) => ({
          name: playersById.get(pick.element) ?? "Unknown",
          points: pointsMap.get(pick.element) ?? 0,
        }));

        const gwPoints = gwPlayers.reduce((sum, player) => sum + player.points, 0);
        const benchPoints = benchPlayers.reduce((sum, player) => sum + player.points, 0);

        const rank = currentRankMap.get(entry.entry) ?? 0;
        const prevRank = previousRankMap.get(entry.entry) ?? rank;

        return {
          entry: entry.entry,
          entry_name: entry.entry_name,
          player_name: entry.player_name,
          rank,
          movement: prevRank - rank,
          gwPoints,
          totalPoints: totalsByEntry.get(entry.entry)?.[clampedGw - 1] ?? 0,
          benchPoints,
          gwPlayers,
          benchPlayers,
        };
      })
      .sort((a, b) => a.rank - b.rank);

    return NextResponse.json({ standings });
  });
}
