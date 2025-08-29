import { ReactNode } from "react";
import {
  getClassicLeague,
  getCurrentGameweek,
  getMaxGameweek,
} from "@/lib/fpl";
import { GameweekSelector } from "@/components/dashboard/GameweekSelector";
import { LeagueStatsCards } from "@/components/dashboard/LeagueStatsCards";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { TransfersTab } from "@/components/dashboard/TransfersTab";

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
  {/* Stats cards row */}
  <LeagueStatsCards leagueId={leagueId} currentGw={currentGw} />

  {/* Tabs + Gameweek Selector */}
  <Tabs defaultValue="league" className="w-full">
    <div className="flex items-center gap-4">
      <TabsList>
        <TabsTrigger value="league">League Table</TabsTrigger>
        <TabsTrigger value="transfers">Transfers</TabsTrigger>
        <TabsTrigger value="chips">Chips</TabsTrigger>
      </TabsList>

      <GameweekSelector currentGw={currentGw} maxGw={maxGw} />
    </div>

    <TabsContent value="league" className="mt-6">
      {children} {/* LeagueTable from page.tsx */}
    </TabsContent>

    <TabsContent value="transfers" className="mt-6">
  <TransfersTab leagueId={leagueId} currentGw={currentGw} />
</TabsContent>

    <TabsContent value="chips" className="mt-6">
      <div>Chips tab coming soon...</div>
    </TabsContent>
  </Tabs>
</main>
    </div>
  );
}