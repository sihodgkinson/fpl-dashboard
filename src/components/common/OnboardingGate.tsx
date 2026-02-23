"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import useSWR from "swr";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { GoogleSignInButton } from "@/components/common/GoogleSignInButton";

interface OnboardingGateProps {
  isAuthenticated: boolean;
  currentGw: number;
}

interface AddLeagueResponse {
  league?: {
    id: number;
    name: string;
  };
  managerCount?: number;
  retryAfterSeconds?: number;
  error?: string;
}

interface UserLeaguesResponse {
  limits?: {
    maxLeaguesPerUser?: number;
    maxManagersPerLeague?: number;
  };
  guardrails?: {
    addLeagueEnabled?: boolean;
    isGlobalBackfillAtCapacity?: boolean;
    globalActiveBackfillJobs?: number;
    globalActiveBackfillLimit?: number;
  };
}

const userLeaguesFetcher = async (url: string) => {
  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(`Request failed: ${res.status}`);
  }
  return (await res.json()) as UserLeaguesResponse;
};

export function OnboardingGate({ isAuthenticated, currentGw }: OnboardingGateProps) {
  const router = useRouter();
  const [leagueIdInput, setLeagueIdInput] = React.useState("");
  const [previewLeague, setPreviewLeague] = React.useState<{
    id: number;
    name: string;
    managerCount: number | null;
  } | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  const [isChecking, setIsChecking] = React.useState(false);
  const [isAdding, setIsAdding] = React.useState(false);
  const [retryAfterSeconds, setRetryAfterSeconds] = React.useState(0);
  const { data: userLeaguesData } = useSWR<UserLeaguesResponse>(
    isAuthenticated ? "/api/user/leagues" : null,
    userLeaguesFetcher,
    { revalidateOnFocus: true }
  );
  const maxLeaguesPerUser = userLeaguesData?.limits?.maxLeaguesPerUser ?? 3;
  const maxManagersPerLeague = userLeaguesData?.limits?.maxManagersPerLeague ?? 30;
  const addLeagueEnabled = userLeaguesData?.guardrails?.addLeagueEnabled ?? true;
  const isGlobalBackfillAtCapacity =
    userLeaguesData?.guardrails?.isGlobalBackfillAtCapacity ?? false;
  const globalActiveBackfillJobs = userLeaguesData?.guardrails?.globalActiveBackfillJobs ?? 0;
  const globalActiveBackfillLimit = userLeaguesData?.guardrails?.globalActiveBackfillLimit ?? 0;
  const isRateLimited = retryAfterSeconds > 0;
  const addBlockedReason = isRateLimited
    ? `Too many requests. Try again in ${retryAfterSeconds}s.`
    : !addLeagueEnabled
    ? "Adding leagues is temporarily paused for beta capacity."
    : isGlobalBackfillAtCapacity
      ? `League processing is at capacity (${globalActiveBackfillJobs}/${globalActiveBackfillLimit}). Please try again shortly.`
      : null;
  const isAddDisabled = addBlockedReason !== null;

  React.useEffect(() => {
    if (retryAfterSeconds <= 0) return;
    const timer = window.setTimeout(() => {
      setRetryAfterSeconds((seconds) => Math.max(0, seconds - 1));
    }, 1000);
    return () => window.clearTimeout(timer);
  }, [retryAfterSeconds]);

  if (!isAuthenticated) {
    return (
      <main className="min-h-svh grid place-items-center p-5">
        <div className="w-full max-w-md flex flex-col items-center gap-3">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/favicon.ico"
            alt="FPL Dashboard"
            className="h-18 w-18 rounded-2xl border border-[#dadce0] object-cover dark:border-[#8e918f]"
          />
          <h1 className="text-center text-base font-semibold">Sign in to FPL Dashboard</h1>
          <GoogleSignInButton
            onClick={() => {
              window.location.assign("/api/auth/google/start");
            }}
          />
        </div>
      </main>
    );
  }

  async function handleCheckLeague() {
    const leagueId = Number(leagueIdInput.trim());
    if (!Number.isInteger(leagueId) || leagueId <= 0) {
      setError("Enter a valid positive league ID.");
      return;
    }

    setIsChecking(true);
    setError(null);
    setPreviewLeague(null);

    try {
      const res = await fetch("/api/user/leagues", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ leagueId, preview: true }),
      });
      const payload = (await res.json()) as AddLeagueResponse;
      if (!res.ok) {
        if (
          res.status === 429 &&
          typeof payload.retryAfterSeconds === "number" &&
          payload.retryAfterSeconds > 0
        ) {
          setRetryAfterSeconds(Math.ceil(payload.retryAfterSeconds));
        }
        setError(payload.error || "Could not validate that league.");
        return;
      }
      if (!payload.league) {
        setError(payload.error || "Could not validate that league.");
        return;
      }
      const managerCount =
        typeof payload.managerCount === "number" && payload.managerCount >= 0
          ? payload.managerCount
          : null;
      setPreviewLeague({
        ...payload.league,
        managerCount,
      });
    } catch {
      setError("Could not validate that league.");
    } finally {
      setIsChecking(false);
    }
  }

  async function handleAddLeague() {
    if (!previewLeague) return;

    setIsAdding(true);
    setError(null);

    try {
      const res = await fetch("/api/user/leagues", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ leagueId: previewLeague.id }),
      });
      const payload = (await res.json()) as AddLeagueResponse;
      if (!res.ok) {
        if (
          res.status === 429 &&
          typeof payload.retryAfterSeconds === "number" &&
          payload.retryAfterSeconds > 0
        ) {
          setRetryAfterSeconds(Math.ceil(payload.retryAfterSeconds));
        }
        setError(payload.error || "Failed to add league.");
        return;
      }
      if (!payload.league) {
        setError(payload.error || "Failed to add league.");
        return;
      }

      window.location.assign(`/dashboard?leagueId=${payload.league.id}&gw=${currentGw}`);
    } catch {
      setError("Failed to add league.");
    } finally {
      setIsAdding(false);
    }
  }

  return (
    <main className="min-h-svh grid place-items-center p-5">
      <div className="w-full max-w-md flex flex-col items-center gap-3">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src="/favicon.ico"
          alt="FPL Dashboard"
          className="h-18 w-18 rounded-2xl border border-[#dadce0] object-cover dark:border-[#8e918f]"
        />
        <h1 className="text-center text-base font-semibold">Add your first league</h1>
        <p className="w-[240px] text-center text-xs text-muted-foreground">
          Beta limits: up to {maxLeaguesPerUser} leagues, up to {maxManagersPerLeague} managers per league.
        </p>
        {addBlockedReason ? (
          <p className="w-[240px] text-center text-xs text-muted-foreground">
            {addBlockedReason}
          </p>
        ) : null}
        <Input
          inputMode="numeric"
          placeholder="FPL Classic League ID"
          value={leagueIdInput}
          onChange={(event) => {
            setLeagueIdInput(event.target.value);
            setPreviewLeague(null);
          }}
          disabled={isChecking || isAdding || isAddDisabled}
          className="h-[38px] w-[240px]"
        />
        {previewLeague ? (
          <p className="w-[240px] text-center text-sm">
            League found: <span className="font-medium">{previewLeague.name}</span>
            {previewLeague.managerCount !== null
              ? ` (${previewLeague.managerCount} managers)`
              : ""}
          </p>
        ) : null}
        {error ? <p className="w-[240px] text-center text-sm text-destructive">{error}</p> : null}
        {!previewLeague ? (
          <Button
            type="button"
            className="h-[38px] w-[240px]"
            onClick={handleCheckLeague}
            disabled={isChecking || isAdding || isAddDisabled}
          >
            {isChecking ? "Checking..." : "Check league"}
          </Button>
        ) : (
          <Button
            type="button"
            className="h-[38px] w-[240px]"
            onClick={handleAddLeague}
            disabled={isAdding || isAddDisabled}
          >
            {isAdding ? "Adding..." : "Add league"}
          </Button>
        )}
        <Button
          type="button"
          variant="ghost"
          className="h-[38px] w-[240px]"
          onClick={async () => {
            await fetch("/api/auth/logout", { method: "POST" });
            router.push("/");
            router.refresh();
          }}
        >
          Sign out
        </Button>
      </div>
    </main>
  );
}
