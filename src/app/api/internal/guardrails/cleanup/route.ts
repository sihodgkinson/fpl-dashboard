import { NextRequest, NextResponse } from "next/server";
import { RATE_LIMIT_RETENTION_HOURS } from "@/lib/betaLimits";
import { deleteOldRateLimitRows } from "@/lib/supabaseRateLimit";

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

  const result = await deleteOldRateLimitRows(RATE_LIMIT_RETENTION_HOURS);

  return NextResponse.json({
    ok: result.deleted,
    retentionHours: RATE_LIMIT_RETENTION_HOURS,
  });
}
