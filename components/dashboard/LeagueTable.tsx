"use client";

import useSWR from "swr";
import { ChevronUp, ChevronDown, Minus } from "lucide-react";
import { EnrichedStanding } from "@/types/fpl";
import { ResponsiveInfoCard } from "@/components/ui/responsive-info-card"; // ✅ import

const fetcher = (url: string) => fetch(url).then((res) => res.json());

interface StandingsResponse {
  standings: EnrichedStanding[];
  stats: {
    mostPoints: EnrichedStanding;
    fewestPoints: EnrichedStanding;
    mostBench: EnrichedStanding;
    mostTransfers: EnrichedStanding;
  };
}

export function LeagueTable({
  leagueId,
  gw,
  currentGw,
}: {
  leagueId: number;
  gw: number;
  currentGw: number;
}) {
  const { data, error } = useSWR<StandingsResponse>(
    `/api/standings?leagueId=${leagueId}&gw=${gw}&currentGw=${currentGw}`,
    fetcher,
    { refreshInterval: 30000 }
  );

  if (error) return <div>Error loading standings</div>;
  if (!data) return <div>Loading...</div>;

  const { standings } = data;

  return (
    <div
      className="
        w-full overflow-x-auto rounded-md border border-border
        h-auto overflow-y-visible
        sm:h-[calc(100vh-435px)] sm:overflow-y-auto
      "
    >
      <table className="w-full table-auto text-sm">
        <thead className="sticky top-0 bg-muted z-10">
          <tr className="border-b text-foreground font-semibold">
            <th className="p-2 sm:p-4 text-left w-6/100">
              Pos
            </th>
            <th className="p-2 sm:p-4 text-left w-22/100">
              Team
            </th>
            <th className="p-2 sm:p-4 text-left w-22/100">
              Manager
            </th>
            <th className="p-2 sm:p-4 text-right w-10/100">
              GW Points
            </th>
            <th className="p-2 sm:p-4 text-right w-10/100">
              Transfers
            </th>
            <th className="p-2 sm:p-4 text-right w-10/100">
              Hit
            </th>
            <th className="p-2 sm:p-4 text-right w-10/100">
              Bench Points
            </th>
            <th className="p-2 sm:p-4 text-right w-10/100">
              Total Points
            </th>
          </tr>
        </thead>
        <tbody>
          {standings.map((entry) => (
            <tr
              key={entry.entry}
              className="border-b hover:bg-muted/30 last:border-b-0 transition-colors"
            >
              {/* Position + movement */}
              <td className="p-2 sm:p-4 font-mono">
                <div className="flex items-center gap-1">
                  <span>{entry.rank}</span>
                  {entry.movement > 0 && (
                    <ChevronUp className="h-4 w-4 text-green-600" />
                  )}
                  {entry.movement < 0 && (
                    <ChevronDown className="h-4 w-4 text-red-600" />
                  )}
                  {entry.movement === 0 && (
                    <Minus className="h-4 w-4 text-muted-foreground" />
                  )}
                </div>
              </td>

              {/* Team + Manager */}
              <td className="p-2 sm:p-4">{entry.entry_name}</td>
              <td className="p-2 sm:p-4">{entry.player_name}</td>

              {/* GW Points with hover/popover */}
              <td className="p-2 sm:p-4 text-right font-mono">
                <ResponsiveInfoCard
                  trigger={
                    <button className="cursor-pointer underline decoration-dotted">
                      {entry.gwPoints}
                    </button>
                  }
                  content={
                    entry.gwPlayers && entry.gwPlayers.length > 0 ? (
                      <ul className="space-y-1 text-sm">
                        {entry.gwPlayers.map((p, i) => (
                          <li
                            key={i}
                            className="flex justify-between text-muted-foreground"
                          >
                            <span>
                              {p.name}
                              {p.isCaptain && " (C)"}
                              {p.isViceCaptain && " (VC)"}
                            </span>
                            <span className="font-mono">{p.points}</span>
                          </li>
                        ))}
                      </ul>
                    ) : (
                      <p className="text-muted-foreground text-xs">No data</p>
                    )
                  }
                  className="w-72 p-2 rounded-sm border bg-popover text-popover-foreground shadow-sm"
                />
              </td>

              {/* Transfers with hover/popover */}
              <td className="p-2 sm:p-4 text-right font-mono">
                <ResponsiveInfoCard
                  trigger={
                    <button className="cursor-pointer underline decoration-dotted">
                      {entry.transfers}
                    </button>
                  }
                  content={
                    entry.transfersList && entry.transfersList.length > 0 ? (
                      <ul className="space-y-1 text-sm">
                        {entry.transfersList.map((t, i) => (
                          <li key={i}>
                            <span className="text-muted-foreground">
                              {t.out}
                            </span>
                            <span className="text-muted-foreground mx-2">→</span>
                            <span className="text-muted-foreground">
                              {t.in}
                            </span>
                          </li>
                        ))}
                      </ul>
                    ) : (
                      <p className="text-muted-foreground text-sm">
                        No transfers
                      </p>
                    )
                  }
                  className="w-64 p-2 rounded-sm border bg-popover text-popover-foreground shadow-sm"
                />
              </td>

              {/* Hit */}
              <td className="p-2 sm:p-4 text-right font-mono">
                {entry.hit}
              </td>

              {/* Bench Points with hover/popover */}
              <td className="p-2 sm:p-4 text-right font-mono">
                <ResponsiveInfoCard
                  trigger={
                    <button className="cursor-pointer underline decoration-dotted">
                      {entry.benchPoints}
                    </button>
                  }
                  content={
                    entry.benchPlayers && entry.benchPlayers.length > 0 ? (
                      <ul className="space-y-1 text-sm">
                        {entry.benchPlayers.map((p, i) => (
                          <li
                            key={i}
                            className="flex justify-between text-muted-foreground"
                          >
                            <span>{p.name}</span>
                            <span className="font-mono">{p.points}</span>
                          </li>
                        ))}
                      </ul>
                    ) : (
                      <p className="text-muted-foreground text-xs">
                        No bench players
                      </p>
                    )
                  }
                  className="w-64 p-2 rounded-sm border bg-popover text-popover-foreground shadow-sm"
                />
              </td>

              {/* Total Points */}
              <td className="p-2 sm:p-4 text-right font-mono">
                {entry.totalPoints}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}