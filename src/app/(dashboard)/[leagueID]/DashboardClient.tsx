"use client";

import * as React from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import useSWR, { useSWRConfig } from "swr";
import { LeagueStatsCards } from "@/app/(dashboard)/[leagueID]/stats/StatsCards";
import { LeagueTable } from "@/app/(dashboard)/[leagueID]/league/LeagueTable";
import { ActivityTab } from "@/app/(dashboard)/[leagueID]/activity/ActivityTable";
import { GW1Table, GW1Standing } from "@/app/(dashboard)/[leagueID]/gw1/GW1Table";
import {
  AlertTriangle,
  CheckCircle2,
  CircleGauge,
  Coins,
  Loader2,
  RefreshCw,
  Table2,
  X,
} from "lucide-react";
import { GameweekSelector } from "@/components/common/GameweekSelector";
import { LeagueSelector } from "@/components/common/LeagueSelector";
import {
  AppShell,
  useAppShellNavigation,
} from "@/components/common/AppShell";
import type { AppSidebarSection } from "@/components/common/AppSidebar";
import { DashboardTabRow, type DashboardTabOption } from "@/components/common/DashboardTabRow";
import {
  LEAGUEIQ_VIEW_BY_KEY,
  LeagueIQView,
} from "@/lib/leagueiqRoutes";
import { cn } from "@/lib/utils";
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
  activeView: LeagueIQView;
  isAdmin: boolean;
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
const MOBILE_SWIPE_MIN_VELOCITY = 0.5;
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
  activeView,
  isAdmin,
}: DashboardClientProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const { useDrawerNav, mobileSidebarOpen, setMobileSidebarOpen } = useAppShellNavigation();
  const [showOrientationHint, setShowOrientationHint] = React.useState(false);
  const [showSwipeHint, setShowSwipeHint] = React.useState(false);
  const [isPortraitOrientation, setIsPortraitOrientation] = React.useState(false);
  const [swipeGwFeedback, setSwipeGwFeedback] = React.useState<{
    fromGw: number;
    toGw: number;
  } | null>(null);
  const [tab, setTab] = React.useState<"league" | "activity" | "gw1">("league");
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
  const activeTabKey = tab;
  const currentPath = pathname || LEAGUEIQ_VIEW_BY_KEY.tables.path;

  const selectedLeague = leagues.find((l) => l.id === selectedLeagueId);
  const hasPreloadedCurrentGwData =
    gw === currentGw && !!selectedLeague?.standings && selectedLeague.standings.length > 0;

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

  const standings = Array.isArray(data?.standings) ? data.standings : [];
  const { data: gw1Data, error: gw1Error } = useSWR<GW1TableResponse>(
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

  const sidebarQueryString = React.useMemo(() => {
    const params = new URLSearchParams(searchParams.toString());
    params.set("leagueId", String(selectedLeagueId));
    params.set("gw", String(gw));
    return params.toString();
  }, [gw, searchParams, selectedLeagueId]);

  const leagueIQSidebarItems = React.useMemo(
    () => [
      {
        key: "tables",
        label: "Tables",
        href: `${LEAGUEIQ_VIEW_BY_KEY.tables.path}?${sidebarQueryString}`,
        icon: Table2,
        active: activeView === "tables",
        placeholder: false,
      },
      {
        key: "transfers",
        label: "Transfers",
        href: "#",
        icon: RefreshCw,
        active: false,
        placeholder: true,
      },
      {
        key: "chips",
        label: "Chips",
        href: "#",
        icon: Coins,
        active: false,
        placeholder: true,
      },
    ],
    [activeView, sidebarQueryString]
  );
  const sidebarSections = React.useMemo<AppSidebarSection[]>(() => {
    return [
      {
        key: "leagueiq",
        label: "LeagueIQ",
        items: leagueIQSidebarItems,
      },
    ];
  }, [leagueIQSidebarItems]);

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
        prefetchedKeysRef.current.delete(key);
      }
    },
    [mutate]
  );

  React.useEffect(() => {
    const keysToPrefetch = new Set<string>();
    const immutableGwLookback = 2;

    keysToPrefetch.add(
      `/api/activity-impact?leagueId=${selectedLeagueId}&gw=${currentGw}&currentGw=${currentGw}`
    );
    keysToPrefetch.add(`/api/stats-trend?leagueId=${selectedLeagueId}&gw=${gw}&window=8`);

    if (activeTabKey !== "activity") {
      keysToPrefetch.add(
        `/api/activity-impact?leagueId=${selectedLeagueId}&gw=${gw}&currentGw=${currentGw}`
      );
    }
    if (activeTabKey !== "gw1") {
      keysToPrefetch.add(
        `/api/gw1-table?leagueId=${selectedLeagueId}&gw=${gw}&currentGw=${currentGw}`
      );
    }

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
  }, [activeTabKey, currentGw, gw, prefetchKey, selectedLeagueId]);

  React.useEffect(() => {
    if (gw !== currentGw) return;
    if (!isPollingLeader) return;
    if (typeof document !== "undefined" && document.visibilityState !== "visible") return;

    const refreshCurrentGw = async () => {
      await Promise.allSettled([
        mutate(`/api/league?leagueId=${selectedLeagueId}&gw=${currentGw}&currentGw=${currentGw}`),
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
      const isMobileViewport = useDrawerNav;
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
  }, [useDrawerNav]);

  React.useEffect(() => {
    if (typeof window === "undefined") return;

    const evaluateSwipeHintVisibility = () => {
      const isMobileViewport = useDrawerNav;
      const dismissed = window.localStorage.getItem(SWIPE_HINT_DISMISSED_KEY) === "1";
      setShowSwipeHint(isMobileViewport && !dismissed);
    };

    evaluateSwipeHintVisibility();
    window.addEventListener("resize", evaluateSwipeHintVisibility);
    return () => {
      window.removeEventListener("resize", evaluateSwipeHintVisibility);
    };
  }, [useDrawerNav]);

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

  React.useEffect(() => {
    setMobileSidebarOpen(false);
  }, [gw, selectedLeagueId, setMobileSidebarOpen]);

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
      router.push(`${currentPath}?${params.toString()}`, { scroll: false });

      if (typeof window !== "undefined") {
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
    [currentPath, gw, maxGw, router, searchParams, selectedLeagueId]
  );

  const isSwipeEligibleTarget = React.useCallback((target: EventTarget | null) => {
    const element = target instanceof HTMLElement ? target : null;
    if (!element) return false;
    return !element.closest(
      'button, a, input, select, textarea, [role="button"], [role="menuitem"], [data-radix-select-trigger], [data-sidebar-interactive="true"]'
    );
  }, []);

  const handleMobileSwipeStart = React.useCallback(
    (event: React.TouchEvent<HTMLElement>) => {
      if (window.matchMedia("(min-width: 640px)").matches) return;
      if (mobileSidebarOpen) return;
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
    [isSwipeEligibleTarget, mobileSidebarOpen]
  );

  const handleMobileSwipeMove = React.useCallback((event: React.TouchEvent<HTMLElement>) => {
    if (window.matchMedia("(min-width: 640px)").matches) return;
    if (mobileSidebarOpen) return;
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
      event.preventDefault();
    }

    if (absY > MOBILE_SWIPE_MAX_Y && absY > absX) {
      state.valid = false;
    }
  }, [mobileSidebarOpen]);

  const handleMobileSwipeEnd = React.useCallback(
    (event: React.TouchEvent<HTMLElement>) => {
      if (window.matchMedia("(min-width: 640px)").matches) return;
      if (mobileSidebarOpen) return;
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
      const hasFastSwipe = absX >= MOBILE_SWIPE_MIN_X_FAST && velocityX >= MOBILE_SWIPE_MIN_VELOCITY;
      if (!hasDistanceSwipe && !hasFastSwipe) return;

      if (deltaX < 0 && gw < maxGw) {
        navigateToGw(gw + 1, "swipe");
      } else if (deltaX > 0 && gw > 1) {
        navigateToGw(gw - 1, "swipe");
      }
    },
    [gw, maxGw, mobileSidebarOpen, navigateToGw]
  );

  const handleMobileSwipeCancel = React.useCallback(() => {
    swipeRef.current = null;
  }, []);
  const tabOptions = React.useMemo<DashboardTabOption[]>(
    () => [
      { value: "league", label: "League" },
      { value: "activity", label: "ManagerIQ" },
      { value: "gw1", label: "GW 1 Team" },
    ],
    []
  );
  const gameweekSelectorControl = React.useMemo(
    () => (
      <GameweekSelector
        selectedLeagueId={selectedLeagueId}
        currentGw={currentGw}
        maxGw={maxGw}
        size={useDrawerNav ? "default" : "sm"}
        className="sm:h-8 sm:text-sm"
        touchMode={useDrawerNav}
        showArrows={!(useDrawerNav && isPortraitOrientation)}
      />
    ),
    [currentGw, isPortraitOrientation, maxGw, selectedLeagueId, useDrawerNav]
  );

  React.useEffect(() => {
    if (typeof window === "undefined") return;

    const evaluateOrientation = () => {
      setIsPortraitOrientation(window.matchMedia("(orientation: portrait)").matches);
    };

    evaluateOrientation();
    window.addEventListener("resize", evaluateOrientation);
    window.addEventListener("orientationchange", evaluateOrientation);

    return () => {
      window.removeEventListener("resize", evaluateOrientation);
      window.removeEventListener("orientationchange", evaluateOrientation);
    };
  }, []);

  return (
    <AppShell
      title={LEAGUEIQ_VIEW_BY_KEY.tables.label}
      sections={sidebarSections}
      footerItem={
        isAdmin
          ? {
              key: "admin-console",
              label: "Admin Console",
              href: "/dashboard/admin",
              icon: CircleGauge,
              active: currentPath.startsWith("/dashboard/admin"),
              placeholder: false,
            }
          : undefined
      }
      useDrawerNav={useDrawerNav}
      mobileSidebarOpen={mobileSidebarOpen}
      onMobileSidebarOpenChange={setMobileSidebarOpen}
      sidebarCollapsed={false}
      mainClassName="touch-pan-y"
      mainProps={{
        onTouchStart: handleMobileSwipeStart,
        onTouchMove: handleMobileSwipeMove,
        onTouchEnd: handleMobileSwipeEnd,
        onTouchCancel: handleMobileSwipeCancel,
      }}
      headerRight={
        <>
          {hasActiveBackfillJobs ? (
            <div className="hidden sm:inline-flex h-8 items-center gap-2 rounded-md border border-amber-500/40 bg-amber-500/10 px-3 text-xs font-medium text-amber-700 dark:text-amber-300">
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
              <span>Updating league data</span>
            </div>
          ) : null}
          {!hasActiveBackfillJobs && failedJobs > 0 ? (
            <button
              type="button"
              onClick={handleRetryBackfill}
              disabled={isRetryingBackfill}
              className="hidden sm:inline-flex h-8 items-center gap-2 rounded-md border border-red-500/40 bg-red-500/10 px-3 text-left text-xs font-medium text-red-700 transition-colors hover:bg-red-500/15 disabled:cursor-not-allowed disabled:opacity-70 dark:text-red-300"
            >
              <AlertTriangle className="h-3.5 w-3.5" />
              <span>Failed to update league data. Retry.</span>
            </button>
          ) : null}
          {!hasActiveBackfillJobs && failedJobs === 0 && showBackfillSuccess ? (
            <div className="hidden sm:inline-flex h-8 items-center gap-2 rounded-md border border-green-500/40 bg-green-500/10 px-3 text-xs font-medium text-green-700 dark:text-green-300">
              <CheckCircle2 className="h-3.5 w-3.5" />
              <span>League data updated</span>
            </div>
          ) : null}
          <LeagueSelector
            leagues={leagues}
            selectedLeagueId={selectedLeagueId}
            currentGw={currentGw}
            className={cn(
              "sm:h-8 sm:w-[220px] sm:text-sm",
              useDrawerNav && isPortraitOrientation
                ? "w-[calc((100vw-3rem)/2)]"
                : "w-[170px]"
            )}
            touchMode={useDrawerNav}
          />
        </>
      }
    >
      {swipeGwFeedback ? (
        <div className="pointer-events-none fixed inset-0 z-50 flex items-center justify-center sm:hidden">
          <div className="rounded-xl border border-border/60 bg-background/60 px-5 py-4 text-2xl font-semibold tracking-tight shadow-2xl backdrop-blur-md">
            GW {swipeGwFeedback.fromGw} → {swipeGwFeedback.toGw}
          </div>
        </div>
      ) : null}

      <LeagueStatsCards
        stats={stats}
        standings={standings}
        leagueId={selectedLeagueId}
        gw={gw}
        currentGw={currentGw}
        isLoading={isLeagueDataLoading}
        hasError={Boolean(error)}
      />

      <DashboardTabRow
        value={tab}
        onValueChange={(value) => setTab(value as "league" | "activity" | "gw1")}
        options={tabOptions}
        rightSlot={gameweekSelectorControl}
        touchMode={useDrawerNav}
        mobileSplit={useDrawerNav && isPortraitOrientation}
      />

      {showSwipeHint ? (
        <div className="sm:hidden flex items-center justify-between gap-2 rounded-md border border-border bg-muted/40 px-3 py-2 text-xs text-muted-foreground">
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

      <div className="mobile-landscape-table-region-root flex w-full min-h-0 flex-1 flex-col overflow-hidden">
        {tab === "league" ? (
          <div className="mobile-landscape-table-region min-h-0 flex-1 overflow-hidden">
            <LeagueTable
              standings={standings}
              isLoading={isLeagueDataLoading}
              hasError={Boolean(error)}
            />
          </div>
        ) : null}

        {tab === "activity" ? (
          <div className="mobile-landscape-table-region min-h-0 flex-1 overflow-hidden">
            <ActivityTab leagueId={selectedLeagueId} currentGw={currentGw} />
          </div>
        ) : null}

        {tab === "gw1" ? (
          <div className="mobile-landscape-table-region min-h-0 flex-1 overflow-hidden">
            <GW1Table
              standings={gw1Standings}
              isLoading={!gw1Data && !gw1Error}
              hasError={Boolean(gw1Error)}
            />
          </div>
        ) : null}
      </div>
    </AppShell>
  );
}
