"use client";

import * as React from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import useSWR from "swr";
import {
  CircleHelp,
  LogOut,
  Menu,
  Monitor,
  Moon,
  Plus,
  Sun,
  Trash2,
  User,
} from "lucide-react";
import { useTheme } from "next-themes";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";

interface SessionResponse {
  isAuthenticated: boolean;
  user: {
    id: string;
    email: string | null;
    name: string | null;
    avatarUrl: string | null;
  } | null;
}

interface AccountMenuProps {
  className?: string;
  selectedLeagueId: number;
  selectedLeagueName: string;
  currentGw: number;
}

interface AddLeagueResponse {
  league?: {
    id: number;
    name: string;
  };
  managerCount?: number;
  preview?: boolean;
  fullBackfillQueued?: boolean;
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

const sessionFetcher = async (url: string) => {
  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(`Request failed: ${res.status}`);
  }
  return (await res.json()) as SessionResponse;
};

const backfillFetcher = async (url: string) => {
  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(`Request failed: ${res.status}`);
  }
  return (await res.json()) as BackfillStatusResponse;
};

const userLeaguesFetcher = async (url: string) => {
  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(`Request failed: ${res.status}`);
  }
  return (await res.json()) as UserLeaguesResponse;
};

export function AccountMenu({
  className,
  selectedLeagueId,
  selectedLeagueName,
  currentGw,
}: AccountMenuProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [avatarFailed, setAvatarFailed] = React.useState(false);
  const [menuOpen, setMenuOpen] = React.useState(false);
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
  const { theme, setTheme } = useTheme();
  const { data, mutate: mutateSession } = useSWR<SessionResponse>("/api/auth/session", sessionFetcher, {
    revalidateOnFocus: true,
  });
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
    setAvatarFailed(false);
  }, [data?.user?.avatarUrl]);

  React.useEffect(() => {
    if (retryAfterSeconds <= 0) return;
    const timer = window.setTimeout(() => {
      setRetryAfterSeconds((seconds) => Math.max(0, seconds - 1));
    }, 1000);
    return () => window.clearTimeout(timer);
  }, [retryAfterSeconds]);

  const user = data?.user;
  const name = user?.name || "Signed in user";
  const email = user?.email || "No email";
  const avatarUrl = !avatarFailed ? user?.avatarUrl : null;
  const gw = searchParams.get("gw") || String(currentGw);
  const dashboardPath = pathname || "/dashboard";
  const queuedJobs = backfillStatus?.summary.queued ?? 0;
  const runningJobs = backfillStatus?.summary.running ?? 0;
  const hasActiveBackfillJobs = queuedJobs + runningJobs > 0;
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

  const resetLeagueSectionState = React.useCallback(() => {
    setAddOpen(false);
    setRemoveOpen(false);
    setLeagueIdInput("");
    setPreviewLeague(null);
    setAddError(null);
    setRemoveError(null);
  }, []);

  async function handleLogout() {
    await fetch("/api/auth/logout", { method: "POST" });
    await mutateSession();
    router.push("/");
    router.refresh();
  }

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

      setAddOpen(false);
      setMenuOpen(false);
      setLeagueIdInput("");
      setPreviewLeague(null);
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
        router.push(`${dashboardPath}?leagueId=${nextLeagueId}&gw=${gw}`, { scroll: false });
      } else {
        router.push("/dashboard", { scroll: false });
      }
      setRemoveOpen(false);
      setMenuOpen(false);
      void mutateUserLeagues();
      router.refresh();
    } finally {
      setIsRemoving(false);
    }
  }

  React.useEffect(() => {
    if (!pendingLeagueSelectionId) return;
    if (hasActiveBackfillJobs) return;

    window.location.assign(
      `${dashboardPath}?leagueId=${pendingLeagueSelectionId}&gw=${currentGw}`
    );
    setPendingLeagueSelectionId(null);
  }, [currentGw, dashboardPath, hasActiveBackfillJobs, pendingLeagueSelectionId]);

  return (
    <DropdownMenu
      open={menuOpen}
      onOpenChange={(isOpen) => {
        setMenuOpen(isOpen);
        if (!isOpen) {
          resetLeagueSectionState();
        }
      }}
    >
      <DropdownMenuTrigger asChild>
        <Button
          variant="outline"
          size="icon"
          className={cn("h-12 w-12", className)}
          aria-label="Account settings"
        >
          <Menu className="h-5 w-5" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-72 p-0">
        <div className="flex items-center gap-3 px-4 py-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-full border bg-background">
            {avatarUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={avatarUrl}
                alt={name}
                className="h-full w-full rounded-full object-cover"
                onError={() => setAvatarFailed(true)}
              />
            ) : (
              <User className="h-5 w-5" />
            )}
          </div>
          <div className="min-w-0 space-y-1">
            <p className="truncate text-sm font-semibold leading-none">{name}</p>
            <p className="truncate text-sm text-muted-foreground">{email}</p>
          </div>
        </div>
        <DropdownMenuSeparator className="my-0" />
        <div className="px-4 py-3">
          <div className="mb-2 flex items-center justify-between">
            <span className="text-xs text-muted-foreground">League limits</span>
            <Popover>
              <PopoverTrigger asChild>
                <Button
                  type="button"
                  variant="ghost"
                  className="h-7 gap-1.5 px-2 text-xs text-muted-foreground hover:text-foreground"
                >
                  <CircleHelp className="h-3.5 w-3.5" />
                  Limits
                </Button>
              </PopoverTrigger>
              <PopoverContent align="end" className="w-64 px-3 py-2 text-xs">
                Beta limits: up to {maxLeaguesPerUser} tracked clubs/leagues per
                account and up to {maxManagersPerLeague} managers per league.
              </PopoverContent>
            </Popover>
          </div>
          <Button
            type="button"
            variant="ghost"
            className="w-full justify-start gap-2 px-0"
            disabled={isAddActionDisabled}
            onClick={() => {
              setAddOpen((prev) => {
                const nextOpen = !prev;
                if (!nextOpen) {
                  setLeagueIdInput("");
                  setPreviewLeague(null);
                  setAddError(null);
                }
                return nextOpen;
              });
              setRemoveOpen(false);
            }}
          >
            <Plus className="h-4 w-4" />
            Add league
          </Button>
          {addBlockedReason ? (
            <p className="mt-2 text-xs text-muted-foreground">
              {addBlockedReason}
            </p>
          ) : null}
          {addOpen ? (
            <div className="mt-3 space-y-3">
              <p className="text-xs text-muted-foreground">
                Enter an FPL classic league ID. Beta limits: up to{" "}
                {maxLeaguesPerUser} leagues, up to {maxManagersPerLeague} managers
                per league.
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
        </div>
        <DropdownMenuSeparator className="my-0" />
        <div className="px-4 py-3">
          <Button
            type="button"
            variant="ghost"
            className="w-full justify-start gap-2 px-0"
            disabled={isRemoving}
            onClick={() => {
              setRemoveOpen((prev) => !prev);
              setAddOpen(false);
            }}
          >
            <Trash2 className="h-4 w-4" />
            Remove current league
          </Button>
          {removeOpen ? (
            <div className="mt-3 space-y-3">
              <p className="text-xs text-muted-foreground">
                Remove <span className="font-medium">{selectedLeagueName}</span> from your
                dashboard?
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
        </div>
        <DropdownMenuSeparator className="my-0" />
        <div className="flex items-center justify-between gap-3 px-4 py-3">
          <span className="text-sm text-muted-foreground">Theme</span>
          <div className="inline-flex rounded-md border p-0.5">
            <button
              type="button"
              className={cn(
                "inline-flex h-8 w-8 items-center justify-center rounded-sm",
                theme === "light" ? "bg-accent text-accent-foreground" : "text-muted-foreground"
              )}
              onClick={() => setTheme("light")}
              aria-label="Set light theme"
            >
              <Sun className="h-4 w-4" />
            </button>
            <button
              type="button"
              className={cn(
                "inline-flex h-8 w-8 items-center justify-center rounded-sm",
                theme === "dark" ? "bg-accent text-accent-foreground" : "text-muted-foreground"
              )}
              onClick={() => setTheme("dark")}
              aria-label="Set dark theme"
            >
              <Moon className="h-4 w-4" />
            </button>
            <button
              type="button"
              className={cn(
                "inline-flex h-8 w-8 items-center justify-center rounded-sm",
                theme === "system" ? "bg-accent text-accent-foreground" : "text-muted-foreground"
              )}
              onClick={() => setTheme("system")}
              aria-label="Use system theme"
            >
              <Monitor className="h-4 w-4" />
            </button>
          </div>
        </div>
        <DropdownMenuSeparator className="my-0" />
        <div className="px-4 py-3">
          <Button
            type="button"
            variant="ghost"
            className="w-full justify-start gap-2 px-0"
            onClick={() => void handleLogout()}
          >
            <LogOut className="h-4 w-4" />
            Log out
          </Button>
        </div>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
