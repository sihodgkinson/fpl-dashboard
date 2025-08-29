import { ReactNode } from "react";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  getClassicLeague,
  getCurrentGameweek,
  getMaxGameweek,
} from "@/lib/fpl";
import { GameweekSelector } from "@/components/dashboard/GameweekSelector";
import { LeagueStatsCards } from "@/components/dashboard/LeagueStatsCards";

export default async function DashboardLayout({
  children,
}: {
  children: ReactNode;
}) {
  const leagueId = 430552;
  const data = await getClassicLeague(leagueId);
  const leagueName = data.league.name;

  const [currentGw, maxGw] = await Promise.all([
    getCurrentGameweek(),
    getMaxGameweek(),
  ]);

  return (
    <div className="flex min-h-screen flex-col font-sans">
      {/* Topbar */}
      <header className="border-b px-6 py-4">
        <h1 className="text-xl font-semibold">{leagueName}</h1>
      </header>

      {/* Main content */}
      <main className="flex-1 p-6 space-y-6">
        {/* Stats cards row (client-side, updates with GW) */}
        <LeagueStatsCards leagueId={leagueId} currentGw={currentGw} />

        {/* Tabs + Gameweek Selector */}
        <div className="flex items-center gap-4">
          <Tabs defaultValue="league">
            <TabsList>
              <TabsTrigger value="league">League Table</TabsTrigger>
              <TabsTrigger value="transfers">Transfers</TabsTrigger>
              <TabsTrigger value="chips">Chips</TabsTrigger>
            </TabsList>
          </Tabs>

          <GameweekSelector currentGw={currentGw} maxGw={maxGw} />
        </div>

        {/* Page content (LeagueTable renders table only) */}
        <div>{children}</div>
      </main>
    </div>
  );
}