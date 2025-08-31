"use client";

import useSWR from "swr";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton"; // ✅ shadcn skeleton
import { EnrichedStanding } from "@/types/fpl";
import { useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";

const fetcher = (url: string) => fetch(url).then((res) => res.json());

interface StandingsResponse {
  standings: EnrichedStanding[];
  stats: {
    mostPoints: EnrichedStanding;
    fewestPoints: EnrichedStanding;
    mostBench: EnrichedStanding;
    mostTransfers: EnrichedStanding;
  };
}

function StatCard({
  title,
  value,
  team,
  manager,
}: {
  title: string;
  value: number;
  team: string;
  manager: string;
}) {
  const [displayValue, setDisplayValue] = useState(value);
  const [animate, setAnimate] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true); // trigger fade-in on mount
  }, []);

  useEffect(() => {
    if (value !== displayValue) {
      setAnimate(true);
      setDisplayValue(value);
      const timeout = setTimeout(() => setAnimate(false), 500);
      return () => clearTimeout(timeout);
    }
  }, [value, displayValue]);

  return (
    <Card
      className={`p-4 transition-opacity duration-500 ${
        mounted ? "opacity-100" : "opacity-0"
      }`}
    >
      <p className="text-sm text-muted-foreground">{title}</p>
      <h2
        className={`text-5xl font-mono font-semi-bold transition-colors ${
          animate ? "text-primary" : "text-foreground"
        }`}
      >
        {displayValue}
      </h2>
      <div className="leading-tight">
        <p className="text-base font-semibold">{team}</p>
        <p className="text-sm">{manager}</p>
      </div>
    </Card>
  );
}

// ✅ Skeleton version of StatCard
function StatCardSkeleton() {
  return (
    <Card className="p-4 animate-pulse"> {/* ✅ shimmer effect */}
      {/* Title (text-sm) */}
      <Skeleton className="h-4 w-28 mb-2" />
      {/* Big number (text-5xl) */}
      <Skeleton className="h-9 w-20 mb-3" />
      <div className="leading-tight">
        {/* Team name (text-base) */}
        <Skeleton className="h-5 w-32 mb-1" />
        {/* Manager name (text-sm) */}
        <Skeleton className="h-4 w-24" />
      </div>
    </Card>
  );
}

export function LeagueStatsCards({
  leagueId,
  currentGw,
}: {
  leagueId: number;
  currentGw: number;
}) {
  const searchParams = useSearchParams();
  const gw = Number(searchParams.get("gw")) || currentGw;

  const { data, error } = useSWR<StandingsResponse>(
    `/api/standings?leagueId=${leagueId}&gw=${gw}&currentGw=${currentGw}`,
    fetcher,
    { refreshInterval: 30000 }
  );

  if (error) return <div>Error loading stats</div>;

  if (!data) {
    // ✅ Show skeleton loader while fetching
    return (
      <div className="grid grid-cols-1 gap-4 md:gap-6 sm:grid-cols-4">
        {[...Array(4)].map((_, i) => (
          <StatCardSkeleton key={i} />
        ))}
      </div>
    );
  }

  const { stats } = data;

  return (
    <div className="grid grid-cols-1 gap-4 md:gap-6 sm:grid-cols-4">
      <StatCard
        title="Most GW Points"
        value={stats.mostPoints.gwPoints}
        team={stats.mostPoints.entry_name}
        manager={stats.mostPoints.player_name}
      />
      <StatCard
        title="Fewest GW Points"
        value={stats.fewestPoints.gwPoints}
        team={stats.fewestPoints.entry_name}
        manager={stats.fewestPoints.player_name}
      />
      <StatCard
        title="Most GW Bench Points"
        value={stats.mostBench.benchPoints}
        team={stats.mostBench.entry_name}
        manager={stats.mostBench.player_name}
      />
      <StatCard
        title="Most GW Transfers"
        value={stats.mostTransfers.transfers}
        team={stats.mostTransfers.entry_name}
        manager={stats.mostTransfers.player_name}
      />
    </div>
  );
}