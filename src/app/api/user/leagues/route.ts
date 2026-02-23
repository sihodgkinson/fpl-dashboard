import { NextRequest, NextResponse } from "next/server";
import { getClassicLeague, getCurrentGameweek } from "@/lib/fpl";
import { warmLeagueCache } from "@/lib/leagueCacheWarmup";
import {
  ACTIVE_BACKFILL_STALE_AFTER_SECONDS,
  ADD_LEAGUE_ENABLED,
  GLOBAL_ACTIVE_BACKFILL_LIMIT,
  LEAGUE_ADD_RATE_LIMIT_MAX_REQUESTS,
  LEAGUE_ADD_RATE_LIMIT_WINDOW_SECONDS,
  LEAGUE_PREVIEW_RATE_LIMIT_MAX_REQUESTS,
  LEAGUE_PREVIEW_RATE_LIMIT_WINDOW_SECONDS,
  MAX_LEAGUES_PER_USER,
  MAX_MANAGERS_PER_LEAGUE,
} from "@/lib/betaLimits";
import {
  enqueueLeagueBackfillJob,
  listActiveBackfillJobs,
  listBackfillJobsForLeagues,
  removePendingLeagueBackfillJobs,
} from "@/lib/backfillJobs";
import { checkSupabaseRateLimit } from "@/lib/supabaseRateLimit";
import {
  addUserLeague,
  listUserLeagues,
  purgeLeagueCacheIfUnreferenced,
  removeUserLeague,
} from "@/lib/userLeagues";
import {
  attachAuthCookies,
  getRequestSessionUser,
} from "@/lib/supabaseAuth";

function getFreshActiveJobs<T extends { status: string; updated_at: string }>(
  jobs: T[],
  staleAfterSeconds: number
): T[] {
  const now = Date.now();
  const staleAfterMs = staleAfterSeconds * 1000;

  return jobs.filter((job) => {
    if (job.status !== "pending" && job.status !== "running") return false;
    const updatedAtMs = new Date(job.updated_at).getTime();
    if (!Number.isFinite(updatedAtMs)) return false;
    return now - updatedAtMs <= staleAfterMs;
  });
}

export async function GET(request: NextRequest) {
  const { user, refreshedSession } = await getRequestSessionUser(request);
  if (!user?.id) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }
  const leagues = await listUserLeagues(user.id);
  const [userBackfillJobs, globalActiveJobsRaw] = await Promise.all([
    listBackfillJobsForLeagues(leagues.map((league) => league.id)),
    listActiveBackfillJobs(),
  ]);
  const userActiveJobs = getFreshActiveJobs(
    userBackfillJobs,
    ACTIVE_BACKFILL_STALE_AFTER_SECONDS
  );
  const globalActiveJobs = getFreshActiveJobs(
    globalActiveJobsRaw,
    ACTIVE_BACKFILL_STALE_AFTER_SECONDS
  );
  const hasActiveBackfillForUser = userActiveJobs.length > 0;
  const isGlobalBackfillAtCapacity =
    globalActiveJobs.length >= GLOBAL_ACTIVE_BACKFILL_LIMIT;

  return attachAuthCookies(
    NextResponse.json({
      leagues,
      limits: {
        maxLeaguesPerUser: MAX_LEAGUES_PER_USER,
        maxManagersPerLeague: MAX_MANAGERS_PER_LEAGUE,
      },
      guardrails: {
        addLeagueEnabled: ADD_LEAGUE_ENABLED,
        hasActiveBackfillForUser,
        globalActiveBackfillJobs: globalActiveJobs.length,
        globalActiveBackfillLimit: GLOBAL_ACTIVE_BACKFILL_LIMIT,
        isGlobalBackfillAtCapacity,
      },
    }),
    refreshedSession
  );
}

