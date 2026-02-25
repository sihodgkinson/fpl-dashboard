import { NextRequest, NextResponse } from "next/server";
import {
  claimNextLeagueBackfillJob,
  enqueueLeagueBackfillJob,
  finalizeLeagueBackfillJob,
} from "@/lib/backfillJobs";
import { getCurrentGameweek } from "@/lib/fpl";
import { warmLeagueCache } from "@/lib/leagueCacheWarmup";
import { sendOpsNotification } from "@/lib/opsNotifications";

const BACKFILL_VIEWS_PER_GW = 5;
const MAX_BACKFILL_ATTEMPTS = 3;

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
      const targetGw = Math.max(1, currentGw);
      const expectedTasks = targetGw * BACKFILL_VIEWS_PER_GW;
      await warmLeagueCache({
        leagueId: job.league_id,
        currentGw,
        toGw: targetGw,
        origin,
        concurrency: 3,
        timeBudgetMs: 300_000,
      }).then(async (result) => {
        const isComplete =
          !result.timedOut &&
          result.failed === 0 &&
          result.succeeded === expectedTasks &&
          result.attempted === expectedTasks;

        if (isComplete) {
          await finalizeLeagueBackfillJob({ jobId: job.id, success: true });
          processed.push({ jobId: job.id, leagueId: job.league_id, ok: true });
          return;
        }

        await finalizeLeagueBackfillJob({
          jobId: job.id,
          success: false,
          error: `Backfill incomplete: expected=${expectedTasks}, attempted=${result.attempted}, succeeded=${result.succeeded}, failed=${result.failed}, timedOut=${result.timedOut}`,
        });

        void sendOpsNotification({
          eventType: "backfill_failed",
          message: "Backfill job failed due to incomplete warmup results.",
          metadata: {
            source: "backfill_runner",
            jobId: job.id,
            leagueId: job.league_id,
            attempts: job.attempts,
            expectedTasks,
            attempted: result.attempted,
            succeeded: result.succeeded,
            failed: result.failed,
            timedOut: result.timedOut,
          },
        });

        if (job.attempts < MAX_BACKFILL_ATTEMPTS) {
          await enqueueLeagueBackfillJob(job.league_id);
        }

        processed.push({ jobId: job.id, leagueId: job.league_id, ok: false });
      });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Unknown error";
      await finalizeLeagueBackfillJob({
        jobId: job.id,
        success: false,
        error: errorMessage,
      });

      void sendOpsNotification({
        eventType: "backfill_failed",
        message: "Backfill runner encountered an exception.",
        metadata: {
          source: "backfill_runner",
          jobId: job.id,
          leagueId: job.league_id,
          attempts: job.attempts,
          error: errorMessage,
        },
      });

      if (job.attempts < MAX_BACKFILL_ATTEMPTS) {
        await enqueueLeagueBackfillJob(job.league_id);
      }
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
