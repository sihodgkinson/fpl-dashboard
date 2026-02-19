import { NextResponse } from "next/server";
import { getClassicLeague } from "@/lib/fpl";
import { enrichStandings } from "@/features/league/utils/enrichStandings";
import { EnrichedStanding } from "@/types/fpl";
import { incrementCounter, logMetric, withTiming } from "@/lib/metrics";
import {
  getCachedLeaguePayload,
  isSupabaseCacheConfigured,
  LeagueCachePayload,
  upsertLeaguePayload,
} from "@/lib/supabaseCache";

const LIVE_CACHE_TTL_SECONDS = Number(
  process.env.FPL_LIVE_CACHE_TTL_SECONDS ?? "60"
);
const MEMORY_CACHE_TTL_MS = LIVE_CACHE_TTL_SECONDS * 1000;

type LeagueQuery = {
  leagueId: number;
  gw: number;
  currentGw: number;
  debug: boolean;
};

type MemoryEntry = {
  payload: LeagueCachePayload;
  expiresAt: number;
};

const liveLeagueMemoryCache = new Map<string, MemoryEntry>();
const inflightRefreshes = new Map<string, Promise<LeagueCachePayload | null>>();

function memoryKey(query: LeagueQuery): string {
  return `${query.leagueId}:${query.gw}:${query.currentGw}`;
}

function getMemoryCache(query: LeagueQuery): LeagueCachePayload | null {
  const entry = liveLeagueMemoryCache.get(memoryKey(query));
  if (!entry) return null;
  if (entry.expiresAt <= Date.now()) {
    liveLeagueMemoryCache.delete(memoryKey(query));
    return null;
  }
  return entry.payload;
}

function setMemoryCache(query: LeagueQuery, payload: LeagueCachePayload) {
  liveLeagueMemoryCache.set(memoryKey(query), {
    payload,
    expiresAt: Date.now() + MEMORY_CACHE_TTL_MS,
  });
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

function parseQuery(req: Request): LeagueQuery | null {
  const { searchParams } = new URL(req.url);
  const leagueId = Number(searchParams.get("leagueId"));
  const gw = Number(searchParams.get("gw"));
  const currentGw = Number(searchParams.get("currentGw"));
  const debug = searchParams.get("debug") === "1";

  if (
    !Number.isInteger(leagueId) ||
    leagueId <= 0 ||
    !Number.isInteger(gw) ||
    gw <= 0 ||
    !Number.isInteger(currentGw) ||
    currentGw <= 0
  ) {
    return null;
  }

  return { leagueId, gw, currentGw, debug };
}

function jsonWithSource(
  payload: LeagueCachePayload,
  source: "memory_hit" | "supabase_hit" | "supabase_stale_served" | "miss",
  debug: boolean
): NextResponse {
  const response = NextResponse.json(payload);
  if (debug) {
    response.headers.set("x-fpl-cache-source", source);
    response.headers.set("x-fpl-cache-debug", "1");
  }
  return response;
}

async function computeAndPersistLeaguePayload(
  query: LeagueQuery
): Promise<LeagueCachePayload | null> {
  const data = await getClassicLeague(query.leagueId);
  if (!data) return null;

  const ranked = await enrichStandings(
    data.standings.results,
    query.gw,
    query.currentGw
  );
  const payload = computeLeaguePayload(ranked);
  const isHistoricalGw = query.gw < query.currentGw;

  if (isSupabaseCacheConfigured()) {
    await upsertLeaguePayload(query.leagueId, query.gw, payload, isHistoricalGw);
  }

  if (!isHistoricalGw) {
    setMemoryCache(query, payload);
  }

  return payload;
}

function refreshInBackground(query: LeagueQuery): void {
  const key = memoryKey(query);
  if (inflightRefreshes.has(key)) return;

  const refreshPromise = computeAndPersistLeaguePayload(query)
    .catch((error) => {
      logMetric("api.league.refresh.error", {
        leagueId: query.leagueId,
        gw: query.gw,
        currentGw: query.currentGw,
        error: error instanceof Error ? error.message : "Unknown refresh error",
      });
      return null;
    })
    .finally(() => {
      inflightRefreshes.delete(key);
    });

  inflightRefreshes.set(key, refreshPromise);
}

export async function GET(req: Request) {
  const query = parseQuery(req);

  if (!query) {
    return NextResponse.json(
      {
        error:
          "Invalid query params. Expected positive integers for leagueId, gw, and currentGw.",
      },
      { status: 400 }
    );
  }

  return withTiming(
    "api.league.GET",
    { leagueId: query.leagueId, gw: query.gw, currentGw: query.currentGw },
    async () => {
      const isHistoricalGw = query.gw < query.currentGw;

      if (!isHistoricalGw) {
        const memoryHit = getMemoryCache(query);
        if (memoryHit) {
          incrementCounter("cache.league.memory.hit");
          return jsonWithSource(memoryHit, "memory_hit", query.debug);
        }
      }

      const supabaseCacheEnabled = isSupabaseCacheConfigured();
      if (supabaseCacheEnabled) {
        const cached = await getCachedLeaguePayload(query.leagueId, query.gw);
        if (cached) {
          if (cached.isFinal || isHistoricalGw) {
            incrementCounter("cache.league.hit");
            return jsonWithSource(cached.payload, "supabase_hit", query.debug);
          }

          const cacheAgeSeconds = Math.floor(
            (Date.now() - new Date(cached.fetchedAt).getTime()) / 1000
          );

          if (cacheAgeSeconds < LIVE_CACHE_TTL_SECONDS) {
            incrementCounter("cache.league.hit");
            setMemoryCache(query, cached.payload);
            return jsonWithSource(cached.payload, "supabase_hit", query.debug);
          }

          // Current GW stale cache: return stale immediately and refresh async.
          incrementCounter("cache.league.stale_served");
          refreshInBackground(query);
          return jsonWithSource(
            cached.payload,
            "supabase_stale_served",
            query.debug
          );
        }
      }

      incrementCounter("cache.league.miss");
      const payload = await computeAndPersistLeaguePayload(query);

      if (!payload) {
        return NextResponse.json(
          { error: `Failed to fetch league ${query.leagueId}` },
          { status: 500 }
        );
      }

      return jsonWithSource(payload, "miss", query.debug);
    }
  );
}
