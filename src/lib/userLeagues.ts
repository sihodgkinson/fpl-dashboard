import { getClassicLeague } from "@/lib/fpl";
import { logMetric } from "@/lib/metrics";

export interface UserLeague {
  id: number;
  name: string;
}

interface UserLeagueRow {
  league_id: number;
  league_name: string | null;
}

function getSupabaseConfig() {
  const url = process.env.SUPABASE_URL?.replace(/\/$/, "");
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !key) return null;
  return { url, key };
}

function isPlaceholderLeagueName(name: string | null | undefined, leagueId: number): boolean {
  if (!name) return true;
  return name.trim().toLowerCase() === `league ${leagueId}`.toLowerCase();
}

async function updateLeagueName(params: {
  userId: string;
  leagueId: number;
  leagueName: string;
}): Promise<void> {
  const config = getSupabaseConfig();
  if (!config) return;

  const url =
    `${config.url}/rest/v1/user_leagues?user_id=eq.${encodeURIComponent(params.userId)}` +
    `&league_id=eq.${params.leagueId}`;

  try {
    await fetch(url, {
      method: "PATCH",
      headers: {
        apikey: config.key,
        Authorization: `Bearer ${config.key}`,
        "Content-Type": "application/json",
        Prefer: "return=minimal",
      },
      body: JSON.stringify({ league_name: params.leagueName }),
      cache: "no-store",
    });
  } catch {
    // noop
  }
}

async function leagueExists(params: {
  userId: string;
  leagueId: number;
}): Promise<boolean> {
  const config = getSupabaseConfig();
  if (!config) return false;

  const url =
    `${config.url}/rest/v1/user_leagues?user_id=eq.${encodeURIComponent(params.userId)}` +
    `&league_id=eq.${params.leagueId}&select=id&limit=1`;

  try {
    const res = await fetch(url, {
      headers: {
        apikey: config.key,
        Authorization: `Bearer ${config.key}`,
        Accept: "application/json",
      },
      cache: "no-store",
    });
    if (!res.ok) return false;
    const rows = (await res.json()) as Array<{ id: number }>;
    return rows.length > 0;
  } catch {
    return false;
  }
}

export async function listUserLeagues(userId: string): Promise<UserLeague[]> {
  const config = getSupabaseConfig();
  if (!config) return [];

  const url =
    `${config.url}/rest/v1/user_leagues?user_id=eq.${encodeURIComponent(userId)}` +
    "&select=league_id,league_name&order=created_at.asc";

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
      logMetric("user_leagues.read", { success: false, status: res.status });
      return [];
    }

    const rows = (await res.json()) as UserLeagueRow[];
    const leagues = rows
      .filter((row) => Number.isInteger(row.league_id) && row.league_id > 0)
      .map((row) => ({
        id: row.league_id,
        name: row.league_name?.trim() || `League ${row.league_id}`,
      }));

    for (const league of leagues) {
      if (!isPlaceholderLeagueName(league.name, league.id)) continue;
      const data = await getClassicLeague(league.id);
      const officialName = data?.league?.name?.trim();
      if (!officialName) continue;

      league.name = officialName;
      await updateLeagueName({
        userId,
        leagueId: league.id,
        leagueName: officialName,
      });
    }

    return leagues;
  } catch (error) {
    logMetric("user_leagues.read", {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
    });
    return [];
  }
}

export async function addUserLeague(params: {
  userId: string;
  leagueId: number;
  leagueName: string;
}): Promise<{ ok: boolean; created: boolean }> {
  const config = getSupabaseConfig();
  if (!config) return { ok: false, created: false };

  try {
    const exists = await leagueExists({
      userId: params.userId,
      leagueId: params.leagueId,
    });
    if (exists) return { ok: true, created: false };

    const res = await fetch(`${config.url}/rest/v1/user_leagues`, {
      method: "POST",
      headers: {
        apikey: config.key,
        Authorization: `Bearer ${config.key}`,
        "Content-Type": "application/json",
        Prefer: "return=representation",
      },
      body: JSON.stringify([
        {
          user_id: params.userId,
          league_id: params.leagueId,
          league_name: params.leagueName,
        },
      ]),
      cache: "no-store",
    });

    if (!res.ok) return { ok: false, created: false };
    const rows = (await res.json()) as Array<{ league_id?: number }>;
    return { ok: true, created: rows.length > 0 };
  } catch {
    return { ok: false, created: false };
  }
}

export async function removeUserLeague(params: {
  userId: string;
  leagueId: number;
}): Promise<{ ok: boolean; removed: boolean }> {
  const config = getSupabaseConfig();
  if (!config) return { ok: false, removed: false };

  const url =
    `${config.url}/rest/v1/user_leagues?user_id=eq.${encodeURIComponent(params.userId)}` +
    `&league_id=eq.${params.leagueId}`;

  try {
    const res = await fetch(url, {
      method: "DELETE",
      headers: {
        apikey: config.key,
        Authorization: `Bearer ${config.key}`,
        Prefer: "return=representation",
      },
      cache: "no-store",
    });

    if (!res.ok) return { ok: false, removed: false };
    const rows = (await res.json()) as Array<{ id?: number }>;
    return { ok: true, removed: rows.length > 0 };
  } catch {
    return { ok: false, removed: false };
  }
}

export async function purgeLeagueCacheIfUnreferenced(leagueId: number): Promise<void> {
  const config = getSupabaseConfig();
  if (!config) return;

  const usersUrl =
    `${config.url}/rest/v1/user_leagues` +
    `?league_id=eq.${leagueId}&select=id&limit=1`;

  try {
    const usersRes = await fetch(usersUrl, {
      headers: {
        apikey: config.key,
        Authorization: `Bearer ${config.key}`,
        Accept: "application/json",
      },
      cache: "no-store",
    });

    if (!usersRes.ok) return;
    const rows = (await usersRes.json()) as Array<{ id: number }>;
    if (rows.length > 0) return;

    const cacheUrl = `${config.url}/rest/v1/fpl_cache?league_id=eq.${leagueId}`;
    await fetch(cacheUrl, {
      method: "DELETE",
      headers: {
        apikey: config.key,
        Authorization: `Bearer ${config.key}`,
      },
      cache: "no-store",
    });
  } catch {
    // noop
  }
}
