import { NextRequest, NextResponse } from "next/server";
import {
  requeueFailedBackfillJobsForLeagues,
} from "@/lib/backfillJobs";
import { listUserLeagues } from "@/lib/userLeagues";
import { attachAuthCookies, getRequestSessionUser } from "@/lib/supabaseAuth";

export async function POST(request: NextRequest) {
  const { user, refreshedSession } = await getRequestSessionUser(request);
  if (!user?.id) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  const leagues = await listUserLeagues(user.id);
  const leagueIds = leagues.map((league) => league.id);

  const { queued } = await requeueFailedBackfillJobsForLeagues(leagueIds);

  if (queued > 0) {
    const origin = new URL(request.url).origin;
    const runnerSecret = process.env.BACKFILL_RUNNER_SECRET;
    const headers: HeadersInit = runnerSecret
      ? { "x-backfill-secret": runnerSecret }
      : {};

    void fetch(`${origin}/api/internal/backfill/run`, {
      method: "POST",
      headers,
      cache: "no-store",
    }).catch(() => undefined);
  }

  return attachAuthCookies(
    NextResponse.json({
      ok: true,
      queued,
    }),
    refreshedSession
  );
}
