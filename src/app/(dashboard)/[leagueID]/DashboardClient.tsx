"use client";

import * as React from "react";
import useSWR, { useSWRConfig } from "swr";
import { LeagueStatsCards } from "@/app/(dashboard)/[leagueID]/stats/StatsCards";
import { LeagueTable } from "@/app/(dashboard)/[leagueID]/league/LeagueTable";
import { ActivityTab } from "@/app/(dashboard)/[leagueID]/activity/ActivityTable";
import { GW1Table, GW1Standing } from "@/app/(dashboard)/[leagueID]/gw1/GW1Table";
import { X } from "lucide-react";
import { GameweekSelector } from "@/components/common/GameweekSelector";
import { LeagueSelector } from "@/components/common/LeagueSelector";
import { LeagueManager } from "@/components/common/LeagueManager";
import { AccountMenu } from "@/components/common/AccountMenu";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { EnrichedStanding } from "@/types/fpl";

const fetcher = async (url: string) => {
  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(`Request failed: ${res.status}`);
  }
  return res.json();
};

interface StandingsResponse {
  standings: EnrichedStanding[];
  stats: {
    mostPoints: EnrichedStanding | null;
    fewestPoints: EnrichedStanding | null;
    mostBench: EnrichedStanding | null;
    mostTransfers: EnrichedStanding | null;
  } | null;
}

interface GW1TableResponse {
  standings: GW1Standing[];
}

interface DashboardClientProps {
  leagues: {
    id: number;
    name: string;
    standings: EnrichedStanding[] | null;
    stats: {
      mostPoints: EnrichedStanding | null;
      fewestPoints: EnrichedStanding | null;
      mostBench: EnrichedStanding | null;
      mostTransfers: EnrichedStanding | null;
    } | null;
  }[];
  selectedLeagueId: number;
  currentGw: number;
  maxGw: number;
  gw: number;
}

const LIVE_POLL_LOCK_KEY = "fpl-live-refresh-lock";
const LIVE_POLL_LOCK_TTL_MS = 45_000;
const LIVE_REFRESH_INTERVAL_MS = 30_000;
const ORIENTATION_HINT_DISMISSED_KEY = "fpl-orientation-hint-dismissed-v2";

function useLivePollingLeader() {
  const [isLeader, setIsLeader] = React.useState(false);
  const tabIdRef = React.useRef<string>(
    typeof crypto !== "undefined" && "randomUUID" in crypto
      ? crypto.randomUUID()
      : `${Date.now()}-${Math.random()}`
  );

  React.useEffect(() => {
    if (typeof window === "undefined") return;

    const readLock = (): { owner: string; expiresAt: number } | null => {
      try {
        const raw = window.localStorage.getItem(LIVE_POLL_LOCK_KEY);
        if (!raw) return null;
        return JSON.parse(raw) as { owner: string; expiresAt: number };
      } catch {
        return null;
      }
    };

    const renewLock = () => {
      const now = Date.now();
      const parsed = readLock();
      const ownedByThisTab = parsed?.owner === tabIdRef.current;
      const expired = !parsed || parsed.expiresAt < now;

      if (ownedByThisTab || expired) {
        window.localStorage.setItem(
          LIVE_POLL_LOCK_KEY,
          JSON.stringify({
            owner: tabIdRef.current,
            expiresAt: now + LIVE_POLL_LOCK_TTL_MS,
          })
        );
        setIsLeader(true);
      } else {
        setIsLeader(false);
      }
    };

    const releaseLock = () => {
      const parsed = readLock();
      if (parsed?.owner === tabIdRef.current) {
        window.localStorage.removeItem(LIVE_POLL_LOCK_KEY);
      }
    };

    renewLock();
    const interval = window.setInterval(renewLock, 10_000);
    window.addEventListener("beforeunload", releaseLock);
    return () => {
      window.clearInterval(interval);
      window.removeEventListener("beforeunload", releaseLock);
      releaseLock();
    };
  }, []);

  return isLeader;
}

