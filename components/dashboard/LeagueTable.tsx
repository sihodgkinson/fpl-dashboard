"use client";

import useSWR from "swr";
import { ChevronUp, ChevronDown, Minus } from "lucide-react";
import { EnrichedStanding } from "@/types/fpl";

const fetcher = (url: string) => fetch(url).then((res) => res.json());

export function LeagueTable({
  leagueId,
  gw,
  currentGw,
}: {
  leagueId: number;
  gw: number;
  currentGw: number;
}) {
  const { data, error } = useSWR<EnrichedStanding[]>(
    `/api/standings?leagueId=${leagueId}&gw=${gw}&currentGw=${currentGw}`,
    fetcher,
    { refreshInterval: 30000 } // auto-refresh every 30s
  );

  if (error) return <div>Error loading standings</div>;
  if (!data) return <div>Loading...</div>;

  return (
    <div className="w-full overflow-x-auto rounded-md border border-border overflow-hidden">
      <table className="w-full table-auto text-sm">
        <thead>
          <tr className="border-b bg-muted/50 text-foreground">
            <th className="px-4 py-2 text-left">Pos</th>
            <th className="px-4 py-2 text-left">Team</th>
            <th className="px-4 py-2 text-left">Manager</th>
            <th className="px-4 py-2 text-right">GW Points</th>
            <th className="px-4 py-2 text-right">Transfers</th>
            <th className="px-4 py-2 text-right">Hit</th>
            <th className="px-4 py-2 text-right">Bench Points</th>
            <th className="px-4 py-2 text-right">Total Points</th>
          </tr>
        </thead>
        <tbody>
          {data.map((entry) => (
            <tr
              key={entry.entry}
              className="border-b hover:bg-muted/30 last:border-b-0 transition-colors"
            >
              <td className="px-4 py-2 font-mono">
                <div className="flex items-center gap-1">
                  <span>{entry.rank}</span>
                  {entry.movement && entry.movement > 0 && (
                    <ChevronUp className="h-4 w-4 text-green-600" />
                  )}
                  {entry.movement && entry.movement < 0 && (
                    <ChevronDown className="h-4 w-4 text-red-600" />
                  )}
                  {entry.movement === 0 && (
                    <Minus className="h-4 w-4 text-muted-foreground" />
                  )}
                </div>
              </td>
              <td className="px-4 py-2">{entry.entry_name}</td>
              <td className="px-4 py-2">{entry.player_name}</td>
              <td className="px-4 py-2 text-right font-mono">
                {entry.gwPoints}
              </td>
              <td className="px-4 py-2 text-right font-mono">
                {entry.transfers}
              </td>
              <td className="px-4 py-2 text-right font-mono">{entry.hit}</td>
              <td className="px-4 py-2 text-right font-mono">
                {entry.benchPoints}
              </td>
              <td className="px-4 py-2 text-right font-mono">
                {entry.totalPoints}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}