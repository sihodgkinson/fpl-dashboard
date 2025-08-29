import {
  getClassicLeague,
  getCurrentGameweek,
  getMaxGameweek,
} from "@/lib/fpl";
import { LeagueStatsCards } from "@/components/dashboard/LeagueStatsCards";
import { LeagueTable } from "@/components/dashboard/LeagueTable";
import { TransfersTab } from "@/components/dashboard/TransfersTab";
import { ChipsTab } from "@/components/dashboard/ChipsTab";
import { GameweekSelector } from "@/components/dashboard/GameweekSelector";
import { LeagueSelector } from "@/components/dashboard/LeagueSelector";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";

const leagueIds = [430552, 4311, 1295109];

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ leagueId?: string; gw?: string }>;
}) {
  const params = await searchParams;
  const selectedLeagueId = Number(params.leagueId) || leagueIds[0];

  // Fetch all league names
  const leagues = await Promise.all(
    leagueIds.map(async (id) => {
      const data = await getClassicLeague(id);
      return { id, name: data.league.name };
    })
  );

  const [currentGw, maxGw] = await Promise.all([
    getCurrentGameweek(),
    getMaxGameweek(),
  ]);

  const gw = Number(params.gw) || currentGw;

  return (
    <>
      {/* Header with selectors */}
      <header className="border-b px-6 py-4">
        <div className="flex gap-4">
          <LeagueSelector
            leagues={leagues}
            selectedLeagueId={selectedLeagueId}
            currentGw={currentGw}
          />
          <GameweekSelector currentGw={currentGw} maxGw={maxGw} />
        </div>
      </header>

      {/* Main content */}
      <main className="p-6 space-y-6">
        {/* Stats cards */}
        <LeagueStatsCards leagueId={selectedLeagueId} currentGw={currentGw} />

        {/* Tabs below cards */}
        <Tabs defaultValue="league" className="w-full">
          <TabsList>
            <TabsTrigger value="league">League Table</TabsTrigger>
            <TabsTrigger value="transfers">Transfers</TabsTrigger>
            <TabsTrigger value="chips">Chips</TabsTrigger>
          </TabsList>

          <TabsContent value="league" className="mt-6">
            <LeagueTable
              leagueId={selectedLeagueId}
              gw={gw}
              currentGw={currentGw}
            />
          </TabsContent>

          <TabsContent value="transfers" className="mt-6">
            <TransfersTab leagueId={selectedLeagueId} currentGw={currentGw} />
          </TabsContent>

          <TabsContent value="chips" className="mt-6">
            <ChipsTab leagueId={selectedLeagueId} currentGw={currentGw} />
          </TabsContent>
        </Tabs>
      </main>
    </>
  );
}