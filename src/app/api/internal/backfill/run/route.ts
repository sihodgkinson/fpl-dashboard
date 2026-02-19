import { NextRequest, NextResponse } from "next/server";
import {
  claimNextLeagueBackfillJob,
  finalizeLeagueBackfillJob,
} from "@/lib/backfillJobs";
import { getCurrentGameweek } from "@/lib/fpl";
import { warmLeagueCache } from "@/lib/leagueCacheWarmup";

function isAuthorized(request: NextRequest): boolean {
  const configuredSecret = process.env.BACKFILL_RUNNER_SECRET;
  if (!configuredSecret) {
    return process.env.NODE_ENV !== "production";
  }

  const providedSecret = request.headers.get("x-backfill-secret");
  return providedSecret === configuredSecret;
}

export async function POST(request: NextRequest) {
  if (!isAuthorized(request)) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  const maxJobs = 3;
  const processed: Array<{ jobId: number; leagueId: number; ok: boolean }> = [];
  const origin = new URL(request.url).origin;

  for (let i = 0; i < maxJobs; i += 1) {
    const job = await claimNextLeagueBackfillJob();
    if (!job) break;

    try {
      const currentGw = await getCurrentGameweek();
      await warmLeagueCache({
        leagueId: job.league_id,
        currentGw,
        toGw: Math.max(1, currentGw - 1),
        origin,
        concurrency: 3,
        timeBudgetMs: 300_000,
      });

      await finalizeLeagueBackfillJob({ jobId: job.id, success: true });
      processed.push({ jobId: job.id, leagueId: job.league_id, ok: true });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Unknown error";
      await finalizeLeagueBackfillJob({
        jobId: job.id,
        success: false,
        error: errorMessage,
      });
      processed.push({ jobId: job.id, leagueId: job.league_id, ok: false });
    }
  }

  if (processed.length === 0) {
    return NextResponse.json({ ok: true, message: "No pending jobs." });
  }

  const allSucceeded = processed.every((job) => job.ok);
  return NextResponse.json(
    {
      ok: allSucceeded,
      processed,
    },
    { status: allSucceeded ? 200 : 500 }
  );
}
