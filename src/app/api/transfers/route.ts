import { NextResponse } from "next/server";
import {
  getClassicLeague,
  getTeamTransfers,
  getPlayers,
  Transfer,
  Player,
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

  if (
    !Number.isInteger(leagueId) ||
    leagueId <= 0 ||
    !Number.isInteger(gw) ||
    gw <= 0
  ) {
    return NextResponse.json(
      {
        error:
          "Invalid query params. Expected positive integers for leagueId and gw.",
      },
      { status: 400 }
    );
  }

  const league = await getClassicLeague(leagueId);

  if (!league) {
    return NextResponse.json(
      { error: `Failed to fetch league ${leagueId}` },
      { status: 500 }
    );
  }

  const standings = league.standings.results as LeagueEntry[];

  const players: Player[] = (await getPlayers()) ?? [];

  const data = await Promise.all(
    standings.map(async (entry) => {
      const transfers: Transfer[] = (await getTeamTransfers(entry.entry)) ?? [];

      const gwTransfers = transfers.filter((t) => t.event === gw);

      const mapped = gwTransfers.map((t) => {
        const playerIn = players.find((p) => p.id === t.element_in);
        const playerOut = players.find((p) => p.id === t.element_out);
        return {
          in: playerIn?.web_name ?? "Unknown",
          out: playerOut?.web_name ?? "Unknown",
        };
      });

      return {
        manager: entry.player_name,
        team: entry.entry_name,
        transfers: mapped,
        count: gwTransfers.length,
        // cost removed here, since not available in /transfers endpoint
      };
    })
  );

  return NextResponse.json(data);
}
