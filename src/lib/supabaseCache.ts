import { logMetric } from "@/lib/metrics";
import { EnrichedStanding } from "@/types/fpl";

type LeagueStats = {
  mostPoints: EnrichedStanding;
  fewestPoints: EnrichedStanding;
  mostBench: EnrichedStanding;
  mostTransfers: EnrichedStanding;
} | null;

export interface LeagueCachePayload {
  standings: EnrichedStanding[];
  stats: LeagueStats;
}

export interface TransfersCachePayloadItem {
  manager: string;
  team: string;
  transfers: {
    in: string;
    out: string;
  }[];
  count: number;
}

export interface ChipsCachePayloadItem {
  team: string;
  manager: string;
  chip: string | null;
}

type CacheView = "league" | "transfers" | "chips";

interface CacheRow<TPayload> {
  gw?: number;
  payload_json: TPayload;
  fetched_at: string;
  is_final: boolean;
}

interface LatestLeagueGwRow {
  gw: number;
  is_final: boolean;
}

function getSupabaseConfig() {
  const url = process.env.SUPABASE_URL?.replace(/\/$/, "");
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !key) return null;
  return { url, key };
}

export function isSupabaseCacheConfigured(): boolean {
  return Boolean(getSupabaseConfig());
}

async function getCachedPayload<TPayload>(
  leagueId: number,
  gw: number,
  view: CacheView
): Promise<{ payload: TPayload; fetchedAt: string; isFinal: boolean } | null> {
  const config = getSupabaseConfig();
  if (!config) return null;

  const url =
    `${config.url}/rest/v1/fpl_cache` +
    `?league_id=eq.${leagueId}&gw=eq.${gw}&view=eq.${view}` +
    `&select=payload_json,fetched_at,is_final&limit=1`;

  try {
    const res = await fetch(url, {
      headers: {
        apikey: config.key,
        Authorization: `Bearer ${config.key}`,
        Accept: "application/json",
      },
      cache: "no-store",
    });

    if (!res.ok) {
      logMetric("cache.supabase.read", {
        leagueId,
        gw,
        view,
        success: false,
        status: res.status,
      });
      return null;
    }

    const rows = (await res.json()) as CacheRow<TPayload>[];
    const row = rows[0];
    if (!row?.payload_json) return null;

    logMetric("cache.supabase.read", {
      leagueId,
      gw,
      view,
      success: true,
      hit: true,
      isFinal: row.is_final,
    });

    return {
      payload: row.payload_json,
      fetchedAt: row.fetched_at,
      isFinal: row.is_final,
    };
  } catch (error) {
    logMetric("cache.supabase.read", {
      leagueId,
      gw,
      view,
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
    });
    return null;
  }
}

async function upsertCachedPayload<TPayload>(
  leagueId: number,
  gw: number,
  view: CacheView,
  payload: TPayload,
  isFinal: boolean
): Promise<void> {
  const config = getSupabaseConfig();
  if (!config) return;

  const url = `${config.url}/rest/v1/fpl_cache?on_conflict=league_id,gw,view`;
  const body = [
    {
      league_id: leagueId,
      gw,
      view,
      payload_json: payload,
      is_final: isFinal,
      source_updated_at: new Date().toISOString(),
      fetched_at: new Date().toISOString(),
    },
  ];

  try {
    const res = await fetch(url, {
      method: "POST",
      headers: {
        apikey: config.key,
        Authorization: `Bearer ${config.key}`,
        "Content-Type": "application/json",
        Prefer: "resolution=merge-duplicates,return=minimal",
      },
      body: JSON.stringify(body),
      cache: "no-store",
    });

    logMetric("cache.supabase.write", {
      leagueId,
      gw,
      view,
      success: res.ok,
      isFinal,
      status: res.status,
    });
  } catch (error) {
    logMetric("cache.supabase.write", {
      leagueId,
      gw,
      view,
      success: false,
      isFinal,
      error: error instanceof Error ? error.message : "Unknown error",
    });
  }
}

export async function getCachedLeaguePayload(
  leagueId: number,
  gw: number
): Promise<{ payload: LeagueCachePayload; fetchedAt: string; isFinal: boolean } | null> {
  return getCachedPayload<LeagueCachePayload>(leagueId, gw, "league");
}