export async function POST(request: NextRequest) {
  const { user, refreshedSession } = await getRequestSessionUser(request);
  if (!user?.id) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  let body: { leagueId?: unknown; preview?: unknown };
  try {
    body = (await request.json()) as { leagueId?: unknown; preview?: unknown };
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  const leagueId = Number(body.leagueId);
  const previewOnly = body.preview === true;
  const rateLimit = await checkSupabaseRateLimit({
    scope: `league_${previewOnly ? "preview" : "add"}`,
    identifier: user.id,
    windowSeconds: previewOnly
      ? LEAGUE_PREVIEW_RATE_LIMIT_WINDOW_SECONDS
      : LEAGUE_ADD_RATE_LIMIT_WINDOW_SECONDS,
    maxRequests: previewOnly
      ? LEAGUE_PREVIEW_RATE_LIMIT_MAX_REQUESTS
      : LEAGUE_ADD_RATE_LIMIT_MAX_REQUESTS,
  });

  if (!rateLimit.allowed) {
    const message = previewOnly
      ? "Too many league checks. Please wait before trying again."
      : "Too many league add attempts. Please wait before trying again.";
    const response = NextResponse.json(
      {
        error: message,
        retryAfterSeconds: rateLimit.retryAfterSeconds,
      },
      { status: 429 }
    );
    response.headers.set("Retry-After", String(rateLimit.retryAfterSeconds));
    return response;
  }

  if (!Number.isInteger(leagueId) || leagueId <= 0) {
    return NextResponse.json(
      { error: "Invalid leagueId. Expected a positive integer." },
      { status: 400 }
    );
  }

  const userLeagues = await listUserLeagues(user.id);
  const alreadyAdded = userLeagues.some((league) => league.id === leagueId);

  if (alreadyAdded) {
    return NextResponse.json(
      { error: "This league is already in your dashboard." },
      { status: 409 }
    );
  }

  if (userLeagues.length >= MAX_LEAGUES_PER_USER) {
    return NextResponse.json(
      {
        error: `You can add up to ${MAX_LEAGUES_PER_USER} leagues while beta limits are active.`,
      },
      { status: 400 }
    );
  }

  if (!previewOnly && !ADD_LEAGUE_ENABLED) {
    return NextResponse.json(
      {
        error:
          "Adding new leagues is temporarily paused while we manage beta capacity.",
      },
      { status: 503 }
    );
  }

  if (!previewOnly) {
    const activeGlobalJobs = getFreshActiveJobs(
      await listActiveBackfillJobs(),
      ACTIVE_BACKFILL_STALE_AFTER_SECONDS
    );
    if (activeGlobalJobs.length >= GLOBAL_ACTIVE_BACKFILL_LIMIT) {
      return NextResponse.json(
        {
          error:
            "League processing is currently at capacity. Please try again shortly.",
        },
        { status: 503 }
      );
    }
  }

  const league = await getClassicLeague(leagueId);
  if (!league?.league?.name) {
    return NextResponse.json(
      { error: `Could not find FPL classic league ${leagueId}.` },
      { status: 404 }
    );
  }

  const managerCount = league.standings.results.length;
  if (managerCount > MAX_MANAGERS_PER_LEAGUE) {
    return NextResponse.json(
      {
        error: `League too large for beta limits (${managerCount} managers). The current limit is ${MAX_MANAGERS_PER_LEAGUE}.`,
      },
      { status: 400 }
    );
  }

  if (previewOnly) {
    return NextResponse.json({
      league: {
        id: leagueId,
        name: league.league.name,
      },
      managerCount,
      preview: true,
    });
  }

  const activeJobs = await listBackfillJobsForLeagues(userLeagues.map((league) => league.id));
  const hasActiveBackfillForUser =
    getFreshActiveJobs(activeJobs, ACTIVE_BACKFILL_STALE_AFTER_SECONDS).length > 0;

  if (hasActiveBackfillForUser) {
    return NextResponse.json(
      {
        error: "A league backfill is already in progress. Please wait for it to finish before adding another league.",
      },
      { status: 409 }
    );
  }

  const createdResult = await addUserLeague({
    userId: user.id,
    leagueId,
    leagueName: league.league.name,
  });
  if (!createdResult.ok) {
    return attachAuthCookies(
      NextResponse.json(
        { error: "Failed to persist your league configuration." },
        { status: 500 }
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
    toGw: currentGw,
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
    NextResponse.json({
      league: {
        id: leagueId,
        name: league.league.name,
      },
      created: createdResult.created,
      cacheWarmup: warmup,
      fullBackfillQueued: backfillJob.queued,
    }),
    refreshedSession
  );
}

export async function DELETE(request: NextRequest) {
  const { user, refreshedSession } = await getRequestSessionUser(request);
  if (!user?.id) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }
  const leagueId = Number(new URL(request.url).searchParams.get("leagueId"));

  if (!Number.isInteger(leagueId) || leagueId <= 0) {
    return NextResponse.json(
      { error: "Invalid leagueId. Expected a positive integer." },
      { status: 400 }
    );
  }

  const removeResult = await removeUserLeague({ userId: user.id, leagueId });
  if (!removeResult.ok) {
    return attachAuthCookies(
      NextResponse.json(
        { error: "Failed to remove league." },
        { status: 500 }
      ),
      refreshedSession
    );
  }
  if (!removeResult.removed) {
    return attachAuthCookies(
      NextResponse.json(
        { error: "League was not found for this user." },
        { status: 404 }
      ),
      refreshedSession
    );
  }
  if (removeResult.removed) {
    await removePendingLeagueBackfillJobs(leagueId);
    await purgeLeagueCacheIfUnreferenced(leagueId);
  }
  const leagues = await listUserLeagues(user.id);

  return attachAuthCookies(
    NextResponse.json({
      removed: removeResult.removed,
      leagues,
    }),
    refreshedSession
  );
}
