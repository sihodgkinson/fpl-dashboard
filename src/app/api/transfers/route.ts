import { NextResponse } from "next/server";
import {
  getClassicLeague,
  getCachedTransfers,
  getPlayers,
  getCurrentGameweek,
  Player,
  CachedTransfer,
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

  const players: Player[] = (await getPlayers()) ?? [];

  // ✅ Fetch all transfers in parallel, using cached function
  const data = await Promise.all(
    normalizedStandings.map(async (entry) => {
      const gwTransfers: CachedTransfer[] = await getCachedTransfers(
        entry.manager_id,
        gw
      );

      const mapped = gwTransfers.map((t) => {
        const playerIn = players.find((p) => p.id === t.player_in);
        const playerOut = players.find((p) => p.id === t.player_out);
        return {
          in: playerIn?.web_name ?? "Unknown",
          out: playerOut?.web_name ?? "Unknown",
        };
      });

      return {
        manager: entry.player_name,
        team: entry.team_name,
        transfers: mapped,
        count: gwTransfers.length,
      };
    })
  );

  return NextResponse.json(data);
}