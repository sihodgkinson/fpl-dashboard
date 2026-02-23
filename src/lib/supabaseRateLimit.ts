function getSupabaseConfig() {
  const url = process.env.SUPABASE_URL?.replace(/\/$/, "");
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !key) return null;
  return { url, key };
}

interface RateLimitRpcRow {
  allowed: boolean;
  retry_after_seconds: number;
}

export async function checkSupabaseRateLimit(params: {
  scope: string;
  identifier: string;
  windowSeconds: number;
  maxRequests: number;
}): Promise<{ allowed: boolean; retryAfterSeconds: number }> {
  const config = getSupabaseConfig();
  if (!config) {
    return { allowed: true, retryAfterSeconds: 0 };
  }

  const response = await fetch(`${config.url}/rest/v1/rpc/check_request_rate_limit`, {
    method: "POST",
    headers: {
      apikey: config.key,
      Authorization: `Bearer ${config.key}`,
      "Content-Type": "application/json",
      Accept: "application/json",
    },
    body: JSON.stringify({
      p_scope: params.scope,
      p_identifier: params.identifier,
      p_window_seconds: params.windowSeconds,
      p_max_requests: params.maxRequests,
    }),
    cache: "no-store",
  });

  if (!response.ok) {
    return { allowed: true, retryAfterSeconds: 0 };
  }

  const raw = (await response.json()) as RateLimitRpcRow[] | RateLimitRpcRow | null;
  const row = Array.isArray(raw) ? raw[0] : raw;
  if (!row || typeof row.allowed !== "boolean") {
    return { allowed: true, retryAfterSeconds: 0 };
  }

  const retryAfterSeconds =
    typeof row.retry_after_seconds === "number" && row.retry_after_seconds > 0
      ? Math.ceil(row.retry_after_seconds)
      : 0;

  return {
    allowed: row.allowed,
    retryAfterSeconds,
  };
}

export async function countRateLimitRows(): Promise<number> {
  const config = getSupabaseConfig();
  if (!config) return 0;

  const response = await fetch(
    `${config.url}/rest/v1/request_rate_limits?select=id`,
    {
      headers: {
        apikey: config.key,
        Authorization: `Bearer ${config.key}`,
        Prefer: "count=exact",
      },
      cache: "no-store",
    }
  );

  if (!response.ok) return 0;
  const contentRange = response.headers.get("content-range");
  if (!contentRange) return 0;
  const total = Number(contentRange.split("/")[1]);
  return Number.isFinite(total) && total >= 0 ? total : 0;
}

export async function deleteOldRateLimitRows(hours: number): Promise<{ deleted: boolean }> {
  const config = getSupabaseConfig();
  if (!config) return { deleted: false };
  if (!Number.isFinite(hours) || hours <= 0) return { deleted: false };

  const cutoffIso = new Date(Date.now() - hours * 60 * 60 * 1000).toISOString();
  const response = await fetch(
    `${config.url}/rest/v1/request_rate_limits?created_at=lt.${encodeURIComponent(cutoffIso)}`,
    {
      method: "DELETE",
      headers: {
        apikey: config.key,
        Authorization: `Bearer ${config.key}`,
      },
      cache: "no-store",
    }
  );

  return { deleted: response.ok };
}
