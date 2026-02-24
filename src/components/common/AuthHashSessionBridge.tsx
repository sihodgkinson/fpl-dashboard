"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { sanitizeNextPath } from "@/lib/authNextPath";

const AUTH_NEXT_KEY = "auth_next_path";

function parseHashParams(hash: string) {
  const source = hash.startsWith("#") ? hash.slice(1) : hash;
  const params = new URLSearchParams(source);
  return {
    accessToken: params.get("access_token"),
    refreshToken: params.get("refresh_token"),
  };
}

function getStoredNextPath() {
  try {
    return window.sessionStorage.getItem(AUTH_NEXT_KEY);
  } catch {
    return null;
  }
}

function clearStoredNextPath() {
  try {
    window.sessionStorage.removeItem(AUTH_NEXT_KEY);
  } catch {
    // Ignore storage failures.
  }
}

export function AuthHashSessionBridge() {
  const router = useRouter();
  const [isProcessing, setIsProcessing] = React.useState(false);

  React.useEffect(() => {
    let cancelled = false;

    const run = async () => {
      const { accessToken, refreshToken } = parseHashParams(window.location.hash);
      if (!accessToken || !refreshToken) return;

      setIsProcessing(true);

      const nextFromQuery = new URLSearchParams(window.location.search).get("next");
      const requestedNextPath = nextFromQuery || getStoredNextPath() || "/dashboard";
      const nextPath = sanitizeNextPath(requestedNextPath, "/dashboard");

      try {
        const res = await fetch("/api/auth/oauth/session", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            accessToken,
            refreshToken,
          }),
        });

        if (!res.ok || cancelled) {
          setIsProcessing(false);
          return;
        }

        clearStoredNextPath();
        router.replace(nextPath);
        router.refresh();
      } catch {
        setIsProcessing(false);
      }
    };

    void run();
    return () => {
      cancelled = true;
    };
  }, [router]);

  if (!isProcessing) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/95 backdrop-blur-sm">
      <div className="text-center space-y-2 px-4">
        <h2 className="text-base font-semibold">Completing sign-in</h2>
        <p className="text-sm text-muted-foreground">Please wait while we sign you in.</p>
      </div>
    </div>
  );
}
