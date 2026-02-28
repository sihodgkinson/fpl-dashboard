import { NextRequest, NextResponse } from "next/server";
import { emitAuthTelemetry } from "@/lib/authTelemetry";
import {
  SESSION_COOKIE_MAX_AGE,
  isExpiredOrNearExpiry,
  refreshSessionSingleFlight,
} from "@/lib/authSessionRefresh";

const ACCESS_TOKEN_COOKIE = "fpl_access_token";
const REFRESH_TOKEN_COOKIE = "fpl_refresh_token";

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
  const path = request.nextUrl.pathname;
  const accessToken = request.cookies.get(ACCESS_TOKEN_COOKIE)?.value;
  const refreshToken = request.cookies.get(REFRESH_TOKEN_COOKIE)?.value;

  if (accessToken && !isExpiredOrNearExpiry(accessToken)) {
    return NextResponse.next();
  }

  if (!refreshToken) {
    emitAuthTelemetry("forced_reauth_reason", {
      source: "middleware",
      path,
      reason: accessToken ? "session_expired" : "cookies_missing",
    });
    return NextResponse.next();
  }

  const refreshed = await refreshSessionSingleFlight({
    refreshToken,
    source: "middleware",
    path,
  });

  if (refreshed.kind === "invalid") {
    emitAuthTelemetry("forced_reauth_reason", {
      source: "middleware",
      path,
      reason: "refresh_invalid",
    });

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

  if (refreshed.kind !== "success") {
    return NextResponse.next();
  }

  const requestHeaders = new Headers(request.headers);
  requestHeaders.set(
    "cookie",
    buildCookieHeader(request, refreshed.session.access_token, refreshed.session.refresh_token)
  );

  const response = NextResponse.next({
    request: {
      headers: requestHeaders,
    },
  });

  response.cookies.set({
    name: ACCESS_TOKEN_COOKIE,
    value: refreshed.session.access_token,
    maxAge: SESSION_COOKIE_MAX_AGE,
    path: "/",
    sameSite: "lax",
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
  });
  response.cookies.set({
    name: REFRESH_TOKEN_COOKIE,
    value: refreshed.session.refresh_token,
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
