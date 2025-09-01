import { NextResponse } from "next/server";
import {
  getClassicLeague,
  getTeamChips,
  getCurrentGameweek,
  Chip,
} from "@/lib/fpl";

// A type that covers both API and DB shapes
type StandingRow =
  | {
      entry: number; // raw API
      entry_name: string;
      player_name: string;
    }
  | {
      manager_id: number; // DB cached
      team_name: string;
      player_name: string;
    };

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const leagueId = Number(searchParams.get("leagueId"));
  const gw = Number(searchParams.get("gw"));

  const currentGw = await getCurrentGameweek();
  const league = await getClassicLeague(leagueId, gw, currentGw);

  if (!league) {
    return NextResponse.json(
      { error: `Failed to fetch league ${leagueId}` },
      { status: 500 }
    );
  }

  // Normalize standings
  const normalizedStandings = (league.standings.results as StandingRow[]).map(
    (s) => ({
      manager_id: "entry" in s ? s.entry : s.manager_id,
      team_name: "entry_name" in s ? s.entry_name : s.team_name,
      player_name: s.player_name,
    })
  );

  // ✅ Fetch all chips in parallel
  const data = await Promise.all(
    normalizedStandings.map(async (entry) => {
      const chips: Chip[] = (await getTeamChips(entry.manager_id)) ?? [];
      const gwChip = chips.find((c) => c.event === gw);

      return {
        team: entry.team_name,
        manager: entry.player_name,
        chip: gwChip ? gwChip.name : null,
      };
    })
  );

  return NextResponse.json(data);
}