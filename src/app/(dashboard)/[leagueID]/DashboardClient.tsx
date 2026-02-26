"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import useSWR, { useSWRConfig } from "swr";
import { LeagueStatsCards } from "@/app/(dashboard)/[leagueID]/stats/StatsCards";
import { LeagueTable } from "@/app/(dashboard)/[leagueID]/league/LeagueTable";
import { ActivityTab } from "@/app/(dashboard)/[leagueID]/activity/ActivityTable";
import { GW1Table, GW1Standing } from "@/app/(dashboard)/[leagueID]/gw1/GW1Table";
import { AlertTriangle, CheckCircle2, Loader2, X } from "lucide-react";
import { GameweekSelector } from "@/components/common/GameweekSelector";
import { LeagueSelector } from "@/components/common/LeagueSelector";
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

interface BackfillStatusResponse {
  summary: {
    queued: number;
    running: number;
    failed: number;
  };
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
const SWIPE_HINT_DISMISSED_KEY = "fpl-swipe-hint-dismissed-v1";
const MOBILE_SWIPE_MIN_X_LEFT = 48;
const MOBILE_SWIPE_MIN_X_RIGHT = 54;
const MOBILE_SWIPE_MIN_X_FAST = 28;
const MOBILE_SWIPE_MAX_Y = 80;
const MOBILE_SWIPE_LOCK_X = 8;
const MOBILE_SWIPE_MIN_VELOCITY = 0.5; // px/ms
const MOBILE_SWIPE_COOLDOWN_MS = 280;

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
  const router = useRouter();
  const searchParams = useSearchParams();
  const [tab, setTab] = React.useState("league");
  const [showOrientationHint, setShowOrientationHint] = React.useState(false);
  const [showSwipeHint, setShowSwipeHint] = React.useState(false);
  const [swipeGwFeedback, setSwipeGwFeedback] = React.useState<{
    fromGw: number;
    toGw: number;
  } | null>(null);
  const swipeRef = React.useRef<{
    startX: number;
    startY: number;
    startTs: number;
    horizontalLocked: boolean;
    valid: boolean;
  } | null>(null);
  const isSwipeNavigatingRef = React.useRef(false);
  const lastSwipeNavigateAtRef = React.useRef(0);
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
  const { data: backfillStatus, mutate: mutateBackfillStatus } = useSWR<BackfillStatusResponse>(
    "/api/user/backfill-status",
    fetcher,
    {
      refreshInterval: (latestData) => {
        const queued = latestData?.summary.queued ?? 0;
        const running = latestData?.summary.running ?? 0;
        return queued + running > 0 ? 2500 : 0;
      },
      revalidateOnFocus: true,
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
  const queuedJobs = backfillStatus?.summary.queued ?? 0;
  const runningJobs = backfillStatus?.summary.running ?? 0;
  const failedJobs = backfillStatus?.summary.failed ?? 0;
  const hasActiveBackfillJobs = queuedJobs + runningJobs > 0;
  const [showBackfillSuccess, setShowBackfillSuccess] = React.useState(false);
  const [isRetryingBackfill, setIsRetryingBackfill] = React.useState(false);
  const previousHasActiveBackfillJobsRef = React.useRef(false);

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

  React.useEffect(() => {
    if (typeof window === "undefined") return;

    const evaluateSwipeHintVisibility = () => {
      const isMobileViewport = window.matchMedia("(max-width: 639px)").matches;
      const dismissed = window.localStorage.getItem(SWIPE_HINT_DISMISSED_KEY) === "1";
      setShowSwipeHint(isMobileViewport && !dismissed);
    };

    evaluateSwipeHintVisibility();
    window.addEventListener("resize", evaluateSwipeHintVisibility);
    return () => {
      window.removeEventListener("resize", evaluateSwipeHintVisibility);
    };
  }, []);

  const dismissOrientationHint = React.useCallback(() => {
    if (typeof window !== "undefined") {
      window.localStorage.setItem(ORIENTATION_HINT_DISMISSED_KEY, "1");
    }
    setShowOrientationHint(false);
  }, []);

  const dismissSwipeHint = React.useCallback(() => {
    if (typeof window !== "undefined") {
      window.localStorage.setItem(SWIPE_HINT_DISMISSED_KEY, "1");
    }
    setShowSwipeHint(false);
  }, []);

  React.useEffect(() => {
    if (!swipeGwFeedback) return;
    const timer = window.setTimeout(() => {
      setSwipeGwFeedback(null);
    }, 1200);
    return () => window.clearTimeout(timer);
  }, [swipeGwFeedback]);

  React.useEffect(() => {
    const hadActiveJobs = previousHasActiveBackfillJobsRef.current;
    if (hadActiveJobs && !hasActiveBackfillJobs && failedJobs === 0) {
      setShowBackfillSuccess(true);
      const refreshGws = new Set<number>([currentGw, gw]);
      const refreshKeys: string[] = [];
      for (const refreshGw of refreshGws) {
        refreshKeys.push(
          `/api/league?leagueId=${selectedLeagueId}&gw=${refreshGw}&currentGw=${currentGw}`,
          `/api/activity-impact?leagueId=${selectedLeagueId}&gw=${refreshGw}&currentGw=${currentGw}`,
          `/api/gw1-table?leagueId=${selectedLeagueId}&gw=${refreshGw}&currentGw=${currentGw}`,
          `/api/transfers?leagueId=${selectedLeagueId}&gw=${refreshGw}&currentGw=${currentGw}`,
          `/api/chips?leagueId=${selectedLeagueId}&gw=${refreshGw}&currentGw=${currentGw}`,
          `/api/stats-trend?leagueId=${selectedLeagueId}&gw=${refreshGw}&window=8`
        );
      }
      void Promise.allSettled(refreshKeys.map((key) => mutate(key)));
    }
    if (hasActiveBackfillJobs || failedJobs > 0) {
      setShowBackfillSuccess(false);
    }
    previousHasActiveBackfillJobsRef.current = hasActiveBackfillJobs;
  }, [currentGw, failedJobs, gw, hasActiveBackfillJobs, mutate, selectedLeagueId]);

  React.useEffect(() => {
    if (!showBackfillSuccess) return;
    const timeout = window.setTimeout(() => {
      setShowBackfillSuccess(false);
    }, 3500);
    return () => window.clearTimeout(timeout);
  }, [showBackfillSuccess]);

  const handleRetryBackfill = React.useCallback(async () => {
    if (isRetryingBackfill) return;
    setIsRetryingBackfill(true);
    try {
      await fetch("/api/user/backfill-retry", {
        method: "POST",
      });
    } finally {
      setIsRetryingBackfill(false);
      void mutateBackfillStatus();
    }
  }, [isRetryingBackfill, mutateBackfillStatus]);

  const navigateToGw = React.useCallback(
    (targetGw: number, source: "swipe" | "other" = "other") => {
      const clampedTargetGw = Math.max(1, Math.min(maxGw, targetGw));
      if (clampedTargetGw === gw) return;
      const now = Date.now();
      if (source === "swipe" && now - lastSwipeNavigateAtRef.current < MOBILE_SWIPE_COOLDOWN_MS) {
        return;
      }
      if (isSwipeNavigatingRef.current) return;
      isSwipeNavigatingRef.current = true;
      if (source === "swipe") {
        lastSwipeNavigateAtRef.current = now;
        setSwipeGwFeedback({ fromGw: gw, toGw: clampedTargetGw });
        if (typeof navigator !== "undefined" && typeof navigator.vibrate === "function") {
          navigator.vibrate(10);
        }
      }

      const currentParams =
        typeof window !== "undefined"
          ? new URLSearchParams(window.location.search)
          : new URLSearchParams(searchParams.toString());
      const currentScrollY = typeof window !== "undefined" ? window.scrollY : 0;
      const params = new URLSearchParams(currentParams.toString());
      params.set("gw", String(clampedTargetGw));
      params.set("leagueId", String(selectedLeagueId));
      router.push(`/dashboard?${params.toString()}`, { scroll: false });

      if (typeof window !== "undefined") {
        // iOS/Safari can still jump despite scroll:false, so force-restore a few frames.
        let attempts = 0;
        const restoreScroll = () => {
          window.scrollTo({ top: currentScrollY, left: 0, behavior: "auto" });
          attempts += 1;
          if (attempts < 6) {
            window.requestAnimationFrame(restoreScroll);
          } else {
            isSwipeNavigatingRef.current = false;
          }
        };
        window.requestAnimationFrame(restoreScroll);
      } else {
        isSwipeNavigatingRef.current = false;
      }
    },
    [gw, maxGw, router, searchParams, selectedLeagueId]
  );

  const isSwipeEligibleTarget = React.useCallback((target: EventTarget | null) => {
    const element = target instanceof HTMLElement ? target : null;
    if (!element) return false;
    return !element.closest(
      'button, a, input, select, textarea, [role="button"], [role="menuitem"], [data-radix-select-trigger]'
    );
  }, []);

  const handleMobileSwipeStart = React.useCallback(
    (event: React.TouchEvent<HTMLElement>) => {
      if (window.matchMedia("(min-width: 640px)").matches) return;
      if (event.touches.length !== 1) return;
      if (!isSwipeEligibleTarget(event.target)) return;
      const touch = event.touches[0];
      swipeRef.current = {
        startX: touch.clientX,
        startY: touch.clientY,
        startTs: Date.now(),
        horizontalLocked: false,
        valid: true,
      };
    },
    [isSwipeEligibleTarget]
  );

  const handleMobileSwipeMove = React.useCallback((event: React.TouchEvent<HTMLElement>) => {
    if (window.matchMedia("(min-width: 640px)").matches) return;
    const state = swipeRef.current;
    if (!state || !state.valid || event.touches.length !== 1) return;

    const touch = event.touches[0];
    const deltaX = touch.clientX - state.startX;
    const deltaY = touch.clientY - state.startY;
    const absX = Math.abs(deltaX);
    const absY = Math.abs(deltaY);

    if (!state.horizontalLocked && absX >= MOBILE_SWIPE_LOCK_X && absX > absY) {
      state.horizontalLocked = true;
    }

    if (state.horizontalLocked && absX > absY) {
      // Keep vertical scroll from stealing the gesture once horizontal intent is clear.
      event.preventDefault();
    }

    if (absY > MOBILE_SWIPE_MAX_Y && absY > absX) {
      state.valid = false;
    }
  }, []);

  const handleMobileSwipeEnd = React.useCallback(
    (event: React.TouchEvent<HTMLElement>) => {
      if (window.matchMedia("(min-width: 640px)").matches) return;
      const state = swipeRef.current;
      swipeRef.current = null;
      if (!state || !state.valid) return;

      const touch = event.changedTouches[0];
      const deltaX = touch.clientX - state.startX;
      const deltaY = touch.clientY - state.startY;
      const duration = Date.now() - state.startTs;
      const absX = Math.abs(deltaX);
      const absY = Math.abs(deltaY);
      const velocityX = duration > 0 ? absX / duration : 0;

      if (!state.horizontalLocked) return;
      if (absY > MOBILE_SWIPE_MAX_Y) return;
      if (absX <= absY * 1.1) return;

      const minimumDistance = deltaX < 0 ? MOBILE_SWIPE_MIN_X_LEFT : MOBILE_SWIPE_MIN_X_RIGHT;
      const hasDistanceSwipe = absX >= minimumDistance;
      const hasFastSwipe =
        absX >= MOBILE_SWIPE_MIN_X_FAST && velocityX >= MOBILE_SWIPE_MIN_VELOCITY;
      if (!hasDistanceSwipe && !hasFastSwipe) return;

      if (deltaX < 0 && gw < maxGw) {
        navigateToGw(gw + 1, "swipe");
      } else if (deltaX > 0 && gw > 1) {
        navigateToGw(gw - 1, "swipe");
      }
    },
    [gw, maxGw, navigateToGw]
  );

  const handleMobileSwipeCancel = React.useCallback(() => {
    swipeRef.current = null;
  }, []);

  return (
    <div className="mobile-landscape-scroll-shell flex min-h-svh flex-col sm:h-svh sm:min-h-svh sm:overflow-hidden">
      {/* Header with selectors */}
      <header className="px-4 pt-0 pb-0 sm:border-b sm:border-border sm:px-4 sm:pt-0 md:px-5">
        <div className="flex flex-col gap-0">
          {/* Top row: Brand + controls */}
          <div className="flex h-[72px] w-full items-center justify-between gap-3">
            <Link href="/" className="flex items-center gap-3 transition-opacity hover:opacity-90">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src="/logo-light.svg"
                alt="GameweekIQ logo"
                className="h-8 w-8 object-contain dark:hidden"
              />
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src="/logo-dark.svg"
                alt="GameweekIQ logo"
                className="hidden h-8 w-8 object-contain dark:block"
              />
              <span className="text-base font-medium tracking-tight">GameweekIQ</span>
            </Link>

            <div className="sm:hidden">
              <AccountMenu
                className="h-8 w-8 shrink-0"
                selectedLeagueId={selectedLeagueId}
                selectedLeagueName={selectedLeague?.name ?? `League ${selectedLeagueId}`}
                currentGw={currentGw}
              />
            </div>

            <div className="hidden items-center gap-2 sm:flex">
              {hasActiveBackfillJobs ? (
                <div className="inline-flex h-8 items-center gap-2 rounded-md border border-amber-500/40 bg-amber-500/10 px-3 text-xs font-medium text-amber-700 dark:text-amber-300">
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  <span>Updating league data</span>
                </div>
              ) : null}
              {!hasActiveBackfillJobs && failedJobs > 0 ? (
                <button
                  type="button"
                  onClick={handleRetryBackfill}
                  disabled={isRetryingBackfill}
                  className="inline-flex h-8 items-center gap-2 rounded-md border border-red-500/40 bg-red-500/10 px-3 text-xs font-medium text-red-700 transition-colors hover:bg-red-500/15 disabled:cursor-not-allowed disabled:opacity-70 dark:text-red-300"
                >
                  <AlertTriangle className="h-3.5 w-3.5" />
                  <span>Failed to update league data. Click to retry.</span>
                </button>
              ) : null}
              {!hasActiveBackfillJobs && failedJobs === 0 && showBackfillSuccess ? (
                <div className="inline-flex h-8 items-center gap-2 rounded-md border border-green-500/40 bg-green-500/10 px-3 text-xs font-medium text-green-700 dark:text-green-300">
                  <CheckCircle2 className="h-3.5 w-3.5" />
                  <span>League data updated successfully</span>
                </div>
              ) : null}
              <LeagueSelector
                leagues={leagues}
                selectedLeagueId={selectedLeagueId}
                currentGw={currentGw}
                className="w-[240px] !h-8 text-sm"
              />
              <AccountMenu
                className="h-8 w-8 shrink-0"
                selectedLeagueId={selectedLeagueId}
                selectedLeagueName={selectedLeague?.name ?? `League ${selectedLeagueId}`}
                currentGw={currentGw}
              />
            </div>
          </div>

          <div className="-mx-4 border-b border-border sm:hidden md:-mx-5" />

          {/* Mobile row: League selector + GW selector */}
          <div className="w-full pb-0 pt-4 sm:hidden">
            <div className="flex w-full items-center gap-2">
              <LeagueSelector
                leagues={leagues}
                selectedLeagueId={selectedLeagueId}
                currentGw={currentGw}
                className="min-w-0 flex-1 !h-8 [@media(orientation:portrait)]:!h-12 text-sm"
              />
              <div className="ml-auto w-[96px] shrink-0">
                <GameweekSelector
                  selectedLeagueId={selectedLeagueId}
                  currentGw={currentGw}
                  maxGw={maxGw}
                  showArrows={false}
                  className="!h-8 [@media(orientation:portrait)]:!h-12 w-full text-sm"
                />
              </div>
            </div>
            {hasActiveBackfillJobs ? (
              <div className="mt-2 inline-flex h-8 w-full items-center gap-2 rounded-md border border-amber-500/40 bg-amber-500/10 px-3 text-xs font-medium text-amber-700 dark:text-amber-300">
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                <span>Updating league data</span>
              </div>
            ) : null}
            {!hasActiveBackfillJobs && failedJobs > 0 ? (
              <button
                type="button"
                onClick={handleRetryBackfill}
                disabled={isRetryingBackfill}
                className="mt-2 inline-flex h-8 w-full items-center gap-2 rounded-md border border-red-500/40 bg-red-500/10 px-3 text-left text-xs font-medium text-red-700 transition-colors hover:bg-red-500/15 disabled:cursor-not-allowed disabled:opacity-70 dark:text-red-300"
              >
                <AlertTriangle className="h-3.5 w-3.5" />
                <span>Failed to update league data. Click to retry.</span>
              </button>
            ) : null}
            {!hasActiveBackfillJobs && failedJobs === 0 && showBackfillSuccess ? (
              <div className="mt-2 inline-flex h-8 w-full items-center gap-2 rounded-md border border-green-500/40 bg-green-500/10 px-3 text-xs font-medium text-green-700 dark:text-green-300">
                <CheckCircle2 className="h-3.5 w-3.5" />
                <span>League data updated successfully</span>
              </div>
            ) : null}
            <div className="w-full">
              {showSwipeHint ? (
                <div className="mt-2 flex items-center justify-between gap-2 rounded-md border border-border bg-muted/40 px-3 py-2 text-xs text-muted-foreground">
                  <span>Swipe left/right to change GW.</span>
                  <button
                    type="button"
                    onClick={dismissSwipeHint}
                    aria-label="Dismiss swipe hint"
                    className="rounded-sm p-0.5 text-muted-foreground hover:text-foreground"
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                </div>
              ) : null}
            </div>
          </div>
        </div>
      </header>

      {swipeGwFeedback ? (
        <div className="pointer-events-none fixed inset-0 z-50 flex items-center justify-center sm:hidden">
          <div className="rounded-xl border border-border/60 bg-background/60 px-5 py-4 text-2xl font-semibold tracking-tight shadow-2xl backdrop-blur-md">
            GW {swipeGwFeedback.fromGw} → {swipeGwFeedback.toGw}
          </div>
        </div>
      ) : null}

      {/* Main content */}
      <main
        className="mobile-landscape-scroll-main touch-pan-y flex flex-1 min-h-0 flex-col gap-4 p-4 sm:gap-6 sm:overflow-hidden sm:p-4 md:p-5"
        onTouchStart={handleMobileSwipeStart}
        onTouchMove={handleMobileSwipeMove}
        onTouchEnd={handleMobileSwipeEnd}
        onTouchCancel={handleMobileSwipeCancel}
      >
        {/* Stats cards */}
        <LeagueStatsCards
          stats={stats}
          standings={standings}
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
              <SelectItem value="gw1">GW 1 Table</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* ✅ Desktop tabs + gameweek row */}
        <div className="hidden w-full items-center justify-between sm:flex">
          <Tabs value={tab} onValueChange={setTab}>
            <TabsList>
              <TabsTrigger value="league" type="button" className="px-3 sm:px-4">
                League Table
              </TabsTrigger>
              <TabsTrigger value="activity" type="button" className="px-3 sm:px-4">
                Manager Influence
              </TabsTrigger>
              <TabsTrigger value="gw1" type="button" className="px-3 sm:px-4">
                GW 1 Table
              </TabsTrigger>
            </TabsList>
          </Tabs>
          <GameweekSelector
            selectedLeagueId={selectedLeagueId}
            currentGw={currentGw}
            maxGw={maxGw}
            className="!h-12 sm:text-sm"
          />
        </div>

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
