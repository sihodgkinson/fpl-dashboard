import { getClassicLeague } from "@/lib/fpl";
import { LEAGUE_IDS } from "@/lib/leagues";
import { logMetric } from "@/lib/metrics";

export const USER_LEAGUES_COOKIE = "fpl_user_key";
export const USER_LEAGUES_COOKIE_MAX_AGE = 60 * 60 * 24 * 365 * 5;

export interface UserLeague {
  id: number;
  name: string;
}

export interface UserLeagueIdentity {
  userId?: string | null;
  userKey?: string | null;
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

function getDefaultLeagueRows(): UserLeague[] {
  return LEAGUE_IDS.map((id) => ({
    id,
    name: `League ${id}`,
  }));
}

export function createUserLeaguesKey(): string {
  return crypto.randomUUID();
}

function identityFilter(identity: UserLeagueIdentity): string | null {
  if (identity.userId) {
    return `user_id=eq.${encodeURIComponent(identity.userId)}`;
  }
  if (identity.userKey) {
    return `user_key=eq.${encodeURIComponent(identity.userKey)}`;
  }
  return null;
}

function isPlaceholderLeagueName(name: string | null | undefined, leagueId: number): boolean {
  if (!name) return true;
  return name.trim().toLowerCase() === `league ${leagueId}`.toLowerCase();
}

async function updateLeagueName(params: {
  identity: UserLeagueIdentity;
  leagueId: number;
  leagueName: string;
}): Promise<void> {
  const config = getSupabaseConfig();
  if (!config) return;

  const filter = identityFilter(params.identity);
  if (!filter) return;

  const url =
    `${config.url}/rest/v1/user_leagues?${filter}` +
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
      body: JSON.stringify({
        league_name: params.leagueName,
      }),
      cache: "no-store",
    });
  } catch {
    // noop
  }
}

