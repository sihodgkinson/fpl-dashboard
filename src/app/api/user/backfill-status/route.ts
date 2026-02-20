import { NextRequest, NextResponse } from "next/server";
import { listBackfillJobsForLeagues } from "@/lib/backfillJobs";
import { listUserLeagues } from "@/lib/userLeagues";
import {
  attachAuthCookies,
  getRequestSessionUser,
} from "@/lib/supabaseAuth";

export async function GET(request: NextRequest) {
  const { user, refreshedSession } = await getRequestSessionUser(request);
  if (!user?.id) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  const leagues = await listUserLeagues(user.id);
  const leagueIdSet = new Set(leagues.map((league) => league.id));
  const jobs = await listBackfillJobsForLeagues([...leagueIdSet]);

  const summary = {
    queued: jobs.filter((job) => job.status === "pending").length,
    running: jobs.filter((job) => job.status === "running").length,
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
