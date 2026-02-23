import { NextRequest, NextResponse } from "next/server";
import {
  ACTIVE_BACKFILL_STALE_AFTER_SECONDS,
  ADD_LEAGUE_ENABLED,
  GLOBAL_ACTIVE_BACKFILL_LIMIT,
  LEAGUE_ADD_RATE_LIMIT_MAX_REQUESTS,
  LEAGUE_ADD_RATE_LIMIT_WINDOW_SECONDS,
  LEAGUE_PREVIEW_RATE_LIMIT_MAX_REQUESTS,
  LEAGUE_PREVIEW_RATE_LIMIT_WINDOW_SECONDS,
  RATE_LIMIT_RETENTION_HOURS,
} from "@/lib/betaLimits";
import { listActiveBackfillJobs } from "@/lib/backfillJobs";
import { countRateLimitRows } from "@/lib/supabaseRateLimit";

function isAuthorized(request: NextRequest): boolean {
  const configuredSecret = process.env.BACKFILL_RUNNER_SECRET;
  if (!configuredSecret) {
    return process.env.NODE_ENV !== "production";
  }

  const providedSecret = request.headers.get("x-backfill-secret");
  return providedSecret === configuredSecret;
}

export async function GET(request: NextRequest) {
  if (!isAuthorized(request)) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  const activeJobsRaw = await listActiveBackfillJobs();
  const now = Date.now();
  const staleAfterMs = ACTIVE_BACKFILL_STALE_AFTER_SECONDS * 1000;
  const activeJobs = activeJobsRaw.filter((job) => {
    const updatedAtMs = new Date(job.updated_at).getTime();
    if (!Number.isFinite(updatedAtMs)) return false;
    return now - updatedAtMs <= staleAfterMs;
  });
  const totalRateLimitRows = await countRateLimitRows();

  return NextResponse.json({
    guardrails: {
      addLeagueEnabled: ADD_LEAGUE_ENABLED,
      globalActiveBackfillLimit: GLOBAL_ACTIVE_BACKFILL_LIMIT,
      activeBackfillStaleAfterSeconds: ACTIVE_BACKFILL_STALE_AFTER_SECONDS,
      rateLimitRetentionHours: RATE_LIMIT_RETENTION_HOURS,
      previewRateLimit: {
        windowSeconds: LEAGUE_PREVIEW_RATE_LIMIT_WINDOW_SECONDS,
        maxRequests: LEAGUE_PREVIEW_RATE_LIMIT_MAX_REQUESTS,
      },
      addRateLimit: {
        windowSeconds: LEAGUE_ADD_RATE_LIMIT_WINDOW_SECONDS,
        maxRequests: LEAGUE_ADD_RATE_LIMIT_MAX_REQUESTS,
      },
    },
    metrics: {
      activeBackfillJobs: activeJobs.length,
      isGlobalBackfillAtCapacity: activeJobs.length >= GLOBAL_ACTIVE_BACKFILL_LIMIT,
      rateLimitRows: totalRateLimitRows,
    },
  });
}
