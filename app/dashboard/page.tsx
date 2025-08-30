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
import { ModeToggle } from "@/components/mode-toggle";

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
      <header className="border-b px-4 py-4 sm:px-4 sm:py-4 md:px-6 md:py-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          {/* Top row: League selector + Dark mode toggle */}
          <div className="flex items-center gap-2 w-full sm:w-auto">
            <LeagueSelector
              leagues={leagues}
              selectedLeagueId={selectedLeagueId}
              currentGw={currentGw}
              className="flex-1 sm:flex-none !h-12 text-base sm:h-12 sm:text-sm"
            />
          </div>

          {/* Bottom row (on mobile): Gameweek selector + nav buttons */}
          <div className="flex items-center gap-2 w-full sm:w-auto">
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

        {/* Tabs below cards */}
        <Tabs defaultValue="league" className="w-full">
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

          <TabsContent
            value="league"
            forceMount
            className="mt-2 sm:mt-4 data-[state=inactive]:hidden"
          >
            <LeagueTable
              leagueId={selectedLeagueId}
              gw={gw}
              currentGw={currentGw}
            />
          </TabsContent>

          <TabsContent
            value="transfers"
            forceMount
            className="mt-2 sm:mt-4 data-[state=inactive]:hidden"
          >
            <TransfersTab leagueId={selectedLeagueId} currentGw={currentGw} />
          </TabsContent>

          <TabsContent
            value="chips"
            forceMount
            className="mt-2 sm:mt-4 data-[state=inactive]:hidden"
          >
            <ChipsTab leagueId={selectedLeagueId} currentGw={currentGw} />
          </TabsContent>
        </Tabs>
      </main>
    </>
  );
}