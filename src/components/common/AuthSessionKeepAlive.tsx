"use client";

import * as React from "react";

const LOCK_KEY = "gwiq_auth_refresh_lock_v1";
const LAST_ATTEMPT_KEY = "gwiq_auth_refresh_last_attempt_v1";
const CHECK_INTERVAL_MS = 10 * 60 * 1000;
const LOCK_TTL_MS = 15000;
const MIN_ATTEMPT_GAP_MS = 45000;

interface RefreshLockState {
  owner: string;
  expiresAt: number;
}

function safeGetItem(key: string): string | null {
  try {
    return window.localStorage.getItem(key);
  } catch {
    return null;
  }
}

function safeSetItem(key: string, value: string): void {
  try {
    window.localStorage.setItem(key, value);
  } catch {
    // Ignore storage failures and continue without cross-tab coordination.
  }
}

function safeRemoveItem(key: string): void {
  try {
    window.localStorage.removeItem(key);
  } catch {
    // Ignore storage failures and continue.
  }
}

function parseLockState(rawValue: string | null): RefreshLockState | null {
  if (!rawValue) return null;

  try {
    const parsed = JSON.parse(rawValue) as RefreshLockState;
    if (
      typeof parsed.owner !== "string" ||
      typeof parsed.expiresAt !== "number" ||
      !Number.isFinite(parsed.expiresAt)
    ) {
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

function createTabId() {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return `tab-${Math.random().toString(36).slice(2)}`;
}

export function AuthSessionKeepAlive() {
  const tabIdRef = React.useRef<string>(createTabId());
  const isRunningRef = React.useRef(false);

  const runSessionCheck = React.useCallback(async () => {
    if (typeof window === "undefined") return;
    if (isRunningRef.current) return;

    const now = Date.now();
    const lastAttemptRaw = safeGetItem(LAST_ATTEMPT_KEY);
    const lastAttempt = Number(lastAttemptRaw || "0");
    if (Number.isFinite(lastAttempt) && now - lastAttempt < MIN_ATTEMPT_GAP_MS) {
      return;
    }

    const currentLock = parseLockState(safeGetItem(LOCK_KEY));
    if (currentLock && currentLock.expiresAt > now && currentLock.owner !== tabIdRef.current) {
      return;
    }

    const nextLock: RefreshLockState = {
      owner: tabIdRef.current,
      expiresAt: now + LOCK_TTL_MS,
    };

    safeSetItem(LOCK_KEY, JSON.stringify(nextLock));
    safeSetItem(LAST_ATTEMPT_KEY, String(now));

    isRunningRef.current = true;
    try {
      await fetch("/api/auth/session", {
        method: "GET",
        cache: "no-store",
        credentials: "same-origin",
      });
    } catch {
      // Ignore transient failures. Middleware/API refresh paths will retry on next request.
    } finally {
      isRunningRef.current = false;
      const activeLock = parseLockState(safeGetItem(LOCK_KEY));
      if (activeLock?.owner === tabIdRef.current) {
        safeRemoveItem(LOCK_KEY);
      }
    }
  }, []);

  React.useEffect(() => {
    void runSessionCheck();

    const onVisibilityChange = () => {
      if (document.visibilityState === "visible") {
        void runSessionCheck();
      }
    };

    const onFocus = () => {
      void runSessionCheck();
    };

    const interval = window.setInterval(() => {
      if (document.visibilityState !== "visible") return;
      void runSessionCheck();
    }, CHECK_INTERVAL_MS);

    document.addEventListener("visibilitychange", onVisibilityChange);
    window.addEventListener("focus", onFocus);

    return () => {
      window.clearInterval(interval);
      document.removeEventListener("visibilitychange", onVisibilityChange);
      window.removeEventListener("focus", onFocus);
    };
  }, [runSessionCheck]);

  return null;
}
