import { NextResponse } from "next/server";
import { getClassicLeague, getTeamChips, Chip } from "@/lib/fpl";
import { incrementCounter, withTiming } from "@/lib/metrics";
import {
  getCachedChipsPayload,
  isSupabaseCacheConfigured,
  upsertChipsPayload,
} from "@/lib/supabaseCache";

interface LeagueEntry {
  entry: number;
  entry_name: string;
  player_name: string;
}

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const leagueId = Number(searchParams.get("leagueId"));
  const gw = Number(searchParams.get("gw"));
  const currentGwParam = Number(searchParams.get("currentGw"));
  const currentGw =
    Number.isInteger(currentGwParam) && currentGwParam > 0
      ? currentGwParam
      : null;
  const isLockedGw = currentGw !== null && gw <= currentGw;
  const liveCacheTtlSeconds = Number(
    process.env.FPL_LIVE_CACHE_TTL_SECONDS ?? "60"
  );

  return withTiming(
    "api.chips.GET",
    { leagueId, gw, currentGw },
    async () => {
      if (
        !Number.isInteger(leagueId) ||
        leagueId <= 0 ||
        !Number.isInteger(gw) ||
        gw <= 0
      ) {
        return NextResponse.json(
          {
            error:
              "Invalid query params. Expected positive integers for leagueId and gw.",
          },
          { status: 400 }
        );
      }

      const supabaseCacheEnabled = isSupabaseCacheConfigured();
      if (supabaseCacheEnabled) {
        const cached = await getCachedChipsPayload(leagueId, gw);
        if (cached) {
          const cacheAgeSeconds = Math.floor(
            (Date.now() - new Date(cached.fetchedAt).getTime()) / 1000
          );
          const isFreshCacheWithoutCurrentGw =
            currentGw === null && cacheAgeSeconds < liveCacheTtlSeconds;

          if (cached.isFinal) {
            incrementCounter("cache.chips.hit");
            return NextResponse.json(cached.payload);
          }

          if (isLockedGw) {
            await upsertChipsPayload(leagueId, gw, cached.payload, true);
            incrementCounter("cache.chips.hit");
            return NextResponse.json(cached.payload);
          }

          if (isFreshCacheWithoutCurrentGw) {
            incrementCounter("cache.chips.hit");
            return NextResponse.json(cached.payload);
          }
        }
      }

      incrementCounter("cache.chips.miss");
      const league = await getClassicLeague(leagueId);

      if (!league) {
        return NextResponse.json(
          { error: `Failed to fetch league ${leagueId}` },
          { status: 500 }
        );
      }

      const standings = league.standings.results as LeagueEntry[];

      const data = await Promise.all(
        standings.map(async (entry) => {
          const chips: Chip[] = (await getTeamChips(entry.entry)) ?? [];
          const gwChip = chips.find((c) => c.event === gw);

          return {
            team: entry.entry_name,
            manager: entry.player_name,
            chip: gwChip ? gwChip.name : null,
          };
        })
      );

      if (supabaseCacheEnabled) {
        await upsertChipsPayload(leagueId, gw, data, isLockedGw);
      }

      return NextResponse.json(data);
    }
  );
}
