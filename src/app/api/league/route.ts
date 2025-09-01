import { NextResponse } from "next/server";
import { getClassicLeague } from "@/lib/fpl";
import { enrichStandings } from "@/features/league/utils/enrichStandings";
import { EnrichedStanding } from "@/types/fpl";

// A type that covers both API and DB shapes
type StandingRow =
  | {
      entry: number; // raw API
      entry_name: string;
      player_name: string;
      total: number;
    }
  | {
      manager_id: number; // DB cached
      team_name: string;
      player_name: string;
      total: number;
    };

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const leagueId = Number(searchParams.get("leagueId"));
  const gw = Number(searchParams.get("gw"));
  const currentGw = Number(searchParams.get("currentGw"));

  const data = await getClassicLeague(leagueId, gw, currentGw);

  if (!data) {
    return NextResponse.json(
      { error: `Failed to fetch league ${leagueId}` },
      { status: 500 }
    );
  }

  // Normalize standings into DB-style shape
  const normalizedStandings = (data.standings.results as StandingRow[]).map(
    (s) => ({
      manager_id: "entry" in s ? s.entry : s.manager_id,
      team_name: "entry_name" in s ? s.entry_name : s.team_name,
      player_name: s.player_name,
      total: s.total,
    })
  );

  const ranked: EnrichedStanding[] = await enrichStandings(
    normalizedStandings,
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