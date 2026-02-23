import { logMetric } from "@/lib/metrics";

export type BackfillJobStatus = "pending" | "running" | "succeeded" | "failed";

interface BackfillJobRow {
  id: number;
  league_id: number;
  status: BackfillJobStatus;
  attempts: number;
}

export interface BackfillJobStatusRow {
  id: number;
  league_id: number;
  status: BackfillJobStatus;
  attempts: number;
  last_error: string | null;
  updated_at: string;
  created_at: string;
  finished_at: string | null;
}

function getSupabaseConfig() {
  const url = process.env.SUPABASE_URL?.replace(/\/$/, "");
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !key) return null;
  return { url, key };
}

export async function enqueueLeagueBackfillJob(
  leagueId: number
): Promise<{ queued: boolean }> {
  const config = getSupabaseConfig();
  if (!config) return { queued: false };

  const existingUrl =
    `${config.url}/rest/v1/league_backfill_jobs` +
    `?league_id=eq.${leagueId}&status=in.(pending,running)&select=id&limit=1`;

  try {
    const existingRes = await fetch(existingUrl, {
      headers: {
        apikey: config.key,
        Authorization: `Bearer ${config.key}`,
        Accept: "application/json",
      },
      cache: "no-store",
    });
    if (!existingRes.ok) return { queued: false };

    const existingRows = (await existingRes.json()) as Array<{ id: number }>;
    if (existingRows.length > 0) return { queued: false };

    const insertUrl = `${config.url}/rest/v1/league_backfill_jobs`;
    const insertRes = await fetch(insertUrl, {
      method: "POST",
      headers: {
        apikey: config.key,
        Authorization: `Bearer ${config.key}`,
        "Content-Type": "application/json",
        Prefer: "return=minimal",
      },
      body: JSON.stringify([
        {
          league_id: leagueId,
          status: "pending",
          attempts: 0,
        },
      ]),
      cache: "no-store",
    });

    logMetric("backfill.job.enqueue", {
      leagueId,
      success: insertRes.ok,
      status: insertRes.status,
    });

    return { queued: insertRes.ok };
  } catch (error) {
    logMetric("backfill.job.enqueue", {
      leagueId,
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
    });
    return { queued: false };
  }
}

export async function claimNextLeagueBackfillJob(): Promise<BackfillJobRow | null> {
  const config = getSupabaseConfig();
  if (!config) return null;

  const pendingUrl =
    `${config.url}/rest/v1/league_backfill_jobs` +
    "?status=eq.pending&select=id,league_id,status,attempts&order=created_at.asc&limit=1";

  try {
    const pendingRes = await fetch(pendingUrl, {
      headers: {
        apikey: config.key,
        Authorization: `Bearer ${config.key}`,
        Accept: "application/json",
      },
      cache: "no-store",
    });

    if (!pendingRes.ok) return null;
    const rows = (await pendingRes.json()) as BackfillJobRow[];
    const row = rows[0];
    if (!row) return null;

    const updateUrl =
      `${config.url}/rest/v1/league_backfill_jobs` +
      `?id=eq.${row.id}&status=eq.pending`;
    const updateRes = await fetch(updateUrl, {
      method: "PATCH",
      headers: {
        apikey: config.key,
        Authorization: `Bearer ${config.key}`,
        "Content-Type": "application/json",
        Prefer: "return=representation",
      },
      body: JSON.stringify({
        status: "running",
        attempts: (row.attempts ?? 0) + 1,
        started_at: new Date().toISOString(),
        last_error: null,
      }),
      cache: "no-store",
    });

    if (!updateRes.ok) return null;
    const updatedRows = (await updateRes.json()) as BackfillJobRow[];
    return updatedRows[0] ?? null;
  } catch (error) {
    logMetric("backfill.job.claim", {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
    });
    return null;
  }
}

