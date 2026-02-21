"use client";

import * as React from "react";
import useSWR, { useSWRConfig } from "swr";
import { LeagueStatsCards } from "@/app/(dashboard)/[leagueID]/stats/StatsCards";
import { LeagueTable } from "@/app/(dashboard)/[leagueID]/league/LeagueTable";
import { ActivityTab } from "@/app/(dashboard)/[leagueID]/activity/ActivityTable";
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
          </TabsList>
        </Tabs>

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
        </div>
      </main>
    </div>
  );
}
