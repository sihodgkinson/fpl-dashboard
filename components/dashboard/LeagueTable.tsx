"use client";

import useSWR from "swr";
import { ChevronUp, ChevronDown, Minus } from "lucide-react";
import { EnrichedStanding } from "@/types/fpl";
import { ResponsiveInfoCard } from "@/components/ui/responsive-info-card";
import { Skeleton } from "@/components/ui/skeleton";

const fetcher = (url: string) => fetch(url).then((res) => res.json());

interface StandingsResponse {
  standings: EnrichedStanding[];
}

interface LeagueTableProps {
  leagueId: number;
  gw: number;
  currentGw: number;
  preloadedStandings?: EnrichedStanding[] | null;
}

// ✅ Skeleton row
function TableRowSkeleton() {
  return (
    <tr className="animate-pulse">
      <td className="p-2 sm:p-4">
        <Skeleton className="h-4 w-6" />
      </td>
      <td className="p-2 sm:p-4">
        <Skeleton className="h-4 w-32 mb-1" />
        <Skeleton className="h-3 w-20" />
      </td>
      <td className="p-2 sm:p-4 hidden sm:table-cell">
        <Skeleton className="h-4 w-28" />
      </td>
      <td className="p-2 sm:p-4 text-right">
        <Skeleton className="h-4 w-10" />
      </td>
      <td className="p-2 sm:p-4 text-right hidden sm:table-cell">
        <Skeleton className="h-4 w-8" />
      </td>
      <td className="p-2 sm:p-4 text-right hidden sm:table-cell">
        <Skeleton className="h-4 w-8" />
      </td>
      <td className="p-2 sm:p-4 text-right hidden sm:table-cell">
        <Skeleton className="h-4 w-8" />
      </td>
      <td className="p-2 sm:p-4 text-right">
        <Skeleton className="h-4 w-10" />
      </td>
    </tr>
  );
}

export function LeagueTable({
  leagueId,
  gw,
  currentGw,
  preloadedStandings,
}: LeagueTableProps) {
  const shouldUsePreloaded = preloadedStandings && gw === currentGw;

  const { data, error } = useSWR<StandingsResponse>(
    shouldUsePreloaded
      ? null
      : `/api/standings?leagueId=${leagueId}&gw=${gw}&currentGw=${currentGw}`,
    fetcher,
    { refreshInterval: 30000 }
  );

  if (error) return <div>Error loading standings</div>;

  // ✅ Decide which standings to use
  const standings = shouldUsePreloaded
    ? preloadedStandings!
    : data?.standings ?? [];

  const isLoading = !shouldUsePreloaded && !data;

  return (
    <div className="w-full overflow-x-auto rounded-md border border-border h-auto lg:h-[calc(100vh-435px)] sm:overflow-y-auto">
      <table className="w-full table-auto text-sm">
        <thead className="sticky top-0 bg-muted dark:bg-card z-10">
          <tr className="border-b text-foreground font-semibold">
            <th className="p-2 sm:p-4 text-left w-3/100">Pos</th>
            <th className="p-2 sm:p-4 text-left w-25/100">Team</th>
            <th className="p-2 sm:p-4 text-left w-22/100 hidden sm:table-cell">
              Manager
            </th>
            <th className="p-2 sm:p-4 text-right w-10/100">GW Points</th>
            <th className="p-2 sm:p-4 text-right w-10/100 hidden sm:table-cell">
              Transfers
            </th>
            <th className="p-2 sm:p-4 text-right w-10/100 hidden sm:table-cell">
              Hit
            </th>
            <th className="p-2 sm:p-4 text-right w-10/100 hidden sm:table-cell">
              Bench Points
            </th>
            <th className="p-2 sm:p-4 text-right w-10/100">Total Points</th>
          </tr>
        </thead>
        <tbody>
          {isLoading
            ? [...Array(5)].map((_, i) => <TableRowSkeleton key={i} />)
            : standings.map((entry) => (
                <tr
                  key={entry.entry}
                  className="border-b hover:bg-muted/30 last:border-b-0 transition-colors opacity-0 animate-fadeIn"
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

                  {/* Team */}
                  <td className="p-2 sm:p-4">
                    <div className="font-medium">{entry.entry_name}</div>
                    <div className="text-muted-foreground text-xs block sm:hidden">
                      {entry.player_name}
                    </div>
                  </td>

                  {/* Manager */}
                  <td className="p-2 sm:p-4 hidden sm:table-cell">
                    {entry.player_name}
                  </td>

                  {/* GW Points */}
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
                      className="w-48 p-3 rounded-sm border bg-popover text-popover-foreground shadow-sm"
                    />
                  </td>

                  {/* Transfers */}
                  <td className="p-2 sm:p-4 text-right font-mono hidden sm:table-cell">
                    {entry.transfers}
                  </td>

                  {/* Hit */}
                  <td className="p-2 sm:p-4 text-right font-mono hidden sm:table-cell">
                    {entry.hit}
                  </td>

                  {/* Bench Points */}
                  <td className="p-2 sm:p-4 text-right font-mono hidden sm:table-cell">
                    {entry.benchPoints}
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