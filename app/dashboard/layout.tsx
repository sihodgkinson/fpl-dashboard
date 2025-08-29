import { ReactNode } from "react";
import { Card } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { getClassicLeague, getCurrentGameweek, getMaxGameweek } from "@/lib/fpl";
import { GameweekSelector } from "@/components/dashboard/GameweekSelector";

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
        <div className="grid grid-cols-1 gap-4 md:grid-cols-4">
          <Card className="p-4">
            <p className="text-sm text-muted-foreground">Most Points</p>
            <h2 className="text-2xl font-bold">--</h2>
            <p className="text-sm">--</p>
          </Card>
          <Card className="p-4">
            <p className="text-sm text-muted-foreground">Fewest Points</p>
            <h2 className="text-2xl font-bold">--</h2>
            <p className="text-sm">--</p>
          </Card>
          <Card className="p-4">
            <p className="text-sm text-muted-foreground">Most Bench Points</p>
            <h2 className="text-2xl font-bold">--</h2>
            <p className="text-sm">--</p>
          </Card>
          <Card className="p-4">
            <p className="text-sm text-muted-foreground">Most Transfers</p>
            <h2 className="text-2xl font-bold">--</h2>
            <p className="text-sm">--</p>
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

        {/* Page content */}
        <div>{children}</div>
      </main>
    </div>
  );
}