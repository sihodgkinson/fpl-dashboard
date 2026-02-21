import { NextResponse } from "next/server";
import {
  getClassicLeague,
  getLiveEventData,
  getPlayers,
  getTeamChips,
  getTeamEventData,
  getTeamTransfers,
  Transfer,
} from "@/lib/fpl";
import { incrementCounter, withTiming } from "@/lib/metrics";
import {
  ActivityImpactCachePayloadItem,
  getCachedActivityImpactPayload,
  isSupabaseCacheConfigured,
  upsertActivityImpactPayload,
} from "@/lib/supabaseCache";

interface LeagueEntry {
  entry: number;
  entry_name: string;
  player_name: string;
}

interface ActivityImpactRow extends ActivityImpactCachePayloadItem {
  entryId: number;
  team: string;
  manager: string;
  chip: string | null;
  chipCaptainName: string | null;
  transfers: Array<{ in: string; out: string; impact: number }>;
  transferImpactNet: number;
  chipImpact: number;
  gwDecisionScore: number;
  runningInfluenceTotal: number;
  previousRunningInfluenceTotal: number;
  pos: number;
  movement: number;
}

const ENTRY_CONCURRENCY = 4;

function hasIncompleteTripleCaptainData(rows: ActivityImpactCachePayloadItem[]): boolean {
  return rows.some(
    (row) =>
      row.chip === "3xc" &&
      (!row.chipCaptainName || row.chipCaptainName.trim().length === 0)
  );
}

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

