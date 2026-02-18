"use client";

import * as React from "react";
import useSWR from "swr";
import { LeagueStatsCards } from "@/app/(dashboard)/[leagueID]/stats/StatsCards";
import { LeagueTable } from "@/app/(dashboard)/[leagueID]/league/LeagueTable";
import { TransfersTab } from "@/app/(dashboard)/[leagueID]/transfers/TransfersTable";
import { ChipsTab } from "@/app/(dashboard)/[leagueID]/chips/ChipsTable";
import { GameweekSelector } from "@/components/common/GameweekSelector";
import { LeagueSelector } from "@/components/common/LeagueSelector";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ModeToggle } from "@/components/common/ModeToggle";
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
    mostPoints: EnrichedStanding;
    fewestPoints: EnrichedStanding;
    mostBench: EnrichedStanding;
    mostTransfers: EnrichedStanding;
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

export default function DashboardClient({
  leagues,
  selectedLeagueId,
  currentGw,
  maxGw,
  gw,
}: DashboardClientProps) {
  const [tab, setTab] = React.useState("league");

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
      refreshInterval: gw === currentGw ? 60000 : 0,
      revalidateOnFocus: gw === currentGw,
    }
  );

  const standings = Array.isArray(data?.standings)
    ? data.standings
    : [];

  const stats = data?.stats ?? null;
  const isLeagueDataLoading = !data && !error;

  return (
    <>
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
          </div>

          {/* Bottom row (on mobile): Gameweek selector + dark mode toggle */}
          <div className="flex items-center gap-4 sm:gap-6 w-full sm:w-auto">
            <GameweekSelector
              currentGw={currentGw}
              maxGw={maxGw}
              className="flex-1 sm:flex-none !h-12 text-base sm:h-12 sm:text-sm"
            />
            <ModeToggle className="h-12 w-12 sm:h-12 sm:w-12" />
          </div>
        </div>
      </header>

      {/* Main content */}
      <main className="p-4 sm:p-4 md:p-6 space-y-4 sm:space-y-6">
        {/* Stats cards */}
        <LeagueStatsCards
          stats={stats}
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
              <SelectItem value="transfers">Transfers</SelectItem>
              <SelectItem value="chips">Chips</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* ✅ Desktop tabs (triggers only) */}
        <Tabs value={tab} onValueChange={setTab} className="hidden sm:block w-full">
          <TabsList>
            <TabsTrigger value="league" type="button" className="px-3 sm:px-4">
              League Table
            </TabsTrigger>
            <TabsTrigger value="transfers" type="button" className="px-3 sm:px-4">
              Transfers
            </TabsTrigger>
            <TabsTrigger value="chips" type="button" className="px-3 sm:px-4">
              Chips
            </TabsTrigger>
          </TabsList>
        </Tabs>

        {/* ✅ Tab content (all pre-mounted, hidden with CSS) */}
        <div className="w-full">
          <div className={tab === "league" ? "block mt-2 sm:mt-4" : "hidden"}>
            <LeagueTable
              standings={standings}
              isLoading={isLeagueDataLoading}
              hasError={Boolean(error)}
            />
          </div>

          <div className={tab === "transfers" ? "block mt-2 sm:mt-4" : "hidden"}>
            <TransfersTab leagueId={selectedLeagueId} currentGw={currentGw} />
          </div>

          <div className={tab === "chips" ? "block mt-2 sm:mt-4" : "hidden"}>
            <ChipsTab leagueId={selectedLeagueId} currentGw={currentGw} />
          </div>
        </div>
      </main>
    </>
  );
}
