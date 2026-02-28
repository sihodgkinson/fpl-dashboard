"use client";

import * as React from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import useSWR from "swr";
import { CircleHelp, CirclePlus, Trash2 } from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

interface League {
  id: number;
  name: string;
}

interface LeagueSelectorProps {
  leagues: League[];
  selectedLeagueId: number;
  currentGw: number;
  className?: string;
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

interface BackfillStatusResponse {
  summary: {
    queued: number;
    running: number;
    failed: number;
  };
}

interface UserLeaguesResponse {
  leagues: Array<{
    id: number;
    name: string;
  }>;
  limits?: {
    maxLeaguesPerUser?: number;
    maxManagersPerLeague?: number;
  };
  guardrails?: {
    addLeagueEnabled?: boolean;
    hasActiveBackfillForUser?: boolean;
    globalActiveBackfillJobs?: number;
    globalActiveBackfillLimit?: number;
    isGlobalBackfillAtCapacity?: boolean;
  };
}

const userLeaguesFetcher = async (url: string) => {
  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(`Request failed: ${res.status}`);
  }
  return (await res.json()) as UserLeaguesResponse;
};

const backfillFetcher = async (url: string) => {
  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(`Request failed: ${res.status}`);
  }
  return (await res.json()) as BackfillStatusResponse;
};

