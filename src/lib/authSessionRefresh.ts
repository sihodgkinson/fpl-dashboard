import { emitAuthTelemetry } from "@/lib/authTelemetry";

export const SESSION_COOKIE_MAX_AGE = 60 * 60 * 24 * 90;

interface SupabaseAuthResponse {
  access_token?: string;
  refresh_token?: string;
  error_description?: string;
  error?: string;
  message?: string;
  msg?: string;
}

interface AuthConfig {
  url: string;
  key: string;
}

export interface SupabaseAuthSession {
  access_token: string;
  refresh_token: string;
}

type RefreshOutcome =
  | {
      kind: "success";
      session: SupabaseAuthSession;
    }
  | {
      kind: "invalid";
      status: number | null;
      error: string | null;
    }
  | {
      kind: "transient";
      status: number | null;
      error: string | null;
    };

interface RefreshRequest {
  refreshToken: string;
  source: "middleware" | "api";
  path: string;
}

const inFlightRefreshes = new Map<string, Promise<RefreshOutcome>>();

function getAuthConfig(): AuthConfig | null {
  const url = process.env.SUPABASE_URL?.replace(/\/$/, "");
  const key =
    process.env.SUPABASE_ANON_KEY ||
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
    process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !key) return null;
  return { url, key };
}

function readAuthError(payload: SupabaseAuthResponse): string | null {
  const value = payload.error_description || payload.error || payload.message || payload.msg;
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function classifyFailure(
  status: number,
  payload: SupabaseAuthResponse
): "invalid" | "transient" {
  if (status === 401 || status === 403) return "invalid";

  const errorText = (readAuthError(payload) || "").toLowerCase();
  if (status === 400 && errorText.includes("invalid_grant")) {
    return "invalid";
  }

  return "transient";
}

function decodeJwtExp(token: string): number | null {
  const parts = token.split(".");
  if (parts.length < 2) return null;

  try {
    const normalized = parts[1].replace(/-/g, "+").replace(/_/g, "/");
    const padded = normalized + "=".repeat((4 - (normalized.length % 4)) % 4);
    const payload = JSON.parse(atob(padded)) as { exp?: number };
    return typeof payload.exp === "number" ? payload.exp : null;
  } catch {
    return null;
  }
}

export function isExpiredOrNearExpiry(token: string, skewSeconds = 60): boolean {
  const exp = decodeJwtExp(token);
  if (!exp) return true;
  const now = Math.floor(Date.now() / 1000);
  return exp <= now + skewSeconds;
}

async function runRefreshRequest({
  refreshToken,
  source,
  path,
}: RefreshRequest, attempt: number): Promise<RefreshOutcome> {
  const config = getAuthConfig();
  if (!config) {
    const error = "Auth is not configured.";
    emitAuthTelemetry("refresh_failed_transient", {
      source,
      path,
      reason: "auth_unconfigured",
      attempt,
    });
    return {
      kind: "transient",
      status: null,
      error,
    };
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 5000);

  try {
    const response = await fetch(`${config.url}/auth/v1/token?grant_type=refresh_token`, {
      method: "POST",
      headers: {
        apikey: config.key,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ refresh_token: refreshToken }),
      cache: "no-store",
      signal: controller.signal,
    });

    let payload: SupabaseAuthResponse = {};
    try {
      payload = (await response.json()) as SupabaseAuthResponse;
    } catch {
      payload = {};
    }

    if (!response.ok) {
      const classification = classifyFailure(response.status, payload);
      const error = readAuthError(payload);

      emitAuthTelemetry(
        classification === "invalid" ? "refresh_failed_invalid" : "refresh_failed_transient",
        {
          source,
          path,
          status: response.status,
          reason: error || `http_${response.status}`,
          attempt,
        }
      );

      return {
        kind: classification,
        status: response.status,
        error,
      };
    }

    if (!payload.access_token || !payload.refresh_token) {
      emitAuthTelemetry("refresh_failed_transient", {
        source,
        path,
        status: response.status,
        reason: "missing_tokens_in_refresh_response",
        attempt,
      });
      return {
        kind: "transient",
        status: response.status,
        error: "Refresh succeeded but tokens were missing from response.",
      };
    }

    emitAuthTelemetry("refresh_success", {
      source,
      path,
      status: response.status,
      attempt,
    });

    return {
      kind: "success",
      session: {
        access_token: payload.access_token,
        refresh_token: payload.refresh_token,
      },
    };
  } catch (error) {
    const reason =
      error instanceof Error && error.name === "AbortError"
        ? "timeout"
        : error instanceof Error
          ? error.message
          : "unknown_error";

    emitAuthTelemetry("refresh_failed_transient", {
      source,
      path,
      reason,
      attempt,
    });

    return {
      kind: "transient",
      status: null,
      error: "Refresh request failed.",
    };
  } finally {
    clearTimeout(timeout);
  }
}

export async function refreshSessionSingleFlight(
  request: RefreshRequest
): Promise<RefreshOutcome> {
  const existing = inFlightRefreshes.get(request.refreshToken);
  if (existing) return existing;

  const promise = (async () => {
    const firstAttempt = await runRefreshRequest(request, 1);
    if (firstAttempt.kind !== "transient") {
      return firstAttempt;
    }

    await new Promise((resolve) => setTimeout(resolve, 150));
    return runRefreshRequest(request, 2);
  })().finally(() => {
    const active = inFlightRefreshes.get(request.refreshToken);
    if (active === promise) {
      inFlightRefreshes.delete(request.refreshToken);
    }
  });

  inFlightRefreshes.set(request.refreshToken, promise);
  return promise;
}
