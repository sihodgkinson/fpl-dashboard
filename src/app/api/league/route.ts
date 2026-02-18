import { NextResponse } from "next/server";
import { getClassicLeague } from "@/lib/fpl";
import { enrichStandings } from "@/features/league/utils/enrichStandings";
import { EnrichedStanding } from "@/types/fpl";
import { incrementCounter, withTiming } from "@/lib/metrics";
import {
  getCachedLeaguePayload,
  isSupabaseCacheConfigured,
  LeagueCachePayload,
  upsertLeaguePayload,
} from "@/lib/supabaseCache";

const LIVE_CACHE_TTL_SECONDS = Number(
  process.env.FPL_LIVE_CACHE_TTL_SECONDS ?? "60"
);

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

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const leagueId = Number(searchParams.get("leagueId"));
  const gw = Number(searchParams.get("gw"));
  const currentGw = Number(searchParams.get("currentGw"));

  return withTiming("api.league.GET", { leagueId, gw, currentGw }, async () => {
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
            "Invalid query params. Expected positive integers for leagueId, gw, and currentGw.",
        },
        { status: 400 }
      );
      }

      const supabaseCacheEnabled = isSupabaseCacheConfigured();
      const isHistoricalGw = gw < currentGw;

      if (supabaseCacheEnabled) {
        const cached = await getCachedLeaguePayload(leagueId, gw);
        if (cached) {
          const cacheAgeSeconds = Math.floor(
            (Date.now() - new Date(cached.fetchedAt).getTime()) / 1000
          );
          const isFreshLiveCache = cacheAgeSeconds < LIVE_CACHE_TTL_SECONDS;

          if (cached.isFinal || isHistoricalGw || isFreshLiveCache) {
            incrementCounter("cache.league.hit");
            return NextResponse.json(cached.payload);
          }
        }
      }

      incrementCounter("cache.league.miss");
      const data = await getClassicLeague(leagueId);

      if (!data) {
      return NextResponse.json(
        { error: `Failed to fetch league ${leagueId}` },
        { status: 500 }
      );
    }

    const standings = data.standings.results;
      const ranked: EnrichedStanding[] = await enrichStandings(
        standings,
        gw,
        currentGw
      );

      const payload = computeLeaguePayload(ranked);

      if (supabaseCacheEnabled) {
        await upsertLeaguePayload(leagueId, gw, payload, isHistoricalGw);
      }

      return NextResponse.json(payload);
    });
}
