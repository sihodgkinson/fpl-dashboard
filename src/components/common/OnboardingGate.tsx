"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
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
  error?: string;
}

export function OnboardingGate({ isAuthenticated, currentGw }: OnboardingGateProps) {
  const router = useRouter();
  const [leagueIdInput, setLeagueIdInput] = React.useState("");
  const [previewLeague, setPreviewLeague] = React.useState<{
    id: number;
    name: string;
  } | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  const [isChecking, setIsChecking] = React.useState(false);
  const [isAdding, setIsAdding] = React.useState(false);

  if (!isAuthenticated) {
    return (
      <main className="min-h-svh grid place-items-center p-6">
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
      if (!res.ok || !payload.league) {
        setError(payload.error || "Could not validate that league.");
        return;
      }
      setPreviewLeague(payload.league);
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
      if (!res.ok || !payload.league) {
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
    <main className="min-h-svh grid place-items-center p-6">
      <div className="w-full max-w-md flex flex-col items-center gap-3">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src="/favicon.ico"
          alt="FPL Dashboard"
          className="h-18 w-18 rounded-2xl border border-[#dadce0] object-cover dark:border-[#8e918f]"
        />
        <h1 className="text-center text-base font-semibold">Add your first league</h1>
        <Input
          inputMode="numeric"
          placeholder="FPL Classic League ID"
          value={leagueIdInput}
          onChange={(event) => {
            setLeagueIdInput(event.target.value);
            setPreviewLeague(null);
          }}
          disabled={isChecking || isAdding}
          className="h-[38px] w-[240px]"
        />
        {previewLeague ? (
          <p className="w-[240px] text-center text-sm">
            League found: <span className="font-medium">{previewLeague.name}</span>
          </p>
        ) : null}
        {error ? <p className="w-[240px] text-center text-sm text-destructive">{error}</p> : null}
        {!previewLeague ? (
          <Button
            type="button"
            className="h-[38px] w-[240px]"
            onClick={handleCheckLeague}
            disabled={isChecking || isAdding}
          >
            {isChecking ? "Checking..." : "Check league"}
          </Button>
        ) : (
          <Button
            type="button"
            className="h-[38px] w-[240px]"
            onClick={handleAddLeague}
            disabled={isAdding}
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
            router.refresh();
          }}
        >
          Sign out
        </Button>
      </div>
    </main>
  );
}