export async function getCachedLeaguePayloadRange(
  leagueId: number,
  fromGw: number,
  toGw: number
): Promise<
  {
    gw: number;
    payload: LeagueCachePayload;
    fetchedAt: string;
    isFinal: boolean;
  }[]
> {
  const config = getSupabaseConfig();
  if (!config) return [];

  const url =
    `${config.url}/rest/v1/fpl_cache` +
    `?league_id=eq.${leagueId}&view=eq.league` +
    `&gw=gte.${fromGw}&gw=lte.${toGw}` +
    `&select=gw,payload_json,fetched_at,is_final&order=gw.asc`;

  try {
    const res = await fetch(url, {
      headers: {
        apikey: config.key,
        Authorization: `Bearer ${config.key}`,
        Accept: "application/json",
      },
      cache: "no-store",
    });

    if (!res.ok) {
      logMetric("cache.supabase.read_range", {
        leagueId,
        fromGw,
        toGw,
        success: false,
        status: res.status,
      });
      return [];
    }

    const rows = (await res.json()) as CacheRow<LeagueCachePayload>[];
    const filtered = rows
      .filter(
        (row) =>
          Number.isInteger(row.gw) &&
          (row.gw as number) >= fromGw &&
          (row.gw as number) <= toGw &&
          row.payload_json
      )
      .map((row) => ({
        gw: row.gw as number,
        payload: row.payload_json,
        fetchedAt: row.fetched_at,
        isFinal: row.is_final,
      }));

    logMetric("cache.supabase.read_range", {
      leagueId,
      fromGw,
      toGw,
      success: true,
      count: filtered.length,
    });

    return filtered;
  } catch (error) {
    logMetric("cache.supabase.read_range", {
      leagueId,
      fromGw,
      toGw,
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
    });
    return [];
  }
}

export async function upsertLeaguePayload(
  leagueId: number,
  gw: number,
  payload: LeagueCachePayload,
  isFinal: boolean
): Promise<void> {
  return upsertCachedPayload(leagueId, gw, "league", payload, isFinal);
}

export async function getCachedTransfersPayload(
  leagueId: number,
  gw: number
): Promise<
  { payload: TransfersCachePayloadItem[]; fetchedAt: string; isFinal: boolean } | null
> {
  return getCachedPayload<TransfersCachePayloadItem[]>(leagueId, gw, "transfers");
}

export async function upsertTransfersPayload(
  leagueId: number,
  gw: number,
  payload: TransfersCachePayloadItem[],
  isFinal: boolean
): Promise<void> {
  return upsertCachedPayload(leagueId, gw, "transfers", payload, isFinal);
}

export async function getCachedChipsPayload(
  leagueId: number,
  gw: number
): Promise<{ payload: ChipsCachePayloadItem[]; fetchedAt: string; isFinal: boolean } | null> {
  return getCachedPayload<ChipsCachePayloadItem[]>(leagueId, gw, "chips");
}

export async function upsertChipsPayload(
  leagueId: number,
  gw: number,
  payload: ChipsCachePayloadItem[],
  isFinal: boolean
): Promise<void> {
  return upsertCachedPayload(leagueId, gw, "chips", payload, isFinal);
}

export async function getLatestCachedLeagueGw(): Promise<{
  gw: number;
  isFinal: boolean;
} | null> {
  const config = getSupabaseConfig();
  if (!config) return null;

  const url =
    `${config.url}/rest/v1/fpl_cache` +
    `?view=eq.league&select=gw,is_final&order=gw.desc,fetched_at.desc&limit=1`;

  try {
    const res = await fetch(url, {
      headers: {
        apikey: config.key,
        Authorization: `Bearer ${config.key}`,
        Accept: "application/json",
      },
      cache: "no-store",
    });

    if (!res.ok) {
      logMetric("cache.supabase.latest_gw.read", {
        success: false,
        status: res.status,
      });
      return null;
    }

    const rows = (await res.json()) as LatestLeagueGwRow[];
    const row = rows[0];
    if (!row || !Number.isInteger(row.gw) || row.gw <= 0) return null;

    logMetric("cache.supabase.latest_gw.read", {
      success: true,
      gw: row.gw,
      isFinal: row.is_final,
    });

    return {
      gw: row.gw,
      isFinal: row.is_final,
    };
  } catch (error) {
    logMetric("cache.supabase.latest_gw.read", {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
    });
    return null;
  }
}
