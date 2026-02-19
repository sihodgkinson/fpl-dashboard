import { NextRequest, NextResponse } from "next/server";
import { listBackfillJobsForLeagues } from "@/lib/backfillJobs";
import {
  USER_LEAGUES_COOKIE,
  USER_LEAGUES_COOKIE_MAX_AGE,
  createUserLeaguesKey,
  listUserLeagues,
  migrateUserKeyLeaguesToUserId,
  seedDefaultUserLeagues,
} from "@/lib/userLeagues";
import {
  attachAuthCookies,
  getRequestSessionUser,
} from "@/lib/supabaseAuth";

function getUserKey(request: NextRequest): { userKey: string; isNew: boolean } {
  const existing = request.cookies.get(USER_LEAGUES_COOKIE)?.value;
  if (existing) return { userKey: existing, isNew: false };
  return { userKey: createUserLeaguesKey(), isNew: true };
}

function withUserCookie(
  response: NextResponse,
  userKey: string,
  shouldSetCookie: boolean
): NextResponse {
  if (!shouldSetCookie) return response;

  response.cookies.set({
    name: USER_LEAGUES_COOKIE,
    value: userKey,
    maxAge: USER_LEAGUES_COOKIE_MAX_AGE,
    path: "/",
    sameSite: "lax",
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
  });

  return response;
}

export async function GET(request: NextRequest) {
  const { user, refreshedSession } = await getRequestSessionUser(request);
  const { userKey, isNew } = getUserKey(request);

  if (user?.id && userKey) {
    await migrateUserKeyLeaguesToUserId({ userId: user.id, userKey });
  }

  const identity = user?.id ? { userId: user.id } : { userKey };
  if (isNew && !user?.id) {
    await seedDefaultUserLeagues(identity);
  }

  const leagues = await listUserLeagues(identity);
  const leagueIdSet = new Set(leagues.map((league) => league.id));
  const jobs = await listBackfillJobsForLeagues([...leagueIdSet]);

  const summary = {
    queued: jobs.filter((job) => job.status === "pending").length,
    running: jobs.filter((job) => job.status === "running").length,
    failed: jobs.filter((job) => job.status === "failed").length,
  };

  return attachAuthCookies(
    withUserCookie(
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
      userKey,
      isNew && !user?.id
    ),
    refreshedSession
  );
}
