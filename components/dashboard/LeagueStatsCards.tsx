"use client";

import useSWR from "swr";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { EnrichedStanding } from "@/types/fpl";
import { useSearchParams } from "next/navigation";

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
  value: number | null;
  team: string | null;
  manager: string | null;
}) {
  if (value === null) {
    // ✅ Skeleton while loading
    return (
      <Card className="p-4">
        <Skeleton className="h-4 w-24 mb-2" />
        <Skeleton className="h-5 w-16 mb-3" />
        <Skeleton className="h-4 w-32 mb-1" />
        <Skeleton className="h-3 w-20" />
      </Card>
    );
  }

  return (
    <Card className="p-4">
      <p className="text-sm text-muted-foreground">{title}</p>
      <h2 className="text-5xl font-mono font-semibold">{value}</h2>
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

  const stats = data?.stats;

  return (
    <div className="grid grid-cols-1 gap-4 md:gap-6 sm:grid-cols-4">
      <StatCard
        title="Most GW Points"
        value={stats?.mostPoints?.gwPoints ?? null}
        team={stats?.mostPoints?.entry_name ?? null}
        manager={stats?.mostPoints?.player_name ?? null}
      />
      <StatCard
        title="Fewest GW Points"
        value={stats?.fewestPoints?.gwPoints ?? null}
        team={stats?.fewestPoints?.entry_name ?? null}
        manager={stats?.fewestPoints?.player_name ?? null}
      />
      <StatCard
        title="Most GW Bench Points"
        value={stats?.mostBench?.benchPoints ?? null}
        team={stats?.mostBench?.entry_name ?? null}
        manager={stats?.mostBench?.player_name ?? null}
      />
      <StatCard
        title="Most GW Transfers"
        value={stats?.mostTransfers?.transfers ?? null}
        team={stats?.mostTransfers?.entry_name ?? null}
        manager={stats?.mostTransfers?.player_name ?? null}
      />
    </div>
  );
}