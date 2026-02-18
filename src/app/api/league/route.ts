import { NextResponse } from "next/server";
import { getClassicLeague } from "@/lib/fpl";
import { enrichStandings } from "@/features/league/utils/enrichStandings";
import { EnrichedStanding } from "@/types/fpl";
import { withTiming } from "@/lib/metrics";

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const leagueId = Number(searchParams.get("leagueId"));
  const gw = Number(searchParams.get("gw"));
  const currentGw = Number(searchParams.get("currentGw"));

  return withTiming("api.league.GET", { leagueId, gw, currentGw }, async () => {
    if (
      !Number.isInteger(leagueId) ||
      leagueId <= 0 ||
      !Number.isInteger(gw) ||
      gw <= 0 ||
      !Number.isInteger(currentGw) ||
      currentGw <= 0
    ) {
      return NextResponse.json(
        {
          error:
            "Invalid query params. Expected positive integers for leagueId, gw, and currentGw.",
        },
        { status: 400 }
      );
    }

    const data = await getClassicLeague(leagueId);

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

    if (ranked.length === 0) {
      return NextResponse.json({
        standings: [],
        stats: null,
      });
    }

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
  });
}

