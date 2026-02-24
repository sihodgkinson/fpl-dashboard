import { NextRequest, NextResponse } from "next/server";

function getAuthConfig() {
  const url = process.env.SUPABASE_URL?.replace(/\/$/, "");
  const key =
    process.env.SUPABASE_ANON_KEY ||
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
    process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !key) return null;
  return { url, key };
}

export async function GET(request: NextRequest) {
  const config = getAuthConfig();
  if (!config) {
    return NextResponse.json(
      { error: "Supabase auth is not configured." },
      { status: 500 }
    );
  }

  const explicitAppUrl =
    process.env.NEXT_PUBLIC_APP_URL || process.env.APP_URL || null;
  const forwardedProto = request.headers.get("x-forwarded-proto");
  const forwardedHost =
    request.headers.get("x-forwarded-host") || request.headers.get("host");
  const forwardedOrigin =
    forwardedProto && forwardedHost ? `${forwardedProto}://${forwardedHost}` : null;
  // Prefer the incoming request origin to avoid stale APP_URL values
  // causing production OAuth callbacks to redirect to localhost.
  const origin = forwardedOrigin || request.nextUrl.origin || explicitAppUrl;
  const redirectTo = `${origin}/auth/callback`;

  const url =
    `${config.url}/auth/v1/authorize` +
    `?provider=google` +
    `&redirect_to=${encodeURIComponent(redirectTo)}` +
    `&prompt=select_account`;

  return NextResponse.redirect(url);
}
