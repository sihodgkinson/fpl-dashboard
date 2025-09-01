import { NextResponse } from "next/server";
import {
  getClassicLeague,
  getCachedChips,
  getCurrentGameweek,
  CachedChip,
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

  // ✅ fetch current gameweek
  const currentGw = await getCurrentGameweek();

  // ✅ fetch league standings
  const league = await getClassicLeague(leagueId, gw, currentGw);

  if (!league) {
    return NextResponse.json(
      { error: `Failed to fetch league ${leagueId}` },
      { status: 500 }
    );
  }

  // ✅ normalize standings into DB-style shape
  const normalizedStandings = (league.standings.results as StandingRow[]).map(
    (s) => ({
      manager_id: "entry" in s ? s.entry : s.manager_id,
      team_name: "entry_name" in s ? s.entry_name : s.team_name,
      player_name: s.player_name,
    })
  );

  // ✅ Fetch all chips in parallel, using cached function
  const data = await Promise.all(
    normalizedStandings.map(async (entry) => {
      const gwChips: CachedChip[] = await getCachedChips(
        entry.manager_id,
        gw,
        currentGw // ✅ pass currentGw here
      );
      const chip = gwChips.length > 0 ? gwChips[0].chip_name : null;

      return {
        team: entry.team_name,
        manager: entry.player_name,
        chip,
      };
    })
  );

  return NextResponse.json(data);
}