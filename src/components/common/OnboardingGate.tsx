"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

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
      <main className="min-h-svh flex items-center justify-center p-6">
        <Card className="w-full max-w-md">
          <CardHeader>
            <CardTitle>Sign in to FPL Dashboard</CardTitle>
          </CardHeader>
          <CardContent>
            <Button
              type="button"
              variant="outline"
              className="w-full"
              onClick={() => {
                window.location.assign("/api/auth/google/start");
              }}
            >
              Continue with Google
            </Button>
          </CardContent>
        </Card>
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
    <main className="min-h-svh flex items-center justify-center p-6">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle>Add your first league</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <Input
            inputMode="numeric"
            placeholder="FPL Classic League ID"
            value={leagueIdInput}
            onChange={(event) => {
              setLeagueIdInput(event.target.value);
              setPreviewLeague(null);
            }}
            disabled={isChecking || isAdding}
          />
          {previewLeague ? (
            <p className="text-sm">
              League found: <span className="font-medium">{previewLeague.name}</span>
            </p>
          ) : null}
          {error ? <p className="text-sm text-destructive">{error}</p> : null}
          {!previewLeague ? (
            <Button
              type="button"
              className="w-full"
              onClick={handleCheckLeague}
              disabled={isChecking || isAdding}
            >
              {isChecking ? "Checking..." : "Check league"}
            </Button>
          ) : (
            <Button
              type="button"
              className="w-full"
              onClick={handleAddLeague}
              disabled={isAdding}
            >
              {isAdding ? "Adding..." : "Add league"}
            </Button>
          )}
          <Button
            type="button"
            variant="ghost"
            className="w-full"
            onClick={async () => {
              await fetch("/api/auth/logout", { method: "POST" });
              router.refresh();
            }}
          >
            Sign out
          </Button>
        </CardContent>
      </Card>
    </main>
  );
}
