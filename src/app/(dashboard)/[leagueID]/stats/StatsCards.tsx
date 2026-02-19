"use client";

import * as React from "react";
import useSWR from "swr";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { EnrichedStanding } from "@/types/fpl";
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
    mostTransfers: TrendSeries;
  };
}

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
}: {
  active?: boolean;
  payload?: Array<{ payload: TrendPoint }>;
  unit?: string;
}) {
  if (!active || !payload?.[0]) return null;
  const point = payload[0].payload;

  return (
    <div className="rounded-sm border border-border bg-popover px-2 py-1 text-xs shadow-sm">
      <p className="font-medium">GW {point.gw}</p>
      <p className="text-muted-foreground">
        {point.value ?? "—"}
        {unit ? ` ${unit}` : ""}
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
}: {
  trend: TrendSeries | null | undefined;
  isLoading: boolean;
  unit?: string;
  chartId: string;
  enableTooltip: boolean;
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
          {enableTooltip && <Tooltip content={<TrendTooltip unit={unit} />} />}
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
  team,
  manager,
  trend,
  isTrendLoading,
  unit,
  chartId,
  enableTooltip,
}: {
  title: string;
  value: number | null;
  team: string | null;
  manager: string | null;
  trend: TrendSeries | null | undefined;
  isTrendLoading: boolean;
  unit?: string;
  chartId: string;
  enableTooltip: boolean;
}) {
  if (value === null) {
    // ✅ Skeleton while loading
    return (
      <Card className="p-4">
        <Skeleton className="h-4 w-24 mb-2" />
        <div className="stat-card-metric-row mt-1 mb-3 flex items-start gap-3">
          <Skeleton className="stat-card-metric-value h-12 w-16" />
          <Skeleton className="stat-card-metric-trend h-16 flex-1" />
        </div>
        <Skeleton className="h-4 w-32 mb-1" />
        <Skeleton className="h-3 w-20" />
      </Card>
    );
  }

  return (
    <Card className="p-4">
      <p className="text-sm text-muted-foreground">{title}</p>
      <div className="stat-card-metric-row flex items-center">
        <div className="stat-card-metric-value w-1/2 flex items-center justify-start">
          <h2 className="text-5xl font-mono font-semibold">{value}</h2>
        </div>
        <div className="stat-card-metric-trend w-1/2 flex items-center justify-center">
          <MiniTrendChart
            trend={trend}
            isLoading={isTrendLoading}
            unit={unit}
            chartId={chartId}
            enableTooltip={enableTooltip}
          />
        </div>
      </div>
      <div className="leading-tight">
        <p className="text-base font-semibold">{team}</p>
        <p className="text-sm">{manager}</p>
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
  leagueId: number;
  gw: number;
  isLoading: boolean;
  hasError: boolean;
}

export function LeagueStatsCards({
  stats,
  leagueId,
  gw,
  isLoading,
  hasError,
}: LeagueStatsCardsProps) {
  const disableTooltipOnTouch = useDisableChartTooltipOnTouch();
  const { data: trendData, error: trendError } = useSWR<TrendResponse>(
    `/api/stats-trend?leagueId=${leagueId}&gw=${gw}&window=8`,
    fetcher,
    { revalidateOnFocus: false, refreshInterval: 0 }
  );

  if (hasError) return <div>Error loading stats</div>;
  const effectiveStats = isLoading ? null : stats;
  const isTrendLoading = !trendData && !trendError;

  return (
    <div className="grid grid-cols-1 gap-4 md:gap-6 sm:grid-cols-4">
      <StatCard
        title="Most GW Points"
        value={effectiveStats?.mostPoints?.gwPoints ?? null}
        team={effectiveStats?.mostPoints?.entry_name ?? null}
        manager={effectiveStats?.mostPoints?.player_name ?? null}
        trend={trendData?.series.mostPoints}
        isTrendLoading={isTrendLoading}
        unit="pts"
        chartId="most-points"
        enableTooltip={!disableTooltipOnTouch}
      />
      <StatCard
        title="Fewest GW Points"
        value={effectiveStats?.fewestPoints?.gwPoints ?? null}
        team={effectiveStats?.fewestPoints?.entry_name ?? null}
        manager={effectiveStats?.fewestPoints?.player_name ?? null}
        trend={trendData?.series.fewestPoints}
        isTrendLoading={isTrendLoading}
        unit="pts"
        chartId="fewest-points"
        enableTooltip={!disableTooltipOnTouch}
      />
      <StatCard
        title="Most GW Bench Points"
        value={effectiveStats?.mostBench?.benchPoints ?? null}
        team={effectiveStats?.mostBench?.entry_name ?? null}
        manager={effectiveStats?.mostBench?.player_name ?? null}
        trend={trendData?.series.mostBench}
        isTrendLoading={isTrendLoading}
        unit="pts"
        chartId="most-bench"
        enableTooltip={!disableTooltipOnTouch}
      />
      <StatCard
        title="Most GW Transfers"
        value={effectiveStats?.mostTransfers?.transfers ?? null}
        team={effectiveStats?.mostTransfers?.entry_name ?? null}
        manager={effectiveStats?.mostTransfers?.player_name ?? null}
        trend={trendData?.series.mostTransfers}
        isTrendLoading={isTrendLoading}
        unit=""
        chartId="most-transfers"
        enableTooltip={!disableTooltipOnTouch}
      />
    </div>
  );
}
