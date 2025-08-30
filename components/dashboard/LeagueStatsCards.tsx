"use client";

import useSWR from "swr";
import { Card } from "@/components/ui/card";
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
  // Local state to trigger animation when value changes
  const [displayValue, setDisplayValue] = useState(value);
  const [animate, setAnimate] = useState(false);

  useEffect(() => {
    if (value !== displayValue) {
      setAnimate(true);
      setDisplayValue(value);
      const timeout = setTimeout(() => setAnimate(false), 500);
      return () => clearTimeout(timeout);
    }
  }, [value, displayValue]);

  return (
    <Card className="p-4">
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
  if (!data) return <div>Loading...</div>;

  const { stats } = data;

  return (
    <div className="grid grid-cols-1 gap-4 sm:gap-6 sm:grid-cols-4">
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