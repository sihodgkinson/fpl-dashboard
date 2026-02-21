"use client";

import * as React from "react";
import { useRouter, useSearchParams } from "next/navigation";
import useSWR from "swr";
import {
  AlertTriangle,
  Loader2,
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
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
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

export function AccountMenu({
  className,
  selectedLeagueId,
  selectedLeagueName,
  currentGw,
}: AccountMenuProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [avatarFailed, setAvatarFailed] = React.useState(false);
  const [menuOpen, setMenuOpen] = React.useState(false);
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
  const { theme, setTheme } = useTheme();
  const { data, mutate } = useSWR<SessionResponse>("/api/auth/session", sessionFetcher, {
    revalidateOnFocus: true,
  });
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

  const user = data?.user;
  const name = user?.name || "Signed in user";
  const email = user?.email || "No email";
  const avatarUrl = !avatarFailed ? user?.avatarUrl : null;
  const gw = searchParams.get("gw") || String(currentGw);
  const queuedJobs = backfillStatus?.summary.queued ?? 0;
  const runningJobs = backfillStatus?.summary.running ?? 0;
  const failedJobs = backfillStatus?.summary.failed ?? 0;
  const hasActiveBackfillJobs = queuedJobs + runningJobs > 0;

  async function handleLogout() {
    await fetch("/api/auth/logout", { method: "POST" });
    await mutate();
    router.push("/dashboard");
    router.refresh();
  }

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
      setMenuOpen(false);
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
        router.push(`/dashboard?leagueId=${nextLeagueId}&gw=${gw}`, { scroll: false });
      } else {
        router.push("/dashboard", { scroll: false });
      }
      setRemoveOpen(false);
      setMenuOpen(false);
      router.refresh();
    } finally {
      setIsRemoving(false);
    }
  }

  React.useEffect(() => {
    if (!pendingLeagueSelectionId) return;
    if (hasActiveBackfillJobs) return;

    window.location.assign(
      `/dashboard?leagueId=${pendingLeagueSelectionId}&gw=${currentGw}`
    );
    setPendingLeagueSelectionId(null);
  }, [currentGw, hasActiveBackfillJobs, pendingLeagueSelectionId]);

  return (
    <DropdownMenu open={menuOpen} onOpenChange={setMenuOpen}>
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
        <div className="space-y-3 px-4 py-3">
          <Popover open={addOpen} onOpenChange={setAddOpen}>
            <PopoverTrigger asChild>
              <Button type="button" variant="outline" className="w-full justify-start gap-2">
                <Plus className="h-4 w-4" />
                Add league
              </Button>
            </PopoverTrigger>
            <PopoverContent align="end" className="w-80">
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
                className="w-full justify-start gap-2"
                disabled={isRemoving}
              >
                <Trash2 className="h-4 w-4" />
                Remove current league
              </Button>
            </PopoverTrigger>
            <PopoverContent align="end" className="w-80">
              <div className="space-y-3">
                <div>
                  <h3 className="text-sm font-semibold">Remove league</h3>
                  <p className="text-xs text-muted-foreground">
                    Remove <span className="font-medium">{selectedLeagueName}</span> from your
                    dashboard?
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
            <div className="flex items-center gap-1 rounded-md border px-2 py-1 text-xs text-amber-700 dark:text-amber-300">
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
              <span>Updating league data</span>
            </div>
          ) : null}

          {!hasActiveBackfillJobs && failedJobs > 0 ? (
            <div className="flex items-center gap-1 rounded-md border px-2 py-1 text-xs text-red-700 dark:text-red-300">
              <AlertTriangle className="h-3.5 w-3.5" />
              <span>{failedJobs} backfill failed</span>
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