export async function finalizeLeagueBackfillJob(params: {
  jobId: number;
  success: boolean;
  error?: string;
}): Promise<void> {
  const config = getSupabaseConfig();
  if (!config) return;

  const updateUrl = `${config.url}/rest/v1/league_backfill_jobs?id=eq.${params.jobId}`;
  const status: BackfillJobStatus = params.success ? "succeeded" : "failed";

  try {
    const res = await fetch(updateUrl, {
      method: "PATCH",
      headers: {
        apikey: config.key,
        Authorization: `Bearer ${config.key}`,
        "Content-Type": "application/json",
        Prefer: "return=minimal",
      },
      body: JSON.stringify({
        status,
        finished_at: new Date().toISOString(),
        last_error: params.success ? null : params.error || "Unknown error",
      }),
      cache: "no-store",
    });

    logMetric("backfill.job.finalize", {
      jobId: params.jobId,
      success: res.ok,
      finalStatus: status,
    });
  } catch (error) {
    logMetric("backfill.job.finalize", {
      jobId: params.jobId,
      success: false,
      finalStatus: status,
      error: error instanceof Error ? error.message : "Unknown error",
    });
  }
}

export async function removePendingLeagueBackfillJobs(leagueId: number): Promise<void> {
  const config = getSupabaseConfig();
  if (!config) return;

  const deleteUrl =
    `${config.url}/rest/v1/league_backfill_jobs` +
    `?league_id=eq.${leagueId}&status=in.(pending,running)`;

  try {
    await fetch(deleteUrl, {
      method: "DELETE",
      headers: {
        apikey: config.key,
        Authorization: `Bearer ${config.key}`,
      },
      cache: "no-store",
    });
  } catch (error) {
    logMetric("backfill.job.remove_pending", {
      leagueId,
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
    });
  }
}

export async function listBackfillJobsForLeagues(
  leagueIds: number[]
): Promise<BackfillJobStatusRow[]> {
  const config = getSupabaseConfig();
  if (!config) return [];
  if (leagueIds.length === 0) return [];

  const validLeagueIds = leagueIds.filter(
    (leagueId) => Number.isInteger(leagueId) && leagueId > 0
  );
  if (validLeagueIds.length === 0) return [];

  const leagueFilter = validLeagueIds.join(",");
  const url =
    `${config.url}/rest/v1/league_backfill_jobs` +
    `?league_id=in.(${leagueFilter})` +
    "&status=in.(pending,running,failed)" +
    "&select=id,league_id,status,attempts,last_error,updated_at,created_at,finished_at" +
    "&order=updated_at.desc&limit=100";

  try {
    const res = await fetch(url, {
      headers: {
        apikey: config.key,
        Authorization: `Bearer ${config.key}`,
        Accept: "application/json",
      },
      cache: "no-store",
    });

    if (!res.ok) return [];
    return (await res.json()) as BackfillJobStatusRow[];
  } catch {
    return [];
  }
}

export async function listActiveBackfillJobs(): Promise<BackfillJobStatusRow[]> {
  const config = getSupabaseConfig();
  if (!config) return [];

  const url =
    `${config.url}/rest/v1/league_backfill_jobs` +
    "?status=in.(pending,running)" +
    "&select=id,league_id,status,attempts,last_error,updated_at,created_at,finished_at" +
    "&order=updated_at.desc&limit=1000";

  try {
    const res = await fetch(url, {
      headers: {
        apikey: config.key,
        Authorization: `Bearer ${config.key}`,
        Accept: "application/json",
      },
      cache: "no-store",
    });

    if (!res.ok) return [];
    return (await res.json()) as BackfillJobStatusRow[];
  } catch {
    return [];
  }
}

export async function requeueFailedBackfillJobsForLeagues(
  leagueIds: number[]
): Promise<{ queued: number }> {
  if (leagueIds.length === 0) return { queued: 0 };

  const jobs = await listBackfillJobsForLeagues(leagueIds);
  const failedLeagueIds = [...new Set(jobs.filter((job) => job.status === "failed").map((job) => job.league_id))];

  let queued = 0;
  for (const leagueId of failedLeagueIds) {
    const result = await enqueueLeagueBackfillJob(leagueId);
    if (result.queued) queued += 1;
  }

  return { queued };
}
