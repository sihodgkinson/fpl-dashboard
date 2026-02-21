"use client";

import * as React from "react";
import useSWR from "swr";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { EnrichedStanding } from "@/types/fpl";
import { cn } from "@/lib/utils";
import {
  Area,
  AreaChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

const fetcher = async (url: string) => {
  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(`Request failed: ${res.status}`);
  }
  return res.json();
};

interface TrendPoint {
  gw: number;
  value: number | null;
  manager: string | null;
  team: string | null;
}

interface TrendSeries {
  points: TrendPoint[];
  average: number | null;
}

interface TrendResponse {
  fromGw: number;
  toGw: number;
  window: number;
  series: {
    mostPoints: TrendSeries;
    fewestPoints: TrendSeries;
    mostBench: TrendSeries;
    fewestBench: TrendSeries;
    mostTransfers: TrendSeries;
    mostInfluence: TrendSeries;
    leastInfluence: TrendSeries;
    bestCaptainCall: TrendSeries;
    worstCaptainCall: TrendSeries;
  };
}

interface ActivityImpactRow {
  team: string;
  manager: string;
  captainImpact: number;
  gwDecisionScore: number;
}

type WidgetMode = "good" | "poor";
type WidgetKey = "points" | "influence" | "bench" | "captain";

const WIDGET_MODE_STORAGE_KEYS: Record<WidgetKey, string> = {
  points: "fpl-widget-mode-points-v1",
  influence: "fpl-widget-mode-influence-v1",
  bench: "fpl-widget-mode-bench-v1",
  captain: "fpl-widget-mode-captain-v1",
};

function useDisableChartTooltipOnTouch(): boolean {
  const [disableTooltip, setDisableTooltip] = React.useState(false);

  React.useEffect(() => {
    if (typeof window === "undefined") return;

    const media =
      typeof window.matchMedia === "function"
        ? window.matchMedia("(pointer: coarse)")
        : null;

    const update = () => {
      const hasTouch =
        typeof navigator !== "undefined" && navigator.maxTouchPoints > 0;
      const coarsePointer = media?.matches ?? false;
      setDisableTooltip(hasTouch || coarsePointer);
    };

    update();
    media?.addEventListener("change", update);
    return () => media?.removeEventListener("change", update);
  }, []);

  return disableTooltip;
}

function TrendTooltip({
  active,
  payload,
  unit,
  signedValue,
}: {
  active?: boolean;
  payload?: Array<{ payload: TrendPoint }>;
  unit?: string;
  signedValue?: boolean;
}) {
  if (!active || !payload?.[0]) return null;
  const point = payload[0].payload;
  const numericValue = typeof point.value === "number" ? point.value : null;
  const hasNumericValue = numericValue !== null;
  const formattedValue = hasNumericValue
    ? signedValue
      ? numericValue > 0
        ? `+${numericValue}`
        : String(numericValue)
      : String(numericValue)
    : "—";
  const valueClassName =
    signedValue && hasNumericValue
      ? numericValue > 0
        ? "text-green-600 dark:text-green-400"
        : numericValue < 0
          ? "text-red-600 dark:text-red-400"
          : "text-muted-foreground"
      : "text-muted-foreground";

  return (
    <div className="rounded-sm border border-border bg-popover px-2 py-1 text-xs shadow-sm">
      <p className="font-medium">GW {point.gw}</p>
      <p className={valueClassName}>
        {formattedValue}
        {!signedValue && unit ? ` ${unit}` : ""}
      </p>
      <p className="font-semibold">{point.team ?? "Unknown"}</p>
      <p className="text-muted-foreground">{point.manager ?? "Unknown manager"}</p>
    </div>
  );
}