export default function DashboardClient({
  leagues,
  selectedLeagueId,
  currentGw,
  maxGw,
  gw,
}: DashboardClientProps) {
  const [tab, setTab] = React.useState("league");
  const [showOrientationHint, setShowOrientationHint] = React.useState(false);
  const prefetchedKeysRef = React.useRef<Set<string>>(new Set());
  const { mutate } = useSWRConfig();
  const isPollingLeader = useLivePollingLeader();

  // Find the selected league's preloaded data
  const selectedLeague = leagues.find((l) => l.id === selectedLeagueId);
  const hasPreloadedCurrentGwData =
    gw === currentGw &&
    !!selectedLeague?.standings &&
    selectedLeague.standings.length > 0;

  const { data, error } = useSWR<StandingsResponse>(
    `/api/league?leagueId=${selectedLeagueId}&gw=${gw}&currentGw=${currentGw}`,
    fetcher,
    {
      fallbackData: hasPreloadedCurrentGwData
        ? {
            standings: selectedLeague.standings ?? [],
            stats: selectedLeague.stats ?? null,
          }
        : undefined,
      refreshInterval: 0,
      revalidateOnFocus: false,
    }
  );

  const standings = Array.isArray(data?.standings)
    ? data.standings
    : [];
  const {
    data: gw1Data,
    error: gw1Error,
  } = useSWR<GW1TableResponse>(
    `/api/gw1-table?leagueId=${selectedLeagueId}&gw=${gw}&currentGw=${currentGw}`,
    fetcher,
    {
      refreshInterval: 0,
      revalidateOnFocus: false,
    }
  );
  const gw1Standings = Array.isArray(gw1Data?.standings) ? gw1Data.standings : [];

  const stats = data?.stats ?? null;
  const isLeagueDataLoading = !data && !error;

  const prefetchKey = React.useCallback(
    async (key: string) => {
      if (prefetchedKeysRef.current.has(key)) return;
      prefetchedKeysRef.current.add(key);

      try {
        await mutate(key, fetcher(key), {
          populateCache: true,
          revalidate: false,
        });
      } catch {
        // Allow retries if a background prefetch fails.
        prefetchedKeysRef.current.delete(key);
      }
    },
    [mutate]
  );

  React.useEffect(() => {
    const keysToPrefetch = new Set<string>();
    const immutableGwLookback = 2;

    // Current GW activity is effectively immutable after lock.
    keysToPrefetch.add(
      `/api/activity-impact?leagueId=${selectedLeagueId}&gw=${currentGw}&currentGw=${currentGw}`
    );
    keysToPrefetch.add(
      `/api/stats-trend?leagueId=${selectedLeagueId}&gw=${gw}&window=8`
    );

    // Prefetch inactive tab payload for the currently selected GW.
    if (tab !== "activity") {
      keysToPrefetch.add(
        `/api/activity-impact?leagueId=${selectedLeagueId}&gw=${gw}&currentGw=${currentGw}`
      );
    }
    if (tab !== "gw1") {
      keysToPrefetch.add(
        `/api/gw1-table?leagueId=${selectedLeagueId}&gw=${gw}&currentGw=${currentGw}`
      );
    }

    // Warm nearby immutable GWs so backward navigation feels instant.
    if (gw > 1) {
      const fromGw = Math.max(1, gw - immutableGwLookback);
      for (let candidateGw = fromGw; candidateGw < gw; candidateGw += 1) {
        keysToPrefetch.add(
          `/api/league?leagueId=${selectedLeagueId}&gw=${candidateGw}&currentGw=${currentGw}`
        );
        keysToPrefetch.add(
          `/api/activity-impact?leagueId=${selectedLeagueId}&gw=${candidateGw}&currentGw=${currentGw}`
        );
        keysToPrefetch.add(
          `/api/stats-trend?leagueId=${selectedLeagueId}&gw=${candidateGw}&window=8`
        );
        keysToPrefetch.add(
          `/api/gw1-table?leagueId=${selectedLeagueId}&gw=${candidateGw}&currentGw=${currentGw}`
        );
      }
    }

    let cancelled = false;
    const timer = window.setTimeout(async () => {
      for (const key of keysToPrefetch) {
        if (cancelled) return;
        await prefetchKey(key);
      }
    }, 250);

    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [currentGw, gw, prefetchKey, selectedLeagueId, tab]);

  React.useEffect(() => {
    if (gw !== currentGw) return;
    if (!isPollingLeader) return;
    if (typeof document !== "undefined" && document.visibilityState !== "visible") return;

    const refreshCurrentGw = async () => {
      await Promise.allSettled([
        mutate(
          `/api/league?leagueId=${selectedLeagueId}&gw=${currentGw}&currentGw=${currentGw}`
        ),
        mutate(
          `/api/activity-impact?leagueId=${selectedLeagueId}&gw=${currentGw}&currentGw=${currentGw}`
        ),
        mutate(`/api/stats-trend?leagueId=${selectedLeagueId}&gw=${currentGw}&window=8`),
      ]);
    };

    const interval = window.setInterval(refreshCurrentGw, LIVE_REFRESH_INTERVAL_MS);
    return () => window.clearInterval(interval);
  }, [currentGw, gw, isPollingLeader, mutate, selectedLeagueId]);

  React.useEffect(() => {
    if (typeof window === "undefined") return;

    const evaluateHintVisibility = () => {
      const isLandscape = window.matchMedia("(orientation: landscape)").matches;
      const isPortrait = window.matchMedia("(orientation: portrait)").matches;
      const isMobileViewport = window.matchMedia("(max-width: 639px)").matches;
      const persistedDismissed =
        window.localStorage.getItem(ORIENTATION_HINT_DISMISSED_KEY) === "1";

      if (isLandscape && isMobileViewport) {
        window.localStorage.setItem(ORIENTATION_HINT_DISMISSED_KEY, "1");
        setShowOrientationHint(false);
        return;
      }

      setShowOrientationHint(isMobileViewport && isPortrait && !persistedDismissed);
    };

    evaluateHintVisibility();
    window.addEventListener("resize", evaluateHintVisibility);
    window.addEventListener("orientationchange", evaluateHintVisibility);

    return () => {
      window.removeEventListener("resize", evaluateHintVisibility);
      window.removeEventListener("orientationchange", evaluateHintVisibility);
    };
  }, []);

  const dismissOrientationHint = React.useCallback(() => {
    if (typeof window !== "undefined") {
      window.localStorage.setItem(ORIENTATION_HINT_DISMISSED_KEY, "1");
    }
    setShowOrientationHint(false);
  }, []);

  return (
    <div className="mobile-landscape-scroll-shell flex min-h-svh flex-col sm:h-svh sm:min-h-svh sm:overflow-hidden">
      {/* Header with selectors */}
      <header className="border-b px-4 py-4 sm:px-4 sm:py-4 md:px-6 md:py-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          {/* Top row: League selector */}
          <div className="flex items-center gap-2 w-full sm:w-auto">
            <LeagueSelector
              leagues={leagues}
              selectedLeagueId={selectedLeagueId}
              currentGw={currentGw}
              className="flex-1 sm:flex-none !h-12 text-base sm:h-12 sm:text-sm"
            />
            <LeagueManager
              selectedLeagueId={selectedLeagueId}
              selectedLeagueName={selectedLeague?.name ?? `League ${selectedLeagueId}`}
              currentGw={currentGw}
            />
          </div>

          {/* Bottom row (on mobile): Gameweek selector + account menu */}
          <div className="flex items-center gap-4 sm:gap-6 w-full sm:w-auto">
            <GameweekSelector
              selectedLeagueId={selectedLeagueId}
              currentGw={currentGw}
              maxGw={maxGw}
              className="flex-1 sm:flex-none !h-12 text-base sm:h-12 sm:text-sm"
            />
            <AccountMenu className="h-12 w-12 sm:h-12 sm:w-12" />
          </div>
        </div>
      </header>

      {/* Main content */}
      <main className="mobile-landscape-scroll-main flex flex-1 min-h-0 flex-col gap-4 p-4 sm:gap-6 sm:overflow-hidden sm:p-4 md:p-6">
        {/* Stats cards */}
        <LeagueStatsCards
          stats={stats}
          leagueId={selectedLeagueId}
          gw={gw}
          currentGw={currentGw}
          isLoading={isLeagueDataLoading}
          hasError={Boolean(error)}
        />

        {/* ✅ Mobile dropdown for tabs */}
        <div className="block sm:hidden w-full">
          <Select value={tab} onValueChange={setTab}>
            <SelectTrigger className="w-full !h-12 text-base">
              <SelectValue placeholder="Select view" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="league">League Table</SelectItem>
              <SelectItem value="activity">Manager Influence</SelectItem>
              <SelectItem value="gw1">GW1 Table</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* ✅ Desktop tabs (triggers only) */}
        <Tabs value={tab} onValueChange={setTab} className="hidden sm:block w-full">
          <TabsList>
            <TabsTrigger value="league" type="button" className="px-3 sm:px-4">
              League Table
            </TabsTrigger>
            <TabsTrigger value="activity" type="button" className="px-3 sm:px-4">
              Manager Influence
            </TabsTrigger>
            <TabsTrigger value="gw1" type="button" className="px-3 sm:px-4">
              GW1 Table
            </TabsTrigger>
          </TabsList>
        </Tabs>

        {showOrientationHint ? (
          <div className="sm:hidden flex items-center justify-between gap-2 rounded-md border border-border bg-muted/40 px-3 py-2 text-xs text-muted-foreground">
            <span>Viewing compact table. Rotate to landscape for full columns.</span>
            <button
              type="button"
              onClick={dismissOrientationHint}
              aria-label="Dismiss orientation hint"
              className="rounded-sm p-0.5 text-muted-foreground hover:text-foreground"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
        ) : null}

        {/* ✅ Tab content (all pre-mounted, hidden with CSS) */}
        <div className="flex w-full min-h-0 flex-1 flex-col">
          <div className={tab === "league" ? "min-h-0 flex-1" : "hidden"}>
            <LeagueTable
              standings={standings}
              isLoading={isLeagueDataLoading}
              hasError={Boolean(error)}
            />
          </div>

          <div className={tab === "activity" ? "min-h-0 flex-1" : "hidden"}>
            <ActivityTab leagueId={selectedLeagueId} currentGw={currentGw} />
          </div>

          <div className={tab === "gw1" ? "min-h-0 flex-1" : "hidden"}>
            <GW1Table
              standings={gw1Standings}
              isLoading={!gw1Data && !gw1Error}
              hasError={Boolean(gw1Error)}
            />
          </div>
        </div>
      </main>
    </div>
  );
}
