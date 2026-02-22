import {
  getClassicLeague,
  getCurrentGameweek,
  getMaxGameweek,
} from "@/lib/fpl";
import { redirect } from "next/navigation";
import { enrichStandings } from "@/features/league/utils/enrichStandings";
import DashboardClient from "@/app/(dashboard)/[leagueID]/DashboardClient";
import { OnboardingGate } from "@/components/common/OnboardingGate";
import { EnrichedStanding } from "@/types/fpl";
import { listUserLeagues } from "@/lib/userLeagues";
import { getServerSessionUser } from "@/lib/supabaseAuth";

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ leagueId?: string; gw?: string }>;
}) {
  const params = await searchParams;
  const [currentGw, maxGw] = await Promise.all([
    getCurrentGameweek(),
    getMaxGameweek(),
  ]);

  const sessionUser = await getServerSessionUser();
  if (!sessionUser?.id) {
    redirect("/");
  }

  const configuredLeagues = await listUserLeagues(sessionUser.id);

  if (configuredLeagues.length === 0) {
    return <OnboardingGate isAuthenticated currentGw={currentGw} />;
  }
  const leagueIds = configuredLeagues.map((league) => league.id);

  const selectedLeagueIdParam = Number(params.leagueId);
  const selectedLeagueId =
    Number.isInteger(selectedLeagueIdParam) &&
    leagueIds.includes(selectedLeagueIdParam)
      ? selectedLeagueIdParam
      : leagueIds[0];

  const gw = Number(params.gw) || currentGw;

  const leagueDataEntries = await Promise.all(
    configuredLeagues.map(async (league) => [league.id, await getClassicLeague(league.id)] as const)
  );
  const leagueDataById = new Map(leagueDataEntries);
  const selectedLeagueData = selectedLeagueId
    ? (leagueDataById.get(selectedLeagueId) ?? null)
    : null;

  let selectedStandings: EnrichedStanding[] | null = null;
  let selectedStats: {
    mostPoints: EnrichedStanding | null;
    fewestPoints: EnrichedStanding | null;
    mostBench: EnrichedStanding | null;
    mostTransfers: EnrichedStanding | null;
  } | null = null;

  if (selectedLeagueData && gw === currentGw) {
    selectedStandings = await enrichStandings(
      selectedLeagueData.standings.results,
      gw,
      currentGw
    );

    if (selectedStandings.length > 0) {
      selectedStats = {
        mostPoints: selectedStandings.reduce((a, b) =>
          b.gwPoints > a.gwPoints ? b : a
        ),
        fewestPoints: selectedStandings.reduce((a, b) =>
          b.gwPoints < a.gwPoints ? b : a
        ),
        mostBench: selectedStandings.reduce((a, b) =>
          b.benchPoints > a.benchPoints ? b : a
        ),
        mostTransfers: selectedStandings.reduce((a, b) =>
          b.transfers > a.transfers ? b : a
        ),
      };
    }
  }

  const leagues: {
    id: number;
    name: string;
    standings: EnrichedStanding[] | null;
    stats: {
      mostPoints: EnrichedStanding | null;
      fewestPoints: EnrichedStanding | null;
      mostBench: EnrichedStanding | null;
      mostTransfers: EnrichedStanding | null;
    } | null;
  }[] = configuredLeagues
    .map((league) => {
      const officialLeagueName = leagueDataById.get(league.id)?.league?.name?.trim();
      const leagueName = officialLeagueName || league.name;

      return {
        id: league.id,
        name: leagueName,
        standings: league.id === selectedLeagueId ? selectedStandings : null,
        stats: league.id === selectedLeagueId ? selectedStats : null,
      };
    })
    .sort((a, b) =>
      a.name.localeCompare(b.name, undefined, { sensitivity: "base" })
    );

  return (
    <DashboardClient
      leagues={leagues}
      selectedLeagueId={selectedLeagueId}
      currentGw={currentGw}
      maxGw={maxGw}
      gw={gw}
    />
  );
}
