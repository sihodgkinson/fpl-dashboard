import { NextResponse } from "next/server";
import {
  getClassicLeague,
  getTeamTransfers,
  getPlayers,
  Transfer,
  Player,
} from "@/lib/fpl";
import { incrementCounter, withTiming } from "@/lib/metrics";
import {
  getCachedTransfersPayload,
  isSupabaseCacheConfigured,
  upsertTransfersPayload,
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
    "api.transfers.GET",
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
        const cached = await getCachedTransfersPayload(leagueId, gw);
        if (cached) {
          const cacheAgeSeconds = Math.floor(
            (Date.now() - new Date(cached.fetchedAt).getTime()) / 1000
          );
          const isFreshCacheWithoutCurrentGw =
            currentGw === null && cacheAgeSeconds < liveCacheTtlSeconds;

          if (cached.isFinal) {
            incrementCounter("cache.transfers.hit");
            return NextResponse.json(cached.payload);
          }

          if (isLockedGw) {
            await upsertTransfersPayload(leagueId, gw, cached.payload, true);
            incrementCounter("cache.transfers.hit");
            return NextResponse.json(cached.payload);
          }

          if (isFreshCacheWithoutCurrentGw) {
            incrementCounter("cache.transfers.hit");
            return NextResponse.json(cached.payload);
          }
        }
      }

      incrementCounter("cache.transfers.miss");
      const league = await getClassicLeague(leagueId);

      if (!league) {
        return NextResponse.json(
          { error: `Failed to fetch league ${leagueId}` },
          { status: 500 }
        );
      }

      const standings = league.standings.results as LeagueEntry[];

      const players: Player[] = (await getPlayers()) ?? [];
      const playersById = new Map(players.map((player) => [player.id, player]));

      const data = await Promise.all(
        standings.map(async (entry) => {
          const transfers: Transfer[] = (await getTeamTransfers(entry.entry)) ?? [];

          const gwTransfers = transfers.filter((t) => t.event === gw);

          const mapped = gwTransfers.map((t) => {
            const playerIn = playersById.get(t.element_in);
            const playerOut = playersById.get(t.element_out);
            return {
              in: playerIn?.web_name ?? "Unknown",
              out: playerOut?.web_name ?? "Unknown",
            };
          });

          return {
            manager: entry.player_name,
            team: entry.entry_name,
            transfers: mapped,
            count: gwTransfers.length,
            // cost removed here, since not available in /transfers endpoint
          };
        })
      );

      if (supabaseCacheEnabled) {
        await upsertTransfersPayload(leagueId, gw, data, isLockedGw);
      }

      return NextResponse.json(data);
    }
  );
}
