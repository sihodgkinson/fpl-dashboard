import { cookies } from "next/headers";
import { NextRequest, NextResponse } from "next/server";
import { emitAuthTelemetry } from "@/lib/authTelemetry";
import {
  SESSION_COOKIE_MAX_AGE,
  SupabaseAuthSession,
  isExpiredOrNearExpiry,
  refreshSessionSingleFlight,
} from "@/lib/authSessionRefresh";

export const ACCESS_TOKEN_COOKIE = "fpl_access_token";
export const REFRESH_TOKEN_COOKIE = "fpl_refresh_token";

export interface SupabaseAuthUser {
  id: string;
  email?: string;
  created_at?: string;
  last_sign_in_at?: string;
  user_metadata?: {
    name?: string;
    full_name?: string;
    avatar_url?: string;
    picture?: string;
  };
}

const NEW_USER_TIME_WINDOW_MS = 2 * 60 * 1000;

interface SupabaseAuthResponse {
  user?: SupabaseAuthUser;
  access_token?: string;
  refresh_token?: string;
  error_description?: string;
  error?: string;
  message?: string;
  msg?: string;
}

function getAuthError(payload: SupabaseAuthResponse, fallback: string): string {
  return (
    payload.error_description ||
    payload.error ||
    payload.message ||
    payload.msg ||
    fallback
  );
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

async function authFetch(
  path: string,
  init: RequestInit & { bearerToken?: string } = {}
) {
  const config = getAuthConfig();
  if (!config) return null;

  const headers = new Headers(init.headers);
  headers.set("apikey", config.key);
  headers.set("Content-Type", "application/json");

  if (init.bearerToken) {
    headers.set("Authorization", `Bearer ${init.bearerToken}`);
  }

  const res = await fetch(`${config.url}${path}`, {
    ...init,
    headers,
    cache: "no-store",
  });
  return res;
}

export async function signUpWithPassword(email: string, password: string) {
  const res = await authFetch("/auth/v1/signup", {
    method: "POST",
    body: JSON.stringify({ email, password }),
  });
  if (!res) return { ok: false as const, error: "Auth is not configured." };

  const payload = (await res.json()) as SupabaseAuthResponse;
  if (!res.ok || !payload.user) {
    return {
      ok: false as const,
      error: getAuthError(payload, "Sign up failed."),
    };
  }

  return {
    ok: true as const,
    user: payload.user,
    session:
      payload.access_token && payload.refresh_token
        ? {
            access_token: payload.access_token,
            refresh_token: payload.refresh_token,
          }
        : null,
  };
}

export async function signInWithPassword(email: string, password: string) {
  const res = await authFetch("/auth/v1/token?grant_type=password", {
    method: "POST",
    body: JSON.stringify({ email, password }),
  });
  if (!res) return { ok: false as const, error: "Auth is not configured." };

  const payload = (await res.json()) as SupabaseAuthResponse;
  if (!res.ok || !payload.user || !payload.access_token || !payload.refresh_token) {
    return {
      ok: false as const,
      error: getAuthError(payload, "Sign in failed."),
    };
  }

  return {
    ok: true as const,
    user: payload.user,
    session: {
      access_token: payload.access_token,
      refresh_token: payload.refresh_token,
    },
  };
}

export async function refreshAuthSession(refreshToken: string) {
  const result = await refreshSessionSingleFlight({
    refreshToken,
    source: "api",
    path: "supabaseAuth:refreshAuthSession",
  });

  if (result.kind !== "success") {
    return {
      ok: false as const,
      reason: result.kind,
    };
  }

  return {
    ok: true as const,
    session: result.session,
  };
}

export async function getUserForAccessToken(accessToken: string) {
  const res = await authFetch("/auth/v1/user", {
    method: "GET",
    bearerToken: accessToken,
  });
  if (!res) return null;
  if (!res.ok) return null;

  const payload = (await res.json()) as SupabaseAuthUser;
  if (!payload?.id) return null;
  return payload;
}

export function isLikelyNewAuthUser(user: SupabaseAuthUser): boolean {
  const createdAtMs = Date.parse(user.created_at || "");
  const lastSignInAtMs = Date.parse(user.last_sign_in_at || "");

  if (!Number.isFinite(createdAtMs) || !Number.isFinite(lastSignInAtMs)) {
    return false;
  }

  return Math.abs(lastSignInAtMs - createdAtMs) <= NEW_USER_TIME_WINDOW_MS;
}

export async function getRequestSessionUser(
  request: NextRequest
): Promise<{
  user: SupabaseAuthUser | null;
  refreshedSession: SupabaseAuthSession | null;
  reauthReason: "cookies_missing" | "session_expired" | "refresh_invalid" | null;
}> {
  const accessToken = request.cookies.get(ACCESS_TOKEN_COOKIE)?.value;
  const refreshToken = request.cookies.get(REFRESH_TOKEN_COOKIE)?.value;
  const path = request.nextUrl.pathname;

  if (accessToken && !isExpiredOrNearExpiry(accessToken)) {
    const user = await getUserForAccessToken(accessToken);
    if (user) return { user, refreshedSession: null, reauthReason: null };
  }

  if (!refreshToken) {
    const reason = accessToken ? "session_expired" : "cookies_missing";
    emitAuthTelemetry("forced_reauth_reason", {
      source: "api",
      path,
      reason,
    });
    return { user: null, refreshedSession: null, reauthReason: reason };
  }

  const refreshed = await refreshSessionSingleFlight({
    refreshToken,
    source: "api",
    path,
  });
  if (refreshed.kind !== "success") {
    if (refreshed.kind === "invalid") {
      emitAuthTelemetry("forced_reauth_reason", {
        source: "api",
        path,
        reason: "refresh_invalid",
      });
      return { user: null, refreshedSession: null, reauthReason: "refresh_invalid" };
    }
    return { user: null, refreshedSession: null, reauthReason: null };
  }

  const user = await getUserForAccessToken(refreshed.session.access_token);
  if (!user) return { user: null, refreshedSession: null, reauthReason: null };

  return { user, refreshedSession: refreshed.session, reauthReason: null };
}

export function attachAuthCookies(
  response: NextResponse,
  session: SupabaseAuthSession | null
) {
  if (!session) return response;

  response.cookies.set({
    name: ACCESS_TOKEN_COOKIE,
    value: session.access_token,
    maxAge: SESSION_COOKIE_MAX_AGE,
    path: "/",
    sameSite: "lax",
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
  });
  response.cookies.set({
    name: REFRESH_TOKEN_COOKIE,
    value: session.refresh_token,
    maxAge: SESSION_COOKIE_MAX_AGE,
    path: "/",
    sameSite: "lax",
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
  });

  return response;
}

export function clearAuthCookies(response: NextResponse) {
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

export async function getServerSessionUser() {
  const cookieStore = await cookies();
  const accessToken = cookieStore.get(ACCESS_TOKEN_COOKIE)?.value;
  if (!accessToken || isExpiredOrNearExpiry(accessToken)) return null;
  return getUserForAccessToken(accessToken);
}

export async function requestEmailOtp(email: string, emailRedirectTo?: string) {
  const res = await authFetch("/auth/v1/otp", {
    method: "POST",
    body: JSON.stringify({
      email,
      create_user: true,
      should_create_user: true,
      ...((emailRedirectTo ? { redirect_to: emailRedirectTo, email_redirect_to: emailRedirectTo } : {})),
    }),
  });

  if (!res) return { ok: false as const, error: "Auth is not configured." };

  let payload: SupabaseAuthResponse = {};
  try {
    payload = (await res.json()) as SupabaseAuthResponse;
  } catch {
    payload = {};
  }

  if (!res.ok) {
    return {
      ok: false as const,
      error: getAuthError(payload, "Failed to send login code."),
    };
  }

  return { ok: true as const };
}

export async function verifyEmailOtp(email: string, token: string) {
  const res = await authFetch("/auth/v1/verify", {
    method: "POST",
    body: JSON.stringify({
      type: "email",
      email,
      token,
    }),
  });

  if (!res) return { ok: false as const, error: "Auth is not configured." };

  let payload: SupabaseAuthResponse = {};
  try {
    payload = (await res.json()) as SupabaseAuthResponse;
  } catch {
    payload = {};
  }

  const session =
    payload.access_token && payload.refresh_token
      ? {
          access_token: payload.access_token,
          refresh_token: payload.refresh_token,
        }
      : null;

  if (!res.ok || !payload.user || !session) {
    return {
      ok: false as const,
      error: getAuthError(payload, "Invalid or expired login code."),
    };
  }

  return {
    ok: true as const,
    user: payload.user,
    session,
  };
}
