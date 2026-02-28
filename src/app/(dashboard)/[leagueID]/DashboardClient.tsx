"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import useSWR, { useSWRConfig } from "swr";
import { LeagueStatsCards } from "@/app/(dashboard)/[leagueID]/stats/StatsCards";
import { LeagueTable } from "@/app/(dashboard)/[leagueID]/league/LeagueTable";
import { ActivityTab } from "@/app/(dashboard)/[leagueID]/activity/ActivityTable";
import { GW1Table, GW1Standing } from "@/app/(dashboard)/[leagueID]/gw1/GW1Table";
import {
  AlertTriangle,
  CheckCircle2,
  Coins,
  Loader2,
  Menu,
  PanelLeftClose,
  PanelLeftOpen,
  RefreshCw,
  Table2,
  X,
} from "lucide-react";
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
import { cn } from "@/lib/utils";
import {
  LEAGUEIQ_VIEW_BY_KEY,
  LeagueIQView,
} from "@/lib/leagueiqRoutes";
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
}

const LIVE_POLL_LOCK_KEY = "fpl-live-refresh-lock";
const LIVE_POLL_LOCK_TTL_MS = 45_000;
const LIVE_REFRESH_INTERVAL_MS = 30_000;
const ORIENTATION_HINT_DISMISSED_KEY = "fpl-orientation-hint-dismissed-v2";
const SWIPE_HINT_DISMISSED_KEY = "fpl-swipe-hint-dismissed-v1";
const SIDEBAR_COLLAPSED_KEY = "gameweekiq-appshell-sidebar-collapsed-v1";
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
}: DashboardClientProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [showOrientationHint, setShowOrientationHint] = React.useState(false);
  const [showSwipeHint, setShowSwipeHint] = React.useState(false);
  const [swipeGwFeedback, setSwipeGwFeedback] = React.useState<{
    fromGw: number;
    toGw: number;
  } | null>(null);
  const [tab, setTab] = React.useState<"league" | "activity" | "gw1">("league");
  const [sidebarCollapsed, setSidebarCollapsed] = React.useState(false);
  const [mobileSidebarOpen, setMobileSidebarOpen] = React.useState(false);
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
        icon: RefreshCw,
        active: false,
        placeholder: true,
      },
      {
        key: "chips",
        label: "Chips",
        icon: Coins,
        active: false,
        placeholder: true,
      },
    ],
    [activeView, sidebarQueryString]
  );

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

  React.useEffect(() => {
    if (typeof window === "undefined") return;
    const persisted = window.localStorage.getItem(SIDEBAR_COLLAPSED_KEY);
    if (persisted === "1") {
      setSidebarCollapsed(true);
    }
  }, []);

  React.useEffect(() => {
    if (typeof window === "undefined") return;
    window.localStorage.setItem(SIDEBAR_COLLAPSED_KEY, sidebarCollapsed ? "1" : "0");
  }, [sidebarCollapsed]);

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
  }, [gw, selectedLeagueId]);

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

  return (
    <div className="flex min-h-svh bg-background text-foreground">
      <aside
        className={cn(
          "hidden border-r border-border bg-muted/20 sm:flex sm:flex-col sm:transition-[width] sm:duration-200",
          sidebarCollapsed ? "sm:w-16" : "sm:w-64"
        )}
      >
        <div
          className={cn(
            "flex h-16 items-center border-b border-border",
            sidebarCollapsed ? "justify-center" : "justify-between gap-2",
            sidebarCollapsed ? "px-2" : "px-3"
          )}
        >
          {!sidebarCollapsed ? (
            <Link href="/" className="flex items-center gap-2 overflow-hidden">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src="/logo-light.svg" alt="GameweekIQ logo" className="h-7 w-7 object-contain dark:hidden" />
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src="/logo-dark.svg" alt="GameweekIQ logo" className="hidden h-7 w-7 object-contain dark:block" />
              <span className="text-sm font-medium">GameweekIQ</span>
            </Link>
          ) : null}
          <button
            type="button"
            onClick={() => setSidebarCollapsed((collapsed) => !collapsed)}
            className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-transparent bg-transparent text-muted-foreground transition-colors duration-150 hover:bg-muted/70 hover:text-foreground"
            aria-label={sidebarCollapsed ? "Expand sidebar" : "Collapse sidebar"}
          >
            {sidebarCollapsed ? <PanelLeftOpen className="h-4 w-4" /> : <PanelLeftClose className="h-4 w-4" />}
          </button>
        </div>

        <div className={cn("mt-4", sidebarCollapsed ? "px-2" : "px-3")}>
          {!sidebarCollapsed ? (
            <p className="px-2 pb-1 text-[11px] font-medium tracking-wide text-muted-foreground">
              LeagueIQ
            </p>
          ) : null}
        </div>

        <nav className={cn("mt-1 flex flex-col gap-1", sidebarCollapsed ? "px-2" : "px-3")}>
          {leagueIQSidebarItems.map((item) => {
            const Icon = item.icon;
            const itemClasses = cn(
              "inline-flex h-8 items-center gap-2 rounded-md px-2 text-sm transition-colors duration-150",
              item.active
                ? "bg-muted/70 text-foreground"
                : "text-muted-foreground hover:bg-muted/70 hover:text-foreground",
              sidebarCollapsed && "mx-auto w-8 justify-center px-0",
              item.placeholder && "cursor-default"
            );

            if (item.placeholder) {
              return (
                <div key={item.key} className={itemClasses} aria-disabled="true">
                  <Icon className="h-4 w-4 shrink-0" />
                  {!sidebarCollapsed ? <span>{item.label}</span> : null}
                </div>
              );
            }

            return (
              <Link
                key={item.key}
                href={item.href}
                className={itemClasses}
              >
                <Icon className="h-4 w-4 shrink-0" />
                {!sidebarCollapsed ? <span>{item.label}</span> : null}
              </Link>
            );
          })}
        </nav>

        <div
          className={cn(
            "mt-1 flex flex-1 flex-col gap-3 overflow-y-auto",
            sidebarCollapsed ? "px-2" : "px-3"
          )}
        >
          {hasActiveBackfillJobs ? (
            <div className={cn("rounded-md border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-xs font-medium text-amber-700 dark:text-amber-300", sidebarCollapsed && "px-2 text-center") }>
              <div className={cn("inline-flex items-center gap-2", sidebarCollapsed && "justify-center") }>
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                {!sidebarCollapsed ? <span>Updating league data</span> : null}
              </div>
            </div>
          ) : null}

          {!hasActiveBackfillJobs && failedJobs > 0 ? (
            <button
              type="button"
              onClick={handleRetryBackfill}
              disabled={isRetryingBackfill}
              className={cn(
                "inline-flex items-center gap-2 rounded-md border border-red-500/40 bg-red-500/10 px-3 py-2 text-left text-xs font-medium text-red-700 transition-colors hover:bg-red-500/15 disabled:cursor-not-allowed disabled:opacity-70 dark:text-red-300",
                sidebarCollapsed && "justify-center px-2"
              )}
            >
              <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
              {!sidebarCollapsed ? <span>Failed to update league data. Retry.</span> : null}
            </button>
          ) : null}

          {!hasActiveBackfillJobs && failedJobs === 0 && showBackfillSuccess ? (
            <div className={cn("inline-flex items-center gap-2 rounded-md border border-green-500/40 bg-green-500/10 px-3 py-2 text-xs font-medium text-green-700 dark:text-green-300", sidebarCollapsed && "justify-center px-2") }>
              <CheckCircle2 className="h-3.5 w-3.5" />
              {!sidebarCollapsed ? <span>League data updated</span> : null}
            </div>
          ) : null}
        </div>

        <div className={cn("pb-3", sidebarCollapsed ? "px-2" : "px-3")} data-sidebar-interactive="true">
          <AccountMenu
            className={cn("h-9", sidebarCollapsed ? "mx-auto w-9" : "w-full justify-start")}
            selectedLeagueId={selectedLeagueId}
            selectedLeagueName={selectedLeague?.name ?? `League ${selectedLeagueId}`}
            currentGw={currentGw}
          />
        </div>
      </aside>

      {mobileSidebarOpen ? (
        <>
          <button
            type="button"
            className="fixed inset-0 z-40 bg-background/70 sm:hidden"
            onClick={() => setMobileSidebarOpen(false)}
            aria-label="Close sidebar"
          />
          <aside className="fixed inset-y-0 left-0 z-50 flex w-[86vw] max-w-[320px] flex-col gap-4 border-r border-border bg-background px-4 py-4 shadow-2xl sm:hidden">
            <div className="mx-[-16px] flex h-16 items-center justify-between border-b border-border px-4">
              <Link href="/" className="flex items-center gap-2">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src="/logo-light.svg" alt="GameweekIQ logo" className="h-7 w-7 object-contain dark:hidden" />
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src="/logo-dark.svg" alt="GameweekIQ logo" className="hidden h-7 w-7 object-contain dark:block" />
                <span className="text-sm font-medium">GameweekIQ</span>
              </Link>
              <button
                type="button"
                onClick={() => setMobileSidebarOpen(false)}
                className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-border"
                aria-label="Close sidebar"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div>
              <p className="pb-1 text-[11px] font-medium text-muted-foreground">
                LeagueIQ
              </p>
            </div>

            <nav className="flex flex-col gap-1">
              {leagueIQSidebarItems.map((item) => {
                const Icon = item.icon;
                const itemClasses = cn(
                  "inline-flex h-8 items-center rounded-md px-3 text-sm transition-colors duration-150",
                  item.active
                    ? "bg-muted/70 text-foreground"
                    : "text-muted-foreground hover:bg-muted/70 hover:text-foreground",
                  item.placeholder && "cursor-default"
                );

                if (item.placeholder) {
                  return (
                    <div key={item.key} className={itemClasses} aria-disabled="true">
                      <Icon className="mr-2 h-4 w-4 shrink-0" />
                      {item.label}
                    </div>
                  );
                }

                return (
                  <Link
                    key={item.key}
                    href={item.href}
                    className={itemClasses}
                  >
                    <Icon className="mr-2 h-4 w-4 shrink-0" />
                    {item.label}
                  </Link>
                );
              })}
            </nav>

            <GameweekSelector
              selectedLeagueId={selectedLeagueId}
              currentGw={currentGw}
              maxGw={maxGw}
              showArrows={false}
              size="sm"
              className="h-10 w-full text-sm"
            />

            {hasActiveBackfillJobs ? (
              <div className="inline-flex items-center gap-2 rounded-md border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-xs font-medium text-amber-700 dark:text-amber-300">
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                <span>Updating league data</span>
              </div>
            ) : null}

            {!hasActiveBackfillJobs && failedJobs > 0 ? (
              <button
                type="button"
                onClick={handleRetryBackfill}
                disabled={isRetryingBackfill}
                className="inline-flex items-center gap-2 rounded-md border border-red-500/40 bg-red-500/10 px-3 py-2 text-left text-xs font-medium text-red-700 transition-colors hover:bg-red-500/15 disabled:cursor-not-allowed disabled:opacity-70 dark:text-red-300"
              >
                <AlertTriangle className="h-3.5 w-3.5" />
                <span>Failed to update league data. Retry.</span>
              </button>
            ) : null}

            {!hasActiveBackfillJobs && failedJobs === 0 && showBackfillSuccess ? (
              <div className="inline-flex items-center gap-2 rounded-md border border-green-500/40 bg-green-500/10 px-3 py-2 text-xs font-medium text-green-700 dark:text-green-300">
                <CheckCircle2 className="h-3.5 w-3.5" />
                <span>League data updated</span>
              </div>
            ) : null}

            <div className="mt-auto" data-sidebar-interactive="true">
              <AccountMenu
                className="h-10 w-full"
                selectedLeagueId={selectedLeagueId}
                selectedLeagueName={selectedLeague?.name ?? `League ${selectedLeagueId}`}
                currentGw={currentGw}
              />
            </div>
          </aside>
        </>
      ) : null}

      <div className="mobile-landscape-scroll-shell flex min-h-svh flex-1 flex-col">
        <header className="sticky top-0 z-30 flex h-16 items-center justify-between border-b border-border bg-background/95 px-3 backdrop-blur sm:px-4">
          <div className="flex min-w-0 items-center gap-2">
            <button
              type="button"
              onClick={() => setMobileSidebarOpen(true)}
              className="inline-flex h-9 w-9 items-center justify-center rounded-md border border-border sm:hidden"
              aria-label="Open sidebar"
            >
              <Menu className="h-4 w-4" />
            </button>
            <h1 className="text-base font-semibold tracking-tight sm:text-lg">
              {LEAGUEIQ_VIEW_BY_KEY.tables.label}
            </h1>
          </div>
          <LeagueSelector
            leagues={leagues}
            selectedLeagueId={selectedLeagueId}
            currentGw={currentGw}
            className="h-8 w-[170px] sm:w-[220px] text-sm"
          />
        </header>

        {swipeGwFeedback ? (
          <div className="pointer-events-none fixed inset-0 z-50 flex items-center justify-center sm:hidden">
            <div className="rounded-xl border border-border/60 bg-background/60 px-5 py-4 text-2xl font-semibold tracking-tight shadow-2xl backdrop-blur-md">
              GW {swipeGwFeedback.fromGw} → {swipeGwFeedback.toGw}
            </div>
          </div>
        ) : null}

        <main
          className="mobile-landscape-scroll-main touch-pan-y flex flex-1 min-h-0 flex-col gap-4 p-4 sm:gap-4 sm:overflow-hidden sm:p-4 md:p-4"
          onTouchStart={handleMobileSwipeStart}
          onTouchMove={handleMobileSwipeMove}
          onTouchEnd={handleMobileSwipeEnd}
          onTouchCancel={handleMobileSwipeCancel}
        >
          <LeagueStatsCards
            stats={stats}
            standings={standings}
            leagueId={selectedLeagueId}
            gw={gw}
            currentGw={currentGw}
            isLoading={isLeagueDataLoading}
            hasError={Boolean(error)}
          />

          <div className="block w-full sm:hidden">
            <Select value={tab} onValueChange={(value) => setTab(value as "league" | "activity" | "gw1")}>
              <SelectTrigger className="w-full !h-12 text-base">
                <SelectValue placeholder="Select table" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="league">League</SelectItem>
                <SelectItem value="activity">ManagerIQ</SelectItem>
                <SelectItem value="gw1">GW 1 Team</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="hidden w-full items-center justify-between gap-3 sm:flex">
            <Tabs value={tab} onValueChange={(value) => setTab(value as "league" | "activity" | "gw1")}>
              <TabsList className="h-8 p-[2px]">
                <TabsTrigger value="league" type="button" className="px-3 sm:px-4">
                  League
                </TabsTrigger>
                <TabsTrigger value="activity" type="button" className="px-3 sm:px-4">
                  ManagerIQ
                </TabsTrigger>
                <TabsTrigger value="gw1" type="button" className="px-3 sm:px-4">
                  GW 1 Team
                </TabsTrigger>
              </TabsList>
            </Tabs>
            <GameweekSelector
              selectedLeagueId={selectedLeagueId}
              currentGw={currentGw}
              maxGw={maxGw}
              size="sm"
              className="h-8 text-sm"
            />
          </div>

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

          <div className="flex w-full min-h-0 flex-1 flex-col">
            {tab === "league" ? (
              <div className="min-h-0 flex-1">
                <LeagueTable
                  standings={standings}
                  isLoading={isLeagueDataLoading}
                  hasError={Boolean(error)}
                />
              </div>
            ) : null}

            {tab === "activity" ? (
              <div className="min-h-0 flex-1">
                <ActivityTab leagueId={selectedLeagueId} currentGw={currentGw} />
              </div>
            ) : null}

            {tab === "gw1" ? (
              <div className="min-h-0 flex-1">
                <GW1Table
                  standings={gw1Standings}
                  isLoading={!gw1Data && !gw1Error}
                  hasError={Boolean(gw1Error)}
                />
              </div>
            ) : null}
          </div>
        </main>
      </div>
    </div>
  );
}
