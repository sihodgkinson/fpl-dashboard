import { NextRequest, NextResponse } from "next/server";
import { requestEmailOtp } from "@/lib/supabaseAuth";

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function resolveEmailRedirectTo(request: NextRequest, requestedRedirectTo?: string) {
  // Force deterministic local callback targets during local development.
  if (process.env.NODE_ENV !== "production") {
    const requestHost = request.nextUrl.hostname;
    const localHost = requestHost === "127.0.0.1" ? "127.0.0.1" : "localhost";
    return `http://${localHost}:3000/auth/callback`;
  }

  if (requestedRedirectTo) {
    try {
      const parsed = new URL(requestedRedirectTo);
      if (parsed.pathname === "/auth/callback") {
        return `${parsed.origin}${parsed.pathname}`;
      }
    } catch {
      // Fall through to server-derived origin.
    }
  }

  const explicitAppUrl = process.env.NEXT_PUBLIC_APP_URL || process.env.APP_URL || null;
  const requestOrigin = request.nextUrl.origin || null;

  const forwardedProto = request.headers.get("x-forwarded-proto");
  const forwardedHost = request.headers.get("x-forwarded-host") || request.headers.get("host");
  const forwardedOrigin =
    forwardedProto && forwardedHost ? `${forwardedProto}://${forwardedHost}` : null;

  const origin = forwardedOrigin || requestOrigin || explicitAppUrl;
  return origin ? `${origin}/auth/callback` : undefined;
}

export async function POST(request: NextRequest) {
  let body: { email?: unknown; redirectTo?: unknown };
  try {
    body = (await request.json()) as { email?: unknown; redirectTo?: unknown };
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  const email = String(body.email || "").trim().toLowerCase();
  if (!EMAIL_PATTERN.test(email)) {
    return NextResponse.json({ error: "Enter a valid email address." }, { status: 400 });
  }

  const requestedRedirectTo = String(body.redirectTo || "").trim();
  const emailRedirectTo = resolveEmailRedirectTo(request, requestedRedirectTo || undefined);

  const result = await requestEmailOtp(email, emailRedirectTo);
  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: 400 });
  }

  return NextResponse.json({ ok: true });
}