function sortForRanking<T extends { value: number; entryId: number }>(rows: T[]) {
  return [...rows].sort((a, b) => {
    if (b.value !== a.value) return b.value - a.value;
    return a.entryId - b.entryId;
  });
}

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const leagueId = Number(searchParams.get("leagueId"));
  const gw = Number(searchParams.get("gw"));
  const currentGw = Number(searchParams.get("currentGw"));
  const liveCacheTtlSeconds = Number(
    process.env.FPL_LIVE_CACHE_TTL_SECONDS ?? "60"
  );

  return withTiming("api.activity-impact.GET", { leagueId, gw, currentGw }, async () => {
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
    const isLockedGw = gw <= currentGw;
    const supabaseCacheEnabled = isSupabaseCacheConfigured();

    if (supabaseCacheEnabled) {
      const cached = await getCachedActivityImpactPayload(leagueId, clampedGw);
      if (cached) {
        const cacheNeedsRepair = hasIncompleteTripleCaptainData(cached.payload);
        const cacheAgeSeconds = Math.floor(
          (Date.now() - new Date(cached.fetchedAt).getTime()) / 1000
        );

        if (!cacheNeedsRepair && cached.isFinal) {
          incrementCounter("cache.activity_impact.hit");
          return NextResponse.json(cached.payload);
        }

        if (!cacheNeedsRepair && isLockedGw) {
          await upsertActivityImpactPayload(leagueId, clampedGw, cached.payload, true);
          incrementCounter("cache.activity_impact.hit");
          return NextResponse.json(cached.payload);
        }

        if (!cacheNeedsRepair && cacheAgeSeconds < liveCacheTtlSeconds) {
          incrementCounter("cache.activity_impact.hit");
          return NextResponse.json(cached.payload);
        }
      }
    }

    incrementCounter("cache.activity_impact.miss");

    const league = await getClassicLeague(leagueId);
    if (!league) {
      return NextResponse.json(
        { error: `Failed to fetch league ${leagueId}` },
        { status: 500 }
      );
    }

    const standings = league.standings.results as LeagueEntry[];
    const players = await getPlayers();
    const playersById = new Map(players.map((player) => [player.id, player.web_name]));

    const pointsByGw = new Map<number, Map<number, number>>();
    await Promise.all(
      Array.from({ length: clampedGw }, async (_, index) => {
        const eventGw = index + 1;
        const liveData = await getLiveEventData(eventGw);
        const pointsMap = new Map<number, number>(
          (liveData ?? []).map((player) => [player.id, player.stats.total_points])
        );
        pointsByGw.set(eventGw, pointsMap);
      })
    );

    const rows = await mapWithConcurrency(
      standings,
      ENTRY_CONCURRENCY,
      async (entry): Promise<ActivityImpactRow> => {
        const [transfers, chips] = await Promise.all([
          getTeamTransfers(entry.entry),
          getTeamChips(entry.entry),
        ]);

        const transfersByGw = new Map<number, Transfer[]>();
        for (const transfer of transfers ?? []) {
          const existing = transfersByGw.get(transfer.event);
          if (existing) {
            existing.push(transfer);
          } else {
            transfersByGw.set(transfer.event, [transfer]);
          }
        }

        const chipByGw = new Map<number, string>();
        for (const chip of chips ?? []) {
          chipByGw.set(chip.event, chip.name);
        }

        let runningInfluenceTotal = 0;
        let previousRunningInfluenceTotal = 0;
        let selectedChip: string | null = null;
        let selectedChipCaptainName: string | null = null;
        let selectedTransfers: Array<{ in: string; out: string; impact: number }> = [];
        let selectedTransferImpactNet = 0;
        let selectedChipImpact = 0;
        let selectedGwDecisionScore = 0;

        for (let candidateGw = 1; candidateGw <= clampedGw; candidateGw += 1) {
          const [teamEventData, pointsMap] = await Promise.all([
            getTeamEventData(entry.entry, candidateGw),
            Promise.resolve(pointsByGw.get(candidateGw) ?? new Map<number, number>()),
          ]);

          if (!teamEventData) continue;

          const gwTransfers = transfersByGw.get(candidateGw) ?? [];
          const chipName = chipByGw.get(candidateGw) ?? null;

          const transferImpactGross = gwTransfers.reduce((sum, transfer) => {
            const inPoints = pointsMap.get(transfer.element_in) ?? 0;
            const outPoints = pointsMap.get(transfer.element_out) ?? 0;
            return sum + (inPoints - outPoints);
          }, 0);

          const transferCost =
            chipName === "freehit" ? 0 : teamEventData.entry_history.event_transfers_cost;
          const transferImpactNet = transferImpactGross - transferCost;

          let chipImpact = 0;
          if (chipName === "bboost") {
            chipImpact = teamEventData.entry_history.points_on_bench;
          } else if (chipName === "3xc") {
            const captainPick = teamEventData.picks.find((pick) => pick.is_captain);
            const captainBasePoints = captainPick
              ? (pointsMap.get(captainPick.element) ?? 0)
              : 0;
            chipImpact = captainBasePoints;
            selectedChipCaptainName = captainPick
              ? (playersById.get(captainPick.element) ?? "Unknown")
              : null;
          }

          const gwDecisionScore = transferImpactNet + chipImpact;
          runningInfluenceTotal += gwDecisionScore;

          if (candidateGw < clampedGw) {
            previousRunningInfluenceTotal += gwDecisionScore;
          }

          if (candidateGw === clampedGw) {
            selectedChip = chipName;
            if (chipName !== "3xc") {
              selectedChipCaptainName = null;
            }
            selectedTransfers = gwTransfers.map((transfer) => ({
              in: playersById.get(transfer.element_in) ?? "Unknown",
              out: playersById.get(transfer.element_out) ?? "Unknown",
              impact:
                (pointsMap.get(transfer.element_in) ?? 0) -
                (pointsMap.get(transfer.element_out) ?? 0),
            }));
            selectedTransferImpactNet = transferImpactNet;
            selectedChipImpact = chipImpact;
            selectedGwDecisionScore = gwDecisionScore;
          }
        }

        return {
          entryId: entry.entry,
          team: entry.entry_name,
          manager: entry.player_name,
          chip: selectedChip,
          chipCaptainName: selectedChipCaptainName,
          transfers: selectedTransfers,
          transferImpactNet: selectedTransferImpactNet,
          chipImpact: selectedChipImpact,
          gwDecisionScore: selectedGwDecisionScore,
          runningInfluenceTotal,
          previousRunningInfluenceTotal,
          pos: 0,
          movement: 0,
        };
      }
    );

    const rankedCurrent = sortForRanking(
      rows.map((row) => ({ entryId: row.entryId, value: row.runningInfluenceTotal }))
    );
    const rankedPrevious = sortForRanking(
      rows.map((row) => ({ entryId: row.entryId, value: row.previousRunningInfluenceTotal }))
    );

    const currentRankByEntry = new Map(
      rankedCurrent.map((row, index) => [row.entryId, index + 1] as const)
    );
    const previousRankByEntry = new Map(
      rankedPrevious.map((row, index) => [row.entryId, index + 1] as const)
    );

    const finalRows = rows
      .map((row) => {
        const pos = currentRankByEntry.get(row.entryId) ?? rows.length;
        const previousPos = previousRankByEntry.get(row.entryId) ?? pos;
        return {
          ...row,
          pos,
          movement: previousPos - pos,
        };
      })
      .sort((a, b) => a.pos - b.pos);

    if (supabaseCacheEnabled) {
      await upsertActivityImpactPayload(leagueId, clampedGw, finalRows, isLockedGw);
    }

    return NextResponse.json(finalRows);
  });
}
