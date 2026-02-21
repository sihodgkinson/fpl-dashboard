import { NextRequest, NextResponse } from "next/server";
import { getCurrentGameweek } from "@/lib/fpl";
import { warmLeagueCache } from "@/lib/leagueCacheWarmup";
import { listDistinctLeagueIds } from "@/lib/userLeagues";

function isAuthorized(request: NextRequest): boolean {
  const configuredSecret =
    process.env.LIVE_REFRESH_SECRET ?? process.env.BACKFILL_RUNNER_SECRET;
  if (!configuredSecret) {
    return process.env.NODE_ENV !== "production";
  }

  const providedSecret =
    request.headers.get("x-live-refresh-secret") ??
    request.headers.get("x-backfill-secret");
  return providedSecret === configuredSecret;
}

export async function POST(request: NextRequest) {
  if (!isAuthorized(request)) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  const origin = new URL(request.url).origin;
  const currentGw = await getCurrentGameweek();
  const leagueIds = await listDistinctLeagueIds();

  if (leagueIds.length === 0) {
    return NextResponse.json({ ok: true, currentGw, refreshed: [] });
  }

  const refreshed: Array<{
    leagueId: number;
    attempted: number;
    succeeded: number;
    failed: number;
    timedOut: boolean;
  }> = [];

  for (const leagueId of leagueIds) {
    const result = await warmLeagueCache({
      leagueId,
      currentGw,
      fromGw: currentGw,
      toGw: currentGw,
      origin,
      concurrency: 2,
      timeBudgetMs: 15_000,
    });

    refreshed.push({
      leagueId,
      attempted: result.attempted,
      succeeded: result.succeeded,
      failed: result.failed,
      timedOut: result.timedOut,
    });
  }

  const hasFailure = refreshed.some((result) => result.failed > 0 || result.timedOut);

  return NextResponse.json(
    {
      ok: !hasFailure,
      currentGw,
      refreshed,
    },
    { status: hasFailure ? 500 : 200 }
  );
}
