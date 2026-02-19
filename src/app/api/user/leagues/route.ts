import { NextRequest, NextResponse } from "next/server";
import { getClassicLeague, getCurrentGameweek } from "@/lib/fpl";
import { warmLeagueCache } from "@/lib/leagueCacheWarmup";
import {
  enqueueLeagueBackfillJob,
  removePendingLeagueBackfillJobs,
} from "@/lib/backfillJobs";
import {
  USER_LEAGUES_COOKIE,
  USER_LEAGUES_COOKIE_MAX_AGE,
  addUserLeague,
  createUserLeaguesKey,
  listUserLeagues,
  migrateUserKeyLeaguesToUserId,
  purgeLeagueCacheIfUnreferenced,
  removeUserLeague,
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
  let leagues = await listUserLeagues(identity);
  if (user?.id && leagues.length === 0) {
    await seedDefaultUserLeagues(identity);
    leagues = await listUserLeagues(identity);
  }

  return attachAuthCookies(
    withUserCookie(
    NextResponse.json({
      leagues,
    }),
    userKey,
      isNew && !user?.id
    ),
    refreshedSession
  );
}

export async function POST(request: NextRequest) {
  const { user, refreshedSession } = await getRequestSessionUser(request);
  const { userKey, isNew } = getUserKey(request);
  const identity = user?.id ? { userId: user.id } : { userKey };

  let body: { leagueId?: unknown; preview?: unknown };
  try {
    body = (await request.json()) as { leagueId?: unknown; preview?: unknown };
  } catch {
    return withUserCookie(
      NextResponse.json({ error: "Invalid JSON body." }, { status: 400 }),
      userKey,
      isNew && !user?.id
    );
  }

  const leagueId = Number(body.leagueId);
  const previewOnly = body.preview === true;

  if (!Number.isInteger(leagueId) || leagueId <= 0) {
    return withUserCookie(
      NextResponse.json(
        { error: "Invalid leagueId. Expected a positive integer." },
        { status: 400 }
      ),
      userKey,
      isNew && !user?.id
    );
  }

  const league = await getClassicLeague(leagueId);
  if (!league?.league?.name) {
    return withUserCookie(
      NextResponse.json(
        { error: `Could not find FPL classic league ${leagueId}.` },
        { status: 404 }
      ),
      userKey,
      isNew && !user?.id
    );
  }

  if (previewOnly) {
    return withUserCookie(
      NextResponse.json({
        league: {
          id: leagueId,
          name: league.league.name,
        },
        preview: true,
      }),
      userKey,
      isNew && !user?.id
    );
  }

  const createdResult = await addUserLeague({
    identity,
    leagueId,
    leagueName: league.league.name,
  });
  if (!createdResult.ok) {
    return attachAuthCookies(
      withUserCookie(
      NextResponse.json(
        { error: "Failed to persist your league configuration." },
        { status: 500 }
      ),
      userKey,
        isNew && !user?.id
      ),
      refreshedSession
    );
  }

  const currentGw = await getCurrentGameweek();
  const origin = new URL(request.url).origin;
  const warmup = await warmLeagueCache({
    leagueId,
    currentGw,
    origin,
    toGw: Math.max(1, currentGw - 1),
    concurrency: 2,
    timeBudgetMs: 5_000,
  });
  const backfillJob = await enqueueLeagueBackfillJob(leagueId);
  if (backfillJob.queued) {
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
    withUserCookie(
      NextResponse.json({
        league: {
          id: leagueId,
          name: league.league.name,
        },
        created: createdResult.created,
        cacheWarmup: warmup,
        fullBackfillQueued: backfillJob.queued,
      }),
      userKey,
      isNew && !user?.id
    ),
    refreshedSession
  );
}

export async function DELETE(request: NextRequest) {
  const { user, refreshedSession } = await getRequestSessionUser(request);
  const { userKey, isNew } = getUserKey(request);
  const identity = user?.id ? { userId: user.id } : { userKey };
  if (isNew && !user?.id) {
    await seedDefaultUserLeagues(identity);
  }
  const leagueId = Number(new URL(request.url).searchParams.get("leagueId"));

  if (!Number.isInteger(leagueId) || leagueId <= 0) {
    return withUserCookie(
      NextResponse.json(
        { error: "Invalid leagueId. Expected a positive integer." },
        { status: 400 }
      ),
      userKey,
      isNew && !user?.id
    );
  }

  const existingLeagues = await listUserLeagues(identity);
  if (existingLeagues.length <= 1) {
    return withUserCookie(
      NextResponse.json(
        { error: "At least one league must remain in your dashboard." },
        { status: 400 }
      ),
      userKey,
      isNew && !user?.id
    );
  }

  const removed = await removeUserLeague({ identity, leagueId });
  if (removed) {
    await removePendingLeagueBackfillJobs(leagueId);
    await purgeLeagueCacheIfUnreferenced(leagueId);
  }
  const leagues = await listUserLeagues(identity);

  return attachAuthCookies(
    withUserCookie(
      NextResponse.json({
        removed,
        leagues,
      }),
      userKey,
      isNew && !user?.id
    ),
    refreshedSession
  );
}
