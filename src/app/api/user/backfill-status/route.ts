import { NextRequest, NextResponse } from "next/server";
import { listBackfillJobsForLeagues } from "@/lib/backfillJobs";
import { listUserLeagues } from "@/lib/userLeagues";
import {
  attachAuthCookies,
  getRequestSessionUser,
} from "@/lib/supabaseAuth";

const ACTIVE_JOB_STALE_AFTER_MS = 15 * 60 * 1000;

export async function GET(request: NextRequest) {
  const { user, refreshedSession } = await getRequestSessionUser(request);
  if (!user?.id) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  const leagues = await listUserLeagues(user.id);
  const leagueIdSet = new Set(leagues.map((league) => league.id));
  const jobs = await listBackfillJobsForLeagues([...leagueIdSet]);
  const now = Date.now();

  const freshActiveJobs = jobs.filter((job) => {
    if (job.status !== "pending" && job.status !== "running") return false;
    const updatedAtMs = new Date(job.updated_at).getTime();
    if (!Number.isFinite(updatedAtMs)) return false;
    return now - updatedAtMs <= ACTIVE_JOB_STALE_AFTER_MS;
  });

  const summary = {
    queued: freshActiveJobs.filter((job) => job.status === "pending").length,
    running: freshActiveJobs.filter((job) => job.status === "running").length,
    failed: jobs.filter((job) => job.status === "failed").length,
  };

  return attachAuthCookies(
    NextResponse.json({
      summary,
      jobs: jobs.map((job) => ({
        id: job.id,
        leagueId: job.league_id,
        status: job.status,
        attempts: job.attempts,
        lastError: job.last_error,
        updatedAt: job.updated_at,
      })),
    }),
    refreshedSession
  );
}