export async function listUserLeagues(identity: UserLeagueIdentity): Promise<UserLeague[]> {
  const config = getSupabaseConfig();
  if (!config) return getDefaultLeagueRows();

  const filter = identityFilter(identity);
  if (!filter) return getDefaultLeagueRows();

  const url =
    `${config.url}/rest/v1/user_leagues?${filter}` +
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
      logMetric("user_leagues.read", {
        success: false,
        status: res.status,
      });
      return getDefaultLeagueRows();
    }

    const rows = (await res.json()) as UserLeagueRow[];
    const leagues = rows
      .filter((row) => Number.isInteger(row.league_id) && row.league_id > 0)
      .map((row) => ({
        id: row.league_id,
        name: row.league_name?.trim() || `League ${row.league_id}`,
      }));

    // Heal legacy placeholder names (e.g., "League 123456") and persist canonical FPL names.
    for (const league of leagues) {
      if (!isPlaceholderLeagueName(league.name, league.id)) continue;
      const data = await getClassicLeague(league.id);
      const officialName = data?.league?.name?.trim();
      if (!officialName) continue;

      league.name = officialName;
      await updateLeagueName({
        identity,
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
    return getDefaultLeagueRows();
  }
}

async function buildDefaultSeedRows(identity: UserLeagueIdentity) {
  const defaults = getDefaultLeagueRows();
  if (defaults.length === 0) return [];

  return Promise.all(
    defaults.map(async (league) => {
      const data = await getClassicLeague(league.id);
      return {
        user_id: identity.userId || null,
        user_key: identity.userId ? null : identity.userKey || null,
        league_id: league.id,
        league_name: data?.league?.name?.trim() || league.name,
      };
    })
  );
}

export async function seedDefaultUserLeagues(identity: UserLeagueIdentity): Promise<void> {
  const config = getSupabaseConfig();
  if (!config) return;

  const rows = await buildDefaultSeedRows(identity);
  if (rows.length === 0) return;

  const conflictTarget = identity.userId
    ? "user_id,league_id"
    : "user_key,league_id";
  const url = `${config.url}/rest/v1/user_leagues?on_conflict=${conflictTarget}`;

  try {
    await fetch(url, {
      method: "POST",
      headers: {
        apikey: config.key,
        Authorization: `Bearer ${config.key}`,
        "Content-Type": "application/json",
        Prefer: "resolution=ignore-duplicates,return=minimal",
      },
      body: JSON.stringify(rows),
      cache: "no-store",
    });
  } catch (error) {
    logMetric("user_leagues.seed", {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
    });
  }
}

export async function migrateUserKeyLeaguesToUserId(params: {
  userKey: string;
  userId: string;
}): Promise<void> {
  const config = getSupabaseConfig();
  if (!config) return;

  const fetchUrl =
    `${config.url}/rest/v1/user_leagues` +
    `?user_key=eq.${encodeURIComponent(params.userKey)}` +
    "&select=league_id,league_name";

  try {
    const res = await fetch(fetchUrl, {
      headers: {
        apikey: config.key,
        Authorization: `Bearer ${config.key}`,
        Accept: "application/json",
      },
      cache: "no-store",
    });
    if (!res.ok) return;

    const rows = (await res.json()) as UserLeagueRow[];
    if (rows.length === 0) return;

    const upsertUrl = `${config.url}/rest/v1/user_leagues?on_conflict=user_id,league_id`;
    const upsertBody = rows.map((row) => ({
      user_id: params.userId,
      user_key: null,
      league_id: row.league_id,
      league_name: row.league_name || `League ${row.league_id}`,
    }));

    await fetch(upsertUrl, {
      method: "POST",
      headers: {
        apikey: config.key,
        Authorization: `Bearer ${config.key}`,
        "Content-Type": "application/json",
        Prefer: "resolution=merge-duplicates,return=minimal",
      },
      body: JSON.stringify(upsertBody),
      cache: "no-store",
    });

    const deleteUrl =
      `${config.url}/rest/v1/user_leagues` +
      `?user_key=eq.${encodeURIComponent(params.userKey)}`;
    await fetch(deleteUrl, {
      method: "DELETE",
      headers: {
        apikey: config.key,
        Authorization: `Bearer ${config.key}`,
      },
      cache: "no-store",
    });
  } catch (error) {
    logMetric("user_leagues.migrate", {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
    });
  }
}

export async function addUserLeague(params: {
  identity: UserLeagueIdentity;
  leagueId: number;
  leagueName: string;
}): Promise<{ ok: boolean; created: boolean }> {
  const config = getSupabaseConfig();
  if (!config) return { ok: false, created: false };

  const conflictTarget = params.identity.userId
    ? "user_id,league_id"
    : "user_key,league_id";
  const url = `${config.url}/rest/v1/user_leagues?on_conflict=${conflictTarget}`;

  const body = [
    {
      user_id: params.identity.userId || null,
      user_key: params.identity.userId ? null : params.identity.userKey || null,
      league_id: params.leagueId,
      league_name: params.leagueName,
    },
  ];

  try {
    const res = await fetch(url, {
      method: "POST",
      headers: {
        apikey: config.key,
        Authorization: `Bearer ${config.key}`,
        "Content-Type": "application/json",
        Prefer: "resolution=ignore-duplicates,return=representation",
      },
      body: JSON.stringify(body),
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
  identity: UserLeagueIdentity;
  leagueId: number;
}): Promise<boolean> {
  const config = getSupabaseConfig();
  if (!config) return false;

  const filter = identityFilter(params.identity);
  if (!filter) return false;

  const url =
    `${config.url}/rest/v1/user_leagues?${filter}` +
    `&league_id=eq.${params.leagueId}`;

  try {
    const res = await fetch(url, {
      method: "DELETE",
      headers: {
        apikey: config.key,
        Authorization: `Bearer ${config.key}`,
      },
      cache: "no-store",
    });
    return res.ok;
  } catch {
    return false;
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
