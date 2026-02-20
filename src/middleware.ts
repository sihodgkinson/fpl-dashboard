import { NextRequest, NextResponse } from "next/server";

const ACCESS_TOKEN_COOKIE = "fpl_access_token";
const REFRESH_TOKEN_COOKIE = "fpl_refresh_token";
const SESSION_COOKIE_MAX_AGE = 60 * 60 * 24 * 30;

interface RefreshResponse {
  access_token?: string;
  refresh_token?: string;
}

function getAuthConfig() {
  const url = process.env.SUPABASE_URL?.replace(/\/$/, "");
  const key =
    process.env.SUPABASE_ANON_KEY ||
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
    process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !key) return null;
  return { url, key };
}

function decodeJwtExp(token: string): number | null {
  const parts = token.split(".");
  if (parts.length < 2) return null;

  try {
    const normalized = parts[1].replace(/-/g, "+").replace(/_/g, "/");
    const padded = normalized + "=".repeat((4 - (normalized.length % 4)) % 4);
    const payload = JSON.parse(
      atob(padded)
    ) as { exp?: number };
    return typeof payload.exp === "number" ? payload.exp : null;
  } catch {
    return null;
  }
}

function isExpiredOrNearExpiry(token: string, skewSeconds = 60): boolean {
  const exp = decodeJwtExp(token);
  if (!exp) return true;
  const now = Math.floor(Date.now() / 1000);
  return exp <= now + skewSeconds;
}

function buildCookieHeader(request: NextRequest, accessToken: string, refreshToken: string) {
  const cookieMap = new Map<string, string>();
  for (const { name, value } of request.cookies.getAll()) {
    cookieMap.set(name, value);
  }

  cookieMap.set(ACCESS_TOKEN_COOKIE, accessToken);
  cookieMap.set(REFRESH_TOKEN_COOKIE, refreshToken);

  return Array.from(cookieMap.entries())
    .map(([name, value]) => `${name}=${value}`)
    .join("; ");
}

export async function middleware(request: NextRequest) {
  const accessToken = request.cookies.get(ACCESS_TOKEN_COOKIE)?.value;
  const refreshToken = request.cookies.get(REFRESH_TOKEN_COOKIE)?.value;

  if (accessToken && !isExpiredOrNearExpiry(accessToken)) {
    return NextResponse.next();
  }

  if (!refreshToken) {
    return NextResponse.next();
  }

  const config = getAuthConfig();
  if (!config) {
    return NextResponse.next();
  }

  const res = await fetch(`${config.url}/auth/v1/token?grant_type=refresh_token`, {
    method: "POST",
    headers: {
      apikey: config.key,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ refresh_token: refreshToken }),
    cache: "no-store",
  });

  if (!res.ok) {
    const response = NextResponse.next();
    response.cookies.set({
      name: ACCESS_TOKEN_COOKIE,
      value: "",
      maxAge: 0,
      path: "/",
      sameSite: "lax",
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
    });
    response.cookies.set({
      name: REFRESH_TOKEN_COOKIE,
      value: "",
      maxAge: 0,
      path: "/",
      sameSite: "lax",
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
    });
    return response;
  }

  const payload = (await res.json()) as RefreshResponse;
  if (!payload.access_token || !payload.refresh_token) {
    return NextResponse.next();
  }

  const requestHeaders = new Headers(request.headers);
  requestHeaders.set(
    "cookie",
    buildCookieHeader(request, payload.access_token, payload.refresh_token)
  );

  const response = NextResponse.next({
    request: {
      headers: requestHeaders,
    },
  });

  response.cookies.set({
    name: ACCESS_TOKEN_COOKIE,
    value: payload.access_token,
    maxAge: SESSION_COOKIE_MAX_AGE,
    path: "/",
    sameSite: "lax",
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
  });
  response.cookies.set({
    name: REFRESH_TOKEN_COOKIE,
    value: payload.refresh_token,
    maxAge: SESSION_COOKIE_MAX_AGE,
    path: "/",
    sameSite: "lax",
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
  });

  return response;
}

export const config = {
  matcher: ["/dashboard/:path*"],
};
