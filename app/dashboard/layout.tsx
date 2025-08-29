import { ReactNode } from "react";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  getClassicLeague,
  getCurrentGameweek,
  getMaxGameweek,
} from "@/lib/fpl";
import { GameweekSelector } from "@/components/dashboard/GameweekSelector";
import { Card } from "@/components/ui/card";
import { headers } from "next/headers";

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

  // Build base URL dynamically (works in dev + prod)
  const headersList = await headers();
  const host = headersList.get("host");
  const protocol = process.env.NODE_ENV === "production" ? "https" : "http";
  const baseUrl = `${protocol}://${host}`;

  // Fetch stats for the current GW
  const res = await fetch(
    `${baseUrl}/api/standings?leagueId=${leagueId}&gw=${currentGw}&currentGw=${currentGw}`,
    { cache: "no-store" }
  );
  const { stats } = await res.json();

  return (
    <div className="flex min-h-screen flex-col font-sans">
      {/* Topbar */}
      <header className="border-b px-6 py-4">
        <h1 className="text-xl font-semibold">{leagueName}</h1>
      </header>

      {/* Main content */}
      <main className="flex-1 p-6 space-y-6">
        {/* Stats cards row */}
        <div className="grid grid-cols-1 gap-4 md:grid-cols-4">
          <Card className="p-4">
            <p className="text-sm text-muted-foreground">Most Points</p>
            <h2 className="text-2xl font-bold">{stats.mostPoints.gwPoints}</h2>
            <p className="text-sm">
              {stats.mostPoints.entry_name} ({stats.mostPoints.player_name})
            </p>
          </Card>
          <Card className="p-4">
            <p className="text-sm text-muted-foreground">Fewest Points</p>
            <h2 className="text-2xl font-bold">{stats.fewestPoints.gwPoints}</h2>
            <p className="text-sm">
              {stats.fewestPoints.entry_name} ({stats.fewestPoints.player_name})
            </p>
          </Card>
          <Card className="p-4">
            <p className="text-sm text-muted-foreground">Most Bench Points</p>
            <h2 className="text-2xl font-bold">{stats.mostBench.benchPoints}</h2>
            <p className="text-sm">
              {stats.mostBench.entry_name} ({stats.mostBench.player_name})
            </p>
          </Card>
          <Card className="p-4">
            <p className="text-sm text-muted-foreground">Most Transfers</p>
            <h2 className="text-2xl font-bold">{stats.mostTransfers.transfers}</h2>
            <p className="text-sm">
              {stats.mostTransfers.entry_name} ({stats.mostTransfers.player_name})
            </p>
          </Card>
        </div>

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