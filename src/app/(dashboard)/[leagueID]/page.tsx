import {
  getClassicLeague,
  getCurrentGameweek,
  getMaxGameweek,
} from "@/lib/fpl";
import { enrichStandings } from "@/features/league/utils/enrichStandings";
import DashboardClient from "@/app/(dashboard)/[leagueID]/DashboardClient";
import { EnrichedStanding } from "@/types/fpl";
import { LEAGUE_IDS } from "@/lib/leagues";
import { cookies } from "next/headers";
import {
  listUserLeagues,
  migrateUserKeyLeaguesToUserId,
  seedDefaultUserLeagues,
  USER_LEAGUES_COOKIE,
} from "@/lib/userLeagues";
import { getServerSessionUser } from "@/lib/supabaseAuth";

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ leagueId?: string; gw?: string }>;
}) {
  const params = await searchParams;
  const cookieStore = await cookies();
  const sessionUser = await getServerSessionUser();
  const userKey = cookieStore.get(USER_LEAGUES_COOKIE)?.value;
  if (sessionUser?.id && userKey) {
    await migrateUserKeyLeaguesToUserId({ userId: sessionUser.id, userKey });
  }
  let fetchedUserLeagues = await listUserLeagues(
    sessionUser?.id ? { userId: sessionUser.id } : { userKey }
  );
  if (sessionUser?.id && fetchedUserLeagues.length === 0) {
    await seedDefaultUserLeagues({ userId: sessionUser.id });
    fetchedUserLeagues = await listUserLeagues({ userId: sessionUser.id });
  }
  const configuredLeagues =
    fetchedUserLeagues.length > 0
      ? fetchedUserLeagues
      : LEAGUE_IDS.map((id) => ({
          id,
          name: `League ${id}`,
        }));
  const leagueIds = configuredLeagues.map((league) => league.id);

  const selectedLeagueIdParam = Number(params.leagueId);
  const selectedLeagueId =
    Number.isInteger(selectedLeagueIdParam) &&
    leagueIds.includes(selectedLeagueIdParam)
      ? selectedLeagueIdParam
      : leagueIds[0];

  const [currentGw, maxGw] = await Promise.all([
    getCurrentGameweek(),
    getMaxGameweek(),
  ]);

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
