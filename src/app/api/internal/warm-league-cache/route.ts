import { NextResponse } from "next/server";
import { enrichStandings } from "@/features/league/utils/enrichStandings";
import { getClassicLeague, getCurrentGameweek } from "@/lib/fpl";
import { LEAGUE_IDS } from "@/lib/leagues";
import { logMetric, withTiming } from "@/lib/metrics";
import {
  isSupabaseCacheConfigured,
  LeagueCachePayload,
  upsertLeaguePayload,
} from "@/lib/supabaseCache";
import { EnrichedStanding } from "@/types/fpl";

const WARM_CONCURRENCY = 2;

function isAuthorized(req: Request): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) {
    return process.env.NODE_ENV !== "production";
  }

  const authHeader = req.headers.get("authorization");
  if (authHeader === `Bearer ${secret}`) return true;

  const token = new URL(req.url).searchParams.get("token");
  return token === secret;
}

function computeLeaguePayload(ranked: EnrichedStanding[]): LeagueCachePayload {
  if (ranked.length === 0) {
    return {
      standings: [],
      stats: null,
    };
  }

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

  return {
    standings: ranked,
    stats: {
      mostPoints,
      fewestPoints,
      mostBench,
      mostTransfers,
    },
  };
}

async function mapWithConcurrency<T, R>(
  items: T[],
  limit: number,
  mapper: (item: T) => Promise<R>
): Promise<R[]> {
  const results: R[] = new Array(items.length);
  let nextIndex = 0;

  async function worker() {
    while (true) {
      const index = nextIndex;
      nextIndex += 1;
      if (index >= items.length) return;
      results[index] = await mapper(items[index]);
    }
  }

  await Promise.all(
    Array.from({ length: Math.min(limit, items.length) }, () => worker())
  );
  return results;
}

export async function GET(req: Request) {
  return withTiming("api.internal.warm-league-cache.GET", {}, async () => {
    if (!isAuthorized(req)) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    if (!isSupabaseCacheConfigured()) {
      return NextResponse.json(
        { error: "Supabase cache not configured" },
        { status: 500 }
      );
    }

    const currentGw = await getCurrentGameweek();
    const results = await mapWithConcurrency(
      LEAGUE_IDS,
      WARM_CONCURRENCY,
      async (leagueId) => {
        const league = await getClassicLeague(leagueId);
        if (!league) {
          return {
            leagueId,
            success: false,
            reason: "league_fetch_failed",
          };
        }

        const ranked = await enrichStandings(
          league.standings.results,
          currentGw,
          currentGw
        );
        const payload = computeLeaguePayload(ranked);
        await upsertLeaguePayload(leagueId, currentGw, payload, false);
        return {
          leagueId,
          success: true,
          teams: ranked.length,
        };
      }
    );

    const successCount = results.filter((result) => result.success).length;
    const failed = results.filter((result) => !result.success);

    logMetric("warm.league.cache", {
      currentGw,
      successCount,
      failedCount: failed.length,
      leagueCount: LEAGUE_IDS.length,
    });

    return NextResponse.json({
      ok: failed.length === 0,
      currentGw,
      successCount,
      failedCount: failed.length,
      results,
    });
  });
}

