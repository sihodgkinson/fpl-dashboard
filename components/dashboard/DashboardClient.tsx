"use client";

import * as React from "react";
import { LeagueStatsCards } from "@/components/dashboard/LeagueStatsCards";
import { LeagueTable } from "@/components/dashboard/LeagueTable";
import { TransfersTab } from "@/components/dashboard/TransfersTab";
import { ChipsTab } from "@/components/dashboard/ChipsTab";
import { GameweekSelector } from "@/components/dashboard/GameweekSelector";
import { LeagueSelector } from "@/components/dashboard/LeagueSelector";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ModeToggle } from "@/components/mode-toggle";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

interface DashboardClientProps {
  leagues: { id: number; name: string }[];
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
        <LeagueStatsCards leagueId={selectedLeagueId} currentGw={currentGw} />

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
            <TabsTrigger
              value="league"
              type="button"
              className="px-3 sm:px-4 focus:scroll-m-0"
            >
              League Table
            </TabsTrigger>
            <TabsTrigger
              value="transfers"
              type="button"
              className="px-3 sm:px-4 focus:scroll-m-0"
            >
              Transfers
            </TabsTrigger>
            <TabsTrigger
              value="chips"
              type="button"
              className="px-3 sm:px-4 focus:scroll-m-0"
            >
              Chips
            </TabsTrigger>
          </TabsList>
        </Tabs>

        {/* ✅ Tab content (all pre-mounted, hidden with CSS) */}
        <div className="w-full">
          <div className={tab === "league" ? "block mt-2 sm:mt-4" : "hidden"}>
            <LeagueTable
              leagueId={selectedLeagueId}
              gw={gw}
              currentGw={currentGw}
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