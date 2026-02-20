"use client";

import * as React from "react";
import { useRouter, useSearchParams } from "next/navigation";
import useSWR from "swr";
import { AlertTriangle, Loader2, Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";

interface LeagueManagerProps {
  selectedLeagueId: number;
  selectedLeagueName: string;
  currentGw: number;
}

interface AddLeagueResponse {
  league?: {
    id: number;
    name: string;
  };
  preview?: boolean;
  fullBackfillQueued?: boolean;
  error?: string;
}

interface BackfillStatusResponse {
  summary: {
    queued: number;
    running: number;
    failed: number;
  };
}

const fetcher = async (url: string) => {
  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(`Request failed: ${res.status}`);
  }
  return (await res.json()) as BackfillStatusResponse;
};

export function LeagueManager({
  selectedLeagueId,
  selectedLeagueName,
  currentGw,
}: LeagueManagerProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [addOpen, setAddOpen] = React.useState(false);
  const [removeOpen, setRemoveOpen] = React.useState(false);
  const [leagueIdInput, setLeagueIdInput] = React.useState("");
  const [previewLeague, setPreviewLeague] = React.useState<{
    id: number;
    name: string;
  } | null>(null);
  const [addError, setAddError] = React.useState<string | null>(null);
  const [removeError, setRemoveError] = React.useState<string | null>(null);
  const [isAdding, setIsAdding] = React.useState(false);
  const [isChecking, setIsChecking] = React.useState(false);
  const [isRemoving, setIsRemoving] = React.useState(false);
  const [pendingLeagueSelectionId, setPendingLeagueSelectionId] = React.useState<number | null>(
    null
  );

  const { data: backfillStatus } = useSWR<BackfillStatusResponse>(
    "/api/user/backfill-status",
    fetcher,
    {
      refreshInterval: 5000,
      revalidateOnFocus: true,
    }
  );

  const gw = searchParams.get("gw") || String(currentGw);

  async function handleCheckLeague() {
    const leagueId = Number(leagueIdInput.trim());
    if (!Number.isInteger(leagueId) || leagueId <= 0) {
      setAddError("Enter a valid positive league ID.");
      return;
    }

    setIsChecking(true);
    setAddError(null);
    setPreviewLeague(null);

    try {
      const res = await fetch("/api/user/leagues", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          leagueId,
          preview: true,
        }),
      });

      const payload = (await res.json()) as AddLeagueResponse;
      if (!res.ok || !payload.league) {
        setAddError(payload.error || "Failed to validate league.");
        return;
      }

      setPreviewLeague(payload.league);
    } catch {
      setAddError("Failed to validate league.");
    } finally {
      setIsChecking(false);
    }
  }

  async function handleAddLeague() {
    if (!previewLeague) return;

    setIsAdding(true);
    setAddError(null);

    try {
      const res = await fetch("/api/user/leagues", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          leagueId: previewLeague.id,
        }),
      });

      const payload = (await res.json()) as AddLeagueResponse;
      if (!res.ok || !payload.league) {
        setAddError(payload.error || "Failed to add league.");
        return;
      }

      setAddOpen(false);
      setLeagueIdInput("");
      setPreviewLeague(null);
      setPendingLeagueSelectionId(payload.league.id);
    } catch {
      setAddError("Failed to add league.");
    } finally {
      setIsAdding(false);
    }
  }

  async function handleRemoveLeague() {
    setRemoveError(null);
    setIsRemoving(true);
    try {
      const res = await fetch(`/api/user/leagues?leagueId=${selectedLeagueId}`, {
        method: "DELETE",
      });

      if (!res.ok) {
        const payload = (await res.json()) as { error?: string };
        setRemoveError(payload.error || "Failed to remove league.");
        return;
      }

      const payload = (await res.json()) as {
        leagues?: Array<{ id: number }>;
      };
      const nextLeagueId = payload.leagues?.[0]?.id;

      if (nextLeagueId) {
        router.push(`/dashboard?leagueId=${nextLeagueId}&gw=${gw}`);
      } else {
        router.push("/dashboard");
      }
      setRemoveOpen(false);
      router.refresh();
    } finally {
      setIsRemoving(false);
    }
  }

  const queuedJobs = backfillStatus?.summary.queued ?? 0;
  const runningJobs = backfillStatus?.summary.running ?? 0;
  const failedJobs = backfillStatus?.summary.failed ?? 0;
  const hasActiveBackfillJobs = queuedJobs + runningJobs > 0;

  React.useEffect(() => {
    if (!pendingLeagueSelectionId) return;
    if (hasActiveBackfillJobs) return;

    // Force a full navigation so server-rendered league props are fresh immediately.
    window.location.assign(
      `/dashboard?leagueId=${pendingLeagueSelectionId}&gw=${currentGw}`
    );
    setPendingLeagueSelectionId(null);
  }, [currentGw, hasActiveBackfillJobs, pendingLeagueSelectionId]);

  return (
    <div className="flex items-center gap-2">
      <Popover open={addOpen} onOpenChange={setAddOpen}>
        <PopoverTrigger asChild>
          <Button
            type="button"
            variant="outline"
            size="icon"
            className="h-12 w-12"
            aria-label="Add league"
          >
            <Plus />
          </Button>
        </PopoverTrigger>
        <PopoverContent align="start" className="w-80">
          <div className="space-y-3">
            <div>
              <h3 className="text-sm font-semibold">Add league</h3>
              <p className="text-xs text-muted-foreground">
                Enter an FPL classic league ID to add it to your dashboard.
              </p>
            </div>
            <Input
              inputMode="numeric"
              placeholder="League ID"
              value={leagueIdInput}
              onChange={(event) => {
                setLeagueIdInput(event.target.value);
                setPreviewLeague(null);
              }}
              disabled={isAdding || isChecking}
            />
            {previewLeague ? (
              <p className="text-xs">
                League found: <span className="font-medium">{previewLeague.name}</span>
              </p>
            ) : null}
            {addError ? <p className="text-xs text-destructive">{addError}</p> : null}
            {!previewLeague ? (
              <Button
                type="button"
                onClick={handleCheckLeague}
                disabled={isChecking || isAdding}
              >
                {isChecking ? "Checking..." : "Check League"}
              </Button>
            ) : (
              <Button type="button" onClick={handleAddLeague} disabled={isAdding}>
                {isAdding ? "Adding..." : "Confirm Add"}
              </Button>
            )}
          </div>
        </PopoverContent>
      </Popover>

      <Popover
        open={removeOpen}
        onOpenChange={(isOpen) => {
          if (isRemoving) return;
          setRemoveOpen(isOpen);
        }}
      >
        <PopoverTrigger asChild>
          <Button
            type="button"
            variant="outline"
            size="icon"
            className="h-12 w-12"
            aria-label="Remove selected league"
            disabled={isRemoving}
          >
            <Trash2 />
          </Button>
        </PopoverTrigger>
        <PopoverContent align="start" className="w-80">
          <div className="space-y-3">
            <div>
              <h3 className="text-sm font-semibold">Remove league</h3>
              <p className="text-xs text-muted-foreground">
                Remove <span className="font-medium">{selectedLeagueName}</span> from
                your dashboard?
              </p>
            </div>
            <div className="flex items-center gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => setRemoveOpen(false)}
                disabled={isRemoving}
              >
                Cancel
              </Button>
              <Button type="button" onClick={handleRemoveLeague} disabled={isRemoving}>
                {isRemoving ? "Removing..." : "Confirm Remove"}
              </Button>
            </div>
            {removeError ? <p className="text-xs text-destructive">{removeError}</p> : null}
          </div>
        </PopoverContent>
      </Popover>

      {hasActiveBackfillJobs ? (
        <div className="hidden sm:flex items-center gap-1 rounded-md border px-2 py-1 text-xs text-amber-700 dark:text-amber-300">
          <Loader2 className="h-3.5 w-3.5 animate-spin" />
          <span>Updating league data</span>
        </div>
      ) : null}

      {!hasActiveBackfillJobs && failedJobs > 0 ? (
        <div className="hidden sm:flex items-center gap-1 rounded-md border px-2 py-1 text-xs text-red-700 dark:text-red-300">
          <AlertTriangle className="h-3.5 w-3.5" />
          <span>{failedJobs} backfill failed</span>
        </div>
      ) : null}
    </div>
  );
}
