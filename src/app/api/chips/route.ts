import { NextResponse } from "next/server";
import {
  getClassicLeague,
  getTeamChips,
  getCurrentGameweek, // ✅ import this
  Chip,
} from "@/lib/fpl";

interface LeagueEntry {
  entry: number;
  entry_name: string;
  player_name: string;
}

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const leagueId = Number(searchParams.get("leagueId"));
  const gw = Number(searchParams.get("gw"));

  // ✅ fetch current gameweek
  const currentGw = await getCurrentGameweek();

  // ✅ pass all 3 arguments
  const league = await getClassicLeague(leagueId, gw, currentGw);

  if (!league) {
    return NextResponse.json(
      { error: `Failed to fetch league ${leagueId}` },
      { status: 500 }
    );
  }

  const standings = league.standings.results as LeagueEntry[];

  const data = await Promise.all(
    standings.map(async (entry) => {
      const chips: Chip[] = (await getTeamChips(entry.entry)) ?? [];
      const gwChip = chips.find((c) => c.event === gw);

      return {
        team: entry.entry_name,
        manager: entry.player_name,
        chip: gwChip ? gwChip.name : null,
      };
    })
  );

  return NextResponse.json(data);
}