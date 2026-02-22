"use client";

import * as React from "react";
import { useRouter } from "next/navigation";

function parseHashParams(hash: string) {
  const source = hash.startsWith("#") ? hash.slice(1) : hash;
  const params = new URLSearchParams(source);
  return {
    accessToken: params.get("access_token"),
    refreshToken: params.get("refresh_token"),
    errorDescription: params.get("error_description"),
  };
}

export default function AuthCallbackPage() {
  const router = useRouter();
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    let cancelled = false;

    const run = async () => {
      const { accessToken, refreshToken, errorDescription } = parseHashParams(
        window.location.hash
      );

      if (errorDescription) {
        if (!cancelled) setError(errorDescription);
        return;
      }

      if (!accessToken || !refreshToken) {
        if (!cancelled) setError("Missing OAuth tokens from callback.");
        return;
      }

      try {
        const res = await fetch("/api/auth/oauth/session", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            accessToken,
            refreshToken,
          }),
        });

        const payload = (await res.json()) as { error?: string };
        if (!res.ok) {
          if (!cancelled) setError(payload.error || "OAuth session failed.");
          return;
        }

        if (!cancelled) {
          router.replace("/dashboard");
          router.refresh();
        }
      } catch {
        if (!cancelled) setError("OAuth session failed.");
      }
    };

    void run();
    return () => {
      cancelled = true;
    };
  }, [router]);

  return (
    <main className="min-h-svh flex items-center justify-center p-5">
      <div className="max-w-md text-center space-y-3">
        <h1 className="text-lg font-semibold">Completing sign-in</h1>
        {error ? (
          <p className="text-sm text-destructive">{error}</p>
        ) : (
          <p className="text-sm text-muted-foreground">
            Please wait while we sign you in.
          </p>
        )}
      </div>
    </main>
  );
}