export function LeagueSelector({
  leagues,
  selectedLeagueId,
  currentGw,
  className,
}: LeagueSelectorProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const [optimisticLeagueId, setOptimisticLeagueId] = React.useState(selectedLeagueId);
  const [addOpen, setAddOpen] = React.useState(false);
  const [removeOpen, setRemoveOpen] = React.useState(false);
  const [leagueIdInput, setLeagueIdInput] = React.useState("");
  const [previewLeague, setPreviewLeague] = React.useState<{
    id: number;
    name: string;
    managerCount: number | null;
  } | null>(null);
  const [addError, setAddError] = React.useState<string | null>(null);
  const [removeError, setRemoveError] = React.useState<string | null>(null);
  const [isAdding, setIsAdding] = React.useState(false);
  const [isChecking, setIsChecking] = React.useState(false);
  const [isRemoving, setIsRemoving] = React.useState(false);
  const [retryAfterSeconds, setRetryAfterSeconds] = React.useState(0);
  const [pendingLeagueSelectionId, setPendingLeagueSelectionId] = React.useState<number | null>(
    null
  );

  const currentPath = pathname || "/dashboard";
  const gw = searchParams.get("gw") || String(currentGw);
  const selectedLeagueName =
    leagues.find((league) => league.id === selectedLeagueId)?.name ?? `League ${selectedLeagueId}`;

  const { data: userLeaguesData, mutate: mutateUserLeagues } = useSWR<UserLeaguesResponse>(
    "/api/user/leagues",
    userLeaguesFetcher,
    {
      revalidateOnFocus: true,
    }
  );

  const shouldPollBackfillStatus = Boolean(pendingLeagueSelectionId);
  const { data: backfillStatus } = useSWR<BackfillStatusResponse>(
    "/api/user/backfill-status",
    backfillFetcher,
    {
      refreshInterval: (latestData) => {
        const queuedJobs = latestData?.summary.queued ?? 0;
        const runningJobs = latestData?.summary.running ?? 0;
        const hasActiveJobs = queuedJobs + runningJobs > 0;
        return shouldPollBackfillStatus || hasActiveJobs ? 2500 : 0;
      },
      revalidateOnFocus: true,
    }
  );

  React.useEffect(() => {
    setOptimisticLeagueId(selectedLeagueId);
  }, [selectedLeagueId]);

  React.useEffect(() => {
    if (retryAfterSeconds <= 0) return;
    const timer = window.setTimeout(() => {
      setRetryAfterSeconds((seconds) => Math.max(0, seconds - 1));
    }, 1000);
    return () => window.clearTimeout(timer);
  }, [retryAfterSeconds]);

  const queuedJobs = backfillStatus?.summary.queued ?? 0;
  const runningJobs = backfillStatus?.summary.running ?? 0;
  const hasActiveBackfillJobs = queuedJobs + runningJobs > 0;

  React.useEffect(() => {
    if (!pendingLeagueSelectionId) return;
    if (hasActiveBackfillJobs) return;

    window.location.assign(`${currentPath}?leagueId=${pendingLeagueSelectionId}&gw=${currentGw}`);
    setPendingLeagueSelectionId(null);
  }, [currentGw, currentPath, hasActiveBackfillJobs, pendingLeagueSelectionId]);

  const maxLeaguesPerUser = userLeaguesData?.limits?.maxLeaguesPerUser ?? 3;
  const maxManagersPerLeague = userLeaguesData?.limits?.maxManagersPerLeague ?? 30;
  const currentLeagueCount = userLeaguesData?.leagues.length ?? 0;
  const addLeagueEnabled = userLeaguesData?.guardrails?.addLeagueEnabled ?? true;
  const hasActiveBackfillForUser = userLeaguesData?.guardrails?.hasActiveBackfillForUser ?? false;
  const isGlobalBackfillAtCapacity =
    userLeaguesData?.guardrails?.isGlobalBackfillAtCapacity ?? false;
  const globalActiveBackfillJobs = userLeaguesData?.guardrails?.globalActiveBackfillJobs ?? 0;
  const globalActiveBackfillLimit = userLeaguesData?.guardrails?.globalActiveBackfillLimit ?? 0;
  const isAtLeagueLimit = currentLeagueCount >= maxLeaguesPerUser;
  const isRateLimited = retryAfterSeconds > 0;

  const addBlockedReason = isRateLimited
    ? `Too many requests. Try again in ${retryAfterSeconds}s.`
    : !addLeagueEnabled
      ? "Adding leagues is temporarily paused for beta capacity."
      : hasActiveBackfillForUser || hasActiveBackfillJobs
        ? "Wait for your current league backfill to finish before adding another league."
        : isGlobalBackfillAtCapacity
          ? `League processing is at capacity (${globalActiveBackfillJobs}/${globalActiveBackfillLimit}). Please try again shortly.`
          : isAtLeagueLimit
            ? `You have reached the beta limit of ${maxLeaguesPerUser} leagues.`
            : null;
  const isAddActionDisabled = addBlockedReason !== null;

  const resetAddState = React.useCallback(() => {
    setAddOpen(false);
    setLeagueIdInput("");
    setPreviewLeague(null);
    setAddError(null);
  }, []);

  async function handleCheckLeague() {
    const leagueId = Number(leagueIdInput.trim());
    if (!Number.isInteger(leagueId) || leagueId <= 0) {
      setAddError("Enter a valid league ID.");
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
      if (!res.ok) {
        if (
          res.status === 429 &&
          typeof payload.retryAfterSeconds === "number" &&
          payload.retryAfterSeconds > 0
        ) {
          setRetryAfterSeconds(Math.ceil(payload.retryAfterSeconds));
        }
        setAddError(payload.error || "Failed to validate league.");
        return;
      }
      if (!payload.league) {
        setAddError(payload.error || "Failed to validate league.");
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
      if (!res.ok) {
        if (
          res.status === 429 &&
          typeof payload.retryAfterSeconds === "number" &&
          payload.retryAfterSeconds > 0
        ) {
          setRetryAfterSeconds(Math.ceil(payload.retryAfterSeconds));
        }
        setAddError(payload.error || "Failed to add league.");
        return;
      }
      if (!payload.league) {
        setAddError(payload.error || "Failed to add league.");
        return;
      }

      resetAddState();
      void mutateUserLeagues();
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
        router.push(`${currentPath}?leagueId=${nextLeagueId}&gw=${gw}`, { scroll: false });
      } else {
        router.push("/dashboard", { scroll: false });
      }
      setRemoveOpen(false);
      void mutateUserLeagues();
      router.refresh();
    } finally {
      setIsRemoving(false);
    }
  }

  return (
    <Select
      value={String(optimisticLeagueId)}
      onValueChange={(value) => {
        const parsedValue = Number(value);
        if (Number.isInteger(parsedValue) && parsedValue > 0) {
          setOptimisticLeagueId(parsedValue);
        }
        const params = new URLSearchParams(searchParams.toString());
        params.set("leagueId", value);
        params.set("gw", String(gw));
        router.push(`${currentPath}?${params.toString()}`, { scroll: false });
      }}
    >
      <SelectTrigger size="sm" className={cn("w-56", className)}>
        <SelectValue placeholder="Select League" />
      </SelectTrigger>
      <SelectContent className="w-[min(18rem,92vw)] p-0" align="end">
        <div className="p-1">
          {leagues.map((league) => (
            <SelectItem key={league.id} value={String(league.id)}>
              {league.name}
            </SelectItem>
          ))}
        </div>

        <div className="border-t border-border p-1">
          <Button
            type="button"
            variant="ghost"
            className="h-8 w-full justify-start gap-2 px-2 text-sm font-normal"
            disabled={isAddActionDisabled}
            onClick={() => {
              setAddOpen((prev) => !prev);
              setRemoveOpen(false);
              setRemoveError(null);
            }}
          >
            <CirclePlus className="h-4 w-4" />
            Add league
          </Button>

          {addBlockedReason ? (
            <p className="mt-1 px-2 text-xs text-muted-foreground">{addBlockedReason}</p>
          ) : null}

          {addOpen ? (
            <div className="mt-2 space-y-2 rounded-md border border-border bg-muted/30 p-2.5">
              <p className="text-xs text-muted-foreground">
                Enter an FPL classic league ID. Beta limits: up to {maxLeaguesPerUser} leagues, up to{" "}
                {maxManagersPerLeague} managers per league.
              </p>
              <Input
                inputMode="numeric"
                placeholder="League ID"
                value={leagueIdInput}
                onChange={(event) => {
                  setLeagueIdInput(event.target.value);
                  setPreviewLeague(null);
                }}
                disabled={isAdding || isChecking || isAddActionDisabled}
                className="h-8"
              />
              {previewLeague ? (
                <p className="text-xs">
                  League found: <span className="font-medium">{previewLeague.name}</span>
                  {previewLeague.managerCount !== null
                    ? ` (${previewLeague.managerCount} managers)`
                    : ""}
                </p>
              ) : null}
              {addError ? <p className="text-xs text-destructive">{addError}</p> : null}
              {!previewLeague ? (
                <Button
                  type="button"
                  onClick={handleCheckLeague}
                  disabled={isChecking || isAdding || isAddActionDisabled}
                  className="h-8 px-3 text-xs"
                >
                  {isChecking ? "Checking..." : "Check League"}
                </Button>
              ) : (
                <Button
                  type="button"
                  onClick={handleAddLeague}
                  disabled={isAdding || isAddActionDisabled}
                  className="h-8 px-3 text-xs"
                >
                  {isAdding ? "Adding..." : "Confirm Add"}
                </Button>
              )}
            </div>
          ) : null}

          <Button
            type="button"
            variant="ghost"
            className="mt-1 h-8 w-full justify-start gap-2 px-2 text-sm font-normal"
            disabled={isRemoving}
            onClick={() => {
              setRemoveOpen((prev) => !prev);
              setAddOpen(false);
              setAddError(null);
            }}
          >
            <Trash2 className="h-4 w-4" />
            Remove current league
          </Button>

          {removeOpen ? (
            <div className="mt-2 space-y-2 rounded-md border border-border bg-muted/30 p-2.5">
              <p className="text-xs text-muted-foreground">
                Remove <span className="font-medium">{selectedLeagueName}</span> from your dashboard?
              </p>
              <Button
                type="button"
                onClick={handleRemoveLeague}
                disabled={isRemoving}
                className="h-8 px-3 text-xs"
              >
                {isRemoving ? "Removing..." : "Confirm Remove"}
              </Button>
              {removeError ? <p className="text-xs text-destructive">{removeError}</p> : null}
            </div>
          ) : null}

          <div className="mt-1">
            <Popover>
              <PopoverTrigger asChild>
                <Button
                  type="button"
                  variant="ghost"
                  className="h-8 w-full justify-start gap-2 px-2 text-sm font-normal text-muted-foreground hover:text-foreground"
                >
                  <CircleHelp className="h-3.5 w-3.5" />
                  League Limits
                </Button>
              </PopoverTrigger>
              <PopoverContent align="end" className="w-64 px-3 py-2 text-xs">
                Beta limits: up to {maxLeaguesPerUser} tracked clubs/leagues per account and up to{" "}
                {maxManagersPerLeague} managers per league.
              </PopoverContent>
            </Popover>
          </div>
        </div>
      </SelectContent>
    </Select>
  );
}
