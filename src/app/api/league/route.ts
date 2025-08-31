import { NextResponse } from "next/server";
import { getClassicLeague } from "@/lib/fpl";
import { enrichStandings } from "@/features/league/utils/enrichStandings";
import { EnrichedStanding } from "@/types/fpl";

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const leagueId = Number(searchParams.get("leagueId"));
  const gw = Number(searchParams.get("gw"));
  const currentGw = Number(searchParams.get("currentGw"));

  // ✅ pass all 3 arguments
  const data = await getClassicLeague(leagueId, gw, currentGw);

  if (!data) {
    return NextResponse.json(
      { error: `Failed to fetch league ${leagueId}` },
      { status: 500 }
    );
  }

  const standings = data.standings.results;

  const ranked: EnrichedStanding[] = await enrichStandings(
    standings,
    gw,
    currentGw
  );

  // --- Calculate card stats ---
  const mostPoints = ranked.reduce((max, team) =>
    team.gwPoints > max.gwPoints ? team : max
  );
  const fewestPoints = ranked.reduce((min, team) =>
    team.gwPoints < min.gwPoints ? team : min
  );
  const mostBench = ranked.reduce((max, team) =>
    team.benchPoints > max.benchPoints ? team : max
  );
  const mostTransfers = ranked.reduce((max, team) =>
    team.transfers > max.transfers ? team : max
  );

  return NextResponse.json({
    standings: ranked,
    stats: {
      mostPoints,
      fewestPoints,
      mostBench,
      mostTransfers,
    },
  });
}