function MiniTrendChart({
  trend,
  isLoading,
  unit,
  chartId,
  enableTooltip,
  signedTooltipValue,
}: {
  trend: TrendSeries | null | undefined;
  isLoading: boolean;
  unit?: string;
  chartId: string;
  enableTooltip: boolean;
  signedTooltipValue?: boolean;
}) {
  if (isLoading) {
    return <Skeleton className="h-16 w-full" />;
  }

  if (!trend || trend.points.length === 0) {
    return (
      <div className="h-16 flex items-center justify-center text-xs text-muted-foreground">
        No trend data
      </div>
    );
  }

  const chartData = trend.points.map((point) => ({
    ...point,
    average: trend.average,
  }));

  const gradientId = `trend-fill-${chartId}`;

  return (
    <div className="h-16 w-full text-foreground" style={{ color: "hsl(var(--foreground))" }}>
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={chartData} margin={{ top: 6, right: 4, left: 4, bottom: 0 }}>
          <defs>
            <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="currentColor" stopOpacity={0.22} />
              <stop offset="100%" stopColor="currentColor" stopOpacity={0.02} />
            </linearGradient>
          </defs>
          <XAxis dataKey="gw" hide />
          <YAxis hide domain={["auto", "auto"]} />
          {enableTooltip && (
            <Tooltip content={<TrendTooltip unit={unit} signedValue={signedTooltipValue} />} />
          )}
          <Area
            type="monotone"
            dataKey="value"
            connectNulls={false}
            stroke="currentColor"
            strokeWidth={2}
            fill={`url(#${gradientId})`}
            dot={{ r: 2.5, fill: "currentColor", stroke: "currentColor" }}
            activeDot={{ r: 4, fill: "currentColor", stroke: "currentColor" }}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}

function StatCard({
  title,
  value,
  displayValue,
  valueClassName,
  team,
  manager,
  trend,
  isTrendLoading,
  unit,
  chartId,
  enableTooltip,
  signedTooltipValue,
  mode,
  onToggleMode,
}: {
  title: string;
  value: number | null;
  displayValue?: string | null;
  valueClassName?: string;
  team: string | null;
  manager: string | null;
  trend: TrendSeries | null | undefined;
  isTrendLoading: boolean;
  unit?: string;
  chartId: string;
  enableTooltip: boolean;
  signedTooltipValue?: boolean;
  mode?: WidgetMode;
  onToggleMode?: () => void;
}) {
  const [contentVisible, setContentVisible] = React.useState(true);
  const cardTouchRef = React.useRef<{
    startX: number;
    startY: number;
    startTs: number;
    moved: boolean;
  } | null>(null);

  React.useEffect(() => {
    setContentVisible(false);
    const raf = requestAnimationFrame(() => setContentVisible(true));
    return () => cancelAnimationFrame(raf);
  }, [title, value, displayValue, team, manager]);

  const handleCardTouchStart = (event: React.TouchEvent<HTMLElement>) => {
    if (!onToggleMode || event.touches.length !== 1) return;
    cardTouchRef.current = {
      startX: event.touches[0].clientX,
      startY: event.touches[0].clientY,
      startTs: Date.now(),
      moved: false,
    };
  };

  const handleCardTouchMove = (event: React.TouchEvent<HTMLElement>) => {
    const state = cardTouchRef.current;
    if (!state || event.touches.length !== 1) return;
    const deltaX = Math.abs(event.touches[0].clientX - state.startX);
    const deltaY = Math.abs(event.touches[0].clientY - state.startY);
    if (deltaX > 10 || deltaY > 10) {
      state.moved = true;
    }
  };

  const handleCardTouchEnd = () => {
    const state = cardTouchRef.current;
    cardTouchRef.current = null;
    if (!onToggleMode || !state || state.moved) return;
    if (Date.now() - state.startTs > 320) return;
    onToggleMode();
  };

  const handleCardClick = (event: React.MouseEvent<HTMLElement>) => {
    if (!onToggleMode) return;
    const target = event.target as HTMLElement | null;
    if (!target) return;
    // Keep desktop sparkline interactions focused on tooltip/hover, not mode toggling.
    if (target.closest("[data-widget-chart]")) return;
    onToggleMode();
  };

  if (value === null) {
    // ✅ Skeleton while loading
    return (
      <Card className="p-4 min-h-[220px]">
        <Skeleton className="h-4 w-24 mb-2" />
        <div className="stat-card-metric-row flex items-center">
          <div className="stat-card-metric-value w-1/2 flex items-center justify-start">
            <Skeleton className="h-12 w-20" />
          </div>
          <div className="stat-card-metric-trend w-1/2 flex items-center justify-center">
            <Skeleton className="h-16 w-full" />
          </div>
        </div>
        <div className="leading-tight">
          <Skeleton className="mb-1 h-4 w-32" />
          <Skeleton className="h-3 w-20" />
        </div>
      </Card>
    );
  }

  return (
    <Card
      className={cn("p-4 min-h-[220px] flex flex-col", onToggleMode ? "cursor-pointer" : "")}
      onClick={handleCardClick}
      onTouchStart={handleCardTouchStart}
      onTouchMove={handleCardTouchMove}
      onTouchEnd={handleCardTouchEnd}
      onTouchCancel={() => {
        cardTouchRef.current = null;
      }}
    >
      <div className="mb-2 flex items-start justify-between gap-2">
        <p className="text-sm text-muted-foreground">{title}</p>
        {onToggleMode ? (
          <button
            type="button"
            onClick={(event) => {
              event.stopPropagation();
              onToggleMode();
            }}
            className={cn(
              "rounded-md border px-2 py-1 text-[11px] font-medium transition-colors pointer-events-none sm:pointer-events-auto",
              mode === "good"
                ? "border-green-500/40 bg-green-500/10 text-green-600 dark:text-green-400"
                : "border-red-500/40 bg-red-500/10 text-red-600 dark:text-red-400"
            )}
            aria-label={`Show ${mode === "good" ? "poor" : "good"} performance`}
          >
            {mode === "good" ? "Good" : "Poor"}
          </button>
        ) : null}
      </div>
      <div
        className={cn(
          "flex min-h-0 flex-1 flex-col transition-opacity duration-200",
          contentVisible ? "opacity-100" : "opacity-0"
        )}
      >
        <div className="stat-card-metric-row mb-2 flex items-center">
          <div className="stat-card-metric-value w-1/2 flex items-center justify-start">
            <h2 className={`text-5xl font-mono font-semibold ${valueClassName ?? ""}`}>
              {displayValue ?? value}
            </h2>
          </div>
          <div
            data-widget-chart
            className="stat-card-metric-trend w-1/2 flex items-center justify-center"
          >
            <MiniTrendChart
              trend={trend}
              isLoading={isTrendLoading}
              unit={unit}
              chartId={chartId}
              enableTooltip={enableTooltip}
              signedTooltipValue={signedTooltipValue}
            />
          </div>
        </div>
        <div className="mt-auto leading-tight">
          <p className="text-base font-semibold">{team}</p>
          <p className="text-sm">{manager}</p>
        </div>
      </div>
    </Card>
  );
}

interface LeagueStatsCardsProps {
  stats: {
    mostPoints: EnrichedStanding | null;
    fewestPoints: EnrichedStanding | null;
    mostBench: EnrichedStanding | null;
    mostTransfers: EnrichedStanding | null;
  } | null;
  standings: EnrichedStanding[];
  leagueId: number;
  gw: number;
  currentGw: number;
  isLoading: boolean;
  hasError: boolean;
}

export function LeagueStatsCards({
  stats,
  standings,
  leagueId,
  gw,
  currentGw,
  isLoading,
  hasError,
}: LeagueStatsCardsProps) {
  const disableTooltipOnTouch = useDisableChartTooltipOnTouch();
  const { data: trendData, error: trendError } = useSWR<TrendResponse>(
    `/api/stats-trend?leagueId=${leagueId}&gw=${gw}&window=8`,
    fetcher,
    { revalidateOnFocus: false, refreshInterval: 0 }
  );
  const { data: activityImpactData } = useSWR<ActivityImpactRow[]>(
    `/api/activity-impact?leagueId=${leagueId}&gw=${gw}&currentGw=${currentGw}`,
    fetcher,
    { revalidateOnFocus: false, refreshInterval: 0 }
  );

  const effectiveStats = isLoading ? null : stats;
  const isTrendLoading = !trendData && !trendError;
  const mostInfluenceRow =
    activityImpactData && activityImpactData.length > 0
      ? [...activityImpactData].sort((a, b) => b.gwDecisionScore - a.gwDecisionScore)[0]
      : null;
  const leastInfluenceRow =
    activityImpactData && activityImpactData.length > 0
      ? [...activityImpactData].sort((a, b) => a.gwDecisionScore - b.gwDecisionScore)[0]
      : null;
  const fewestBenchRow =
    standings.length > 0
      ? standings.reduce((min, team) => (team.benchPoints < min.benchPoints ? team : min))
      : null;
  const mostInfluenceScore = mostInfluenceRow?.gwDecisionScore ?? null;
  const mostInfluenceDisplay =
    mostInfluenceScore === null
      ? null
      : mostInfluenceScore > 0
        ? `+${mostInfluenceScore}`
        : String(mostInfluenceScore);
  const mostInfluenceClass =
    mostInfluenceScore === null
      ? ""
      : mostInfluenceScore > 0
        ? "text-green-600 dark:text-green-400"
        : mostInfluenceScore < 0
          ? "text-red-600 dark:text-red-400"
          : "";
  const leastInfluenceScore = leastInfluenceRow?.gwDecisionScore ?? null;
  const leastInfluenceDisplay =
    leastInfluenceScore === null
      ? null
      : leastInfluenceScore > 0
        ? `+${leastInfluenceScore}`
        : String(leastInfluenceScore);
  const leastInfluenceClass =
    leastInfluenceScore === null
      ? ""
      : leastInfluenceScore > 0
        ? "text-green-600 dark:text-green-400"
        : leastInfluenceScore < 0
          ? "text-red-600 dark:text-red-400"
          : "";

  const [widgetMode, setWidgetMode] = React.useState<Record<WidgetKey, WidgetMode>>({
    points: "good",
    influence: "good",
    bench: "good",
    captain: "good",
  });

  React.useEffect(() => {
    if (typeof window === "undefined") return;
    setWidgetMode({
      points: (window.localStorage.getItem(WIDGET_MODE_STORAGE_KEYS.points) as WidgetMode) || "good",
      influence:
        (window.localStorage.getItem(WIDGET_MODE_STORAGE_KEYS.influence) as WidgetMode) || "good",
      bench: (window.localStorage.getItem(WIDGET_MODE_STORAGE_KEYS.bench) as WidgetMode) || "good",
      captain:
        (window.localStorage.getItem(WIDGET_MODE_STORAGE_KEYS.captain) as WidgetMode) || "good",
    });
  }, []);

  const toggleWidgetMode = (widget: WidgetKey) => {
    setWidgetMode((prev) => {
      const nextMode: WidgetMode = prev[widget] === "good" ? "poor" : "good";
      const next = { ...prev, [widget]: nextMode };
      if (typeof window !== "undefined") {
        window.localStorage.setItem(WIDGET_MODE_STORAGE_KEYS[widget], nextMode);
      }
      return next;
    });
  };

  const bestCaptainRow =
    activityImpactData && activityImpactData.length > 0
      ? [...activityImpactData].sort((a, b) => b.captainImpact - a.captainImpact)[0]
      : null;
  const worstCaptainRow =
    activityImpactData && activityImpactData.length > 0
      ? [...activityImpactData].sort((a, b) => a.captainImpact - b.captainImpact)[0]
      : null;
  const bestCaptainValue = bestCaptainRow?.captainImpact ?? null;
  const worstCaptainValue = worstCaptainRow?.captainImpact ?? null;
  const formatSigned = (value: number | null) =>
    value === null ? null : value > 0 ? `+${value}` : String(value);
  const captainClass = (value: number | null) =>
    value === null
      ? ""
      : value > 0
        ? "text-green-600 dark:text-green-400"
        : value < 0
          ? "text-red-600 dark:text-red-400"
          : "";

  if (hasError) return <div>Error loading stats</div>;

  return (
    <div className="grid grid-cols-1 gap-4 md:gap-6 sm:grid-cols-4">
      <StatCard
        title={widgetMode.points === "good" ? "Most GW Points" : "Fewest GW Points"}
        value={
          widgetMode.points === "good"
            ? (effectiveStats?.mostPoints?.gwPoints ?? null)
            : (effectiveStats?.fewestPoints?.gwPoints ?? null)
        }
        team={
          widgetMode.points === "good"
            ? (effectiveStats?.mostPoints?.entry_name ?? null)
            : (effectiveStats?.fewestPoints?.entry_name ?? null)
        }
        manager={
          widgetMode.points === "good"
            ? (effectiveStats?.mostPoints?.player_name ?? null)
            : (effectiveStats?.fewestPoints?.player_name ?? null)
        }
        trend={widgetMode.points === "good" ? trendData?.series.mostPoints : trendData?.series.fewestPoints}
        isTrendLoading={isTrendLoading}
        unit="pts"
        chartId={widgetMode.points === "good" ? "most-points" : "fewest-points"}
        enableTooltip={!disableTooltipOnTouch}
        mode={widgetMode.points}
        onToggleMode={() => toggleWidgetMode("points")}
      />
      <StatCard
        title={widgetMode.influence === "good" ? "Most GW Influence" : "Least GW Influence"}
        value={widgetMode.influence === "good" ? mostInfluenceScore : leastInfluenceScore}
        displayValue={
          widgetMode.influence === "good" ? mostInfluenceDisplay : leastInfluenceDisplay
        }
        valueClassName={widgetMode.influence === "good" ? mostInfluenceClass : leastInfluenceClass}
        team={widgetMode.influence === "good" ? (mostInfluenceRow?.team ?? null) : (leastInfluenceRow?.team ?? null)}
        manager={
          widgetMode.influence === "good"
            ? (mostInfluenceRow?.manager ?? null)
            : (leastInfluenceRow?.manager ?? null)
        }
        trend={
          widgetMode.influence === "good"
            ? trendData?.series.mostInfluence
            : trendData?.series.leastInfluence
        }
        isTrendLoading={isTrendLoading}
        unit=""
        chartId={widgetMode.influence === "good" ? "most-influence" : "least-influence"}
        enableTooltip={!disableTooltipOnTouch}
        signedTooltipValue
        mode={widgetMode.influence}
        onToggleMode={() => toggleWidgetMode("influence")}
      />
      <StatCard
        title={widgetMode.bench === "good" ? "Fewest GW Bench Points" : "Most GW Bench Points"}
        value={
          widgetMode.bench === "good"
            ? (fewestBenchRow?.benchPoints ?? null)
            : (effectiveStats?.mostBench?.benchPoints ?? null)
        }
        team={
          widgetMode.bench === "good"
            ? (fewestBenchRow?.entry_name ?? null)
            : (effectiveStats?.mostBench?.entry_name ?? null)
        }
        manager={
          widgetMode.bench === "good"
            ? (fewestBenchRow?.player_name ?? null)
            : (effectiveStats?.mostBench?.player_name ?? null)
        }
        trend={widgetMode.bench === "good" ? trendData?.series.fewestBench : trendData?.series.mostBench}
        isTrendLoading={isTrendLoading}
        unit="pts"
        chartId={widgetMode.bench === "good" ? "fewest-bench" : "most-bench"}
        enableTooltip={!disableTooltipOnTouch}
        mode={widgetMode.bench}
        onToggleMode={() => toggleWidgetMode("bench")}
      />
      <StatCard
        title={widgetMode.captain === "good" ? "Best Captain Call" : "Worst Captain Call"}
        value={widgetMode.captain === "good" ? bestCaptainValue : worstCaptainValue}
        displayValue={formatSigned(widgetMode.captain === "good" ? bestCaptainValue : worstCaptainValue)}
        valueClassName={captainClass(widgetMode.captain === "good" ? bestCaptainValue : worstCaptainValue)}
        team={widgetMode.captain === "good" ? (bestCaptainRow?.team ?? null) : (worstCaptainRow?.team ?? null)}
        manager={
          widgetMode.captain === "good"
            ? (bestCaptainRow?.manager ?? null)
            : (worstCaptainRow?.manager ?? null)
        }
        trend={
          widgetMode.captain === "good"
            ? trendData?.series.bestCaptainCall
            : trendData?.series.worstCaptainCall
        }
        isTrendLoading={isTrendLoading}
        unit=""
        chartId={widgetMode.captain === "good" ? "best-captain-call" : "worst-captain-call"}
        enableTooltip={!disableTooltipOnTouch}
        signedTooltipValue
        mode={widgetMode.captain}
        onToggleMode={() => toggleWidgetMode("captain")}
      />
    </div>
  );
}
