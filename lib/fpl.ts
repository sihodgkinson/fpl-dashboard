// lib/fpl.ts
import { ClassicLeagueResponse } from "@/types/fpl";

export async function getClassicLeague(
  leagueId: number
): Promise<ClassicLeagueResponse> {
  const res = await fetch(
    `https://fantasy.premierleague.com/api/leagues-classic/${leagueId}/standings/`,
    {
      next: { revalidate: 60 }, // ISR: revalidate every 60s
    }
  );

  if (!res.ok) {
    throw new Error(`Failed to fetch league ${leagueId}`);
  }

  return res.json();
}