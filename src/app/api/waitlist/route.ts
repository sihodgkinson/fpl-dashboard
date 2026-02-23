import { NextRequest, NextResponse } from "next/server";
import { checkSupabaseRateLimit } from "@/lib/supabaseRateLimit";

const WAITLIST_SCOPE = "waitlist_signup";
const WAITLIST_RATE_LIMIT_WINDOW_SECONDS = 600;
const WAITLIST_RATE_LIMIT_MAX_REQUESTS = 5;

function getSupabaseConfig() {
  const url = process.env.SUPABASE_URL?.replace(/\/$/, "");
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return null;
  return { url, key };
}

function isValidEmail(value: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

export async function POST(request: NextRequest) {
  let body: { email?: unknown; name?: unknown; source?: unknown };
  try {
    body = (await request.json()) as { email?: unknown; name?: unknown; source?: unknown };
  } catch {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }

  const emailRaw = typeof body.email === "string" ? body.email.trim().toLowerCase() : "";
  const nameRaw = typeof body.name === "string" ? body.name.trim() : "";
  const sourceRaw = typeof body.source === "string" ? body.source.trim() : "";
  const source = sourceRaw.length > 0 ? sourceRaw : "landing_waitlist";

  if (!isValidEmail(emailRaw)) {
    return NextResponse.json({ error: "Enter a valid email address." }, { status: 400 });
  }

  if (nameRaw.length > 120) {
    return NextResponse.json({ error: "Name is too long." }, { status: 400 });
  }

  const rateLimit = await checkSupabaseRateLimit({
    scope: WAITLIST_SCOPE,
    identifier: emailRaw,
    windowSeconds: WAITLIST_RATE_LIMIT_WINDOW_SECONDS,
    maxRequests: WAITLIST_RATE_LIMIT_MAX_REQUESTS,
  });

  if (!rateLimit.allowed) {
    const response = NextResponse.json(
      {
        error: "Too many signup attempts. Please try again shortly.",
        retryAfterSeconds: rateLimit.retryAfterSeconds,
      },
      { status: 429 }
    );
    response.headers.set("Retry-After", String(rateLimit.retryAfterSeconds));
    return response;
  }

  const config = getSupabaseConfig();
  if (!config) {
    return NextResponse.json({ error: "Waitlist is temporarily unavailable." }, { status: 503 });
  }

  const insertRes = await fetch(`${config.url}/rest/v1/waitlist_signups`, {
    method: "POST",
    headers: {
      apikey: config.key,
      Authorization: `Bearer ${config.key}`,
      "Content-Type": "application/json",
      Prefer: "resolution=ignore-duplicates,return=minimal",
    },
    body: JSON.stringify([
      {
        email: emailRaw,
        name: nameRaw.length > 0 ? nameRaw : null,
        source,
      },
    ]),
    cache: "no-store",
  });

  if (!insertRes.ok) {
    return NextResponse.json({ error: "Failed to join waitlist." }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
