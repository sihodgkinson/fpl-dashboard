"use client";

import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { EnrichedStanding } from "@/types/fpl";

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

interface LeagueStatsCardsProps {
  stats: {
    mostPoints: EnrichedStanding | null;
    fewestPoints: EnrichedStanding | null;
    mostBench: EnrichedStanding | null;
    mostTransfers: EnrichedStanding | null;
  } | null;
  isLoading: boolean;
  hasError: boolean;
}

export function LeagueStatsCards({
  stats,
  isLoading,
  hasError,
}: LeagueStatsCardsProps) {
  if (hasError) return <div>Error loading stats</div>;
  const effectiveStats = isLoading ? null : stats;

  return (
    <div className="grid grid-cols-1 gap-4 md:gap-6 sm:grid-cols-4">
      <StatCard
        title="Most GW Points"
        value={effectiveStats?.mostPoints?.gwPoints ?? null}
        team={effectiveStats?.mostPoints?.entry_name ?? null}
        manager={effectiveStats?.mostPoints?.player_name ?? null}
      />
      <StatCard
        title="Fewest GW Points"
        value={effectiveStats?.fewestPoints?.gwPoints ?? null}
        team={effectiveStats?.fewestPoints?.entry_name ?? null}
        manager={effectiveStats?.fewestPoints?.player_name ?? null}
      />
      <StatCard
        title="Most GW Bench Points"
        value={effectiveStats?.mostBench?.benchPoints ?? null}
        team={effectiveStats?.mostBench?.entry_name ?? null}
        manager={effectiveStats?.mostBench?.player_name ?? null}
      />
      <StatCard
        title="Most GW Transfers"
        value={effectiveStats?.mostTransfers?.transfers ?? null}
        team={effectiveStats?.mostTransfers?.entry_name ?? null}
        manager={effectiveStats?.mostTransfers?.player_name ?? null}
      />
    </div>
  );
}
