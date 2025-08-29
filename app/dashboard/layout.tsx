import { ReactNode } from "react";
import { Card } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { getClassicLeague } from "@/lib/fpl";

export default async function DashboardLayout({
  children,
}: {
  children: ReactNode;
}) {
  const leagueId = 430552;
  const data = await getClassicLeague(leagueId);

  const leagueName = data.league.name;

  return (
    <div className="flex min-h-screen flex-col font-sans">
      {/* Topbar */}
      <header className="border-b px-6 py-4">
        <h1 className="text-xl font-semibold">{leagueName}</h1>
      </header>

      {/* Main content */}
      <main className="flex-1 p-6 space-y-6">
        {/* Stats cards row (placeholder for now) */}
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

        {/* Tabs */}
        <Tabs defaultValue="league">
          <TabsList>
            <TabsTrigger value="league">League Table</TabsTrigger>
            <TabsTrigger value="transfers">Transfers</TabsTrigger>
            <TabsTrigger value="chips">Chips</TabsTrigger>
          </TabsList>
        </Tabs>

        {/* Page content */}
        <div>{children}</div>
      </main>
    </div>
  );
}