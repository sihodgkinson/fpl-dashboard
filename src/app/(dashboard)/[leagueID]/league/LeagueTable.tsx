"use client";

import { ChevronUp, ChevronDown, Minus } from "lucide-react";
import { EnrichedStanding } from "@/types/fpl";
import { ResponsiveInfoCard } from "@/components/ui/responsive-info-card";
import { Skeleton } from "@/components/ui/skeleton";

interface LeagueTableProps {
  standings: EnrichedStanding[];
  isLoading: boolean;
  hasError: boolean;
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
      <td className="p-2 hidden md:table-cell sm:p-4">
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
  standings,
  isLoading,
  hasError,
}: LeagueTableProps) {
  if (hasError) return <div>Error loading standings</div>;

  return (
    <div className="w-full overflow-x-auto rounded-md border border-border sm:h-full sm:overflow-auto mobile-landscape-table">
      <table className="w-full table-auto text-sm">
        <thead className="sticky top-0 z-10 bg-muted dark:bg-card [&_th]:h-10 [&_th]:!py-0 [&_th]:font-normal">
          <tr className="border-b text-foreground font-normal">
            <th className="p-2 sm:p-4 text-left w-3/100">Pos</th>
            <th className="p-2 sm:p-4 text-left w-25/100">Team</th>
            <th className="p-2 hidden md:table-cell sm:p-4 text-left w-22/100">
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
            : standings.length > 0
            ? standings.map((entry) => (
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

                  {/* Team */}
                  <td className="p-2 sm:p-4">
                    <div className="font-medium">{entry.entry_name}</div>
                    <div className="text-muted-foreground text-xs block md:hidden">
                      {entry.player_name}
                    </div>
                  </td>

                  {/* Manager */}
                  <td className="p-2 hidden md:table-cell sm:p-4">
                    {entry.player_name}
                  </td>

                  {/* GW Points */}
                  <td className="p-2 sm:p-4 text-right font-mono">
                    {entry.gwPoints > 0 ? (
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
                                  className="flex items-center justify-between gap-4 text-muted-foreground"
                                >
                                  <span className="pr-2">
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
                        className="max-w-[90vw] rounded-sm border bg-popover p-3 text-popover-foreground shadow-sm"
                      />
                    ) : (
                      <span>{entry.gwPoints}</span>
                    )}
                  </td>

                  {/* Transfers */}
                  {/* Transfers */}
                  <td className="p-2 sm:p-4 text-right font-mono hidden sm:table-cell">
                    {entry.transfers > 0 ? (
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
                                  <span className="text-muted-foreground">{t.out}</span>
                                  <span className="text-muted-foreground mx-2">→</span>
                                  <span className="text-muted-foreground">{t.in}</span>
                                </li>
                              ))}
                            </ul>
                          ) : (
                            <p className="text-muted-foreground text-sm">No transfers</p>
                          )
                        }
                        className="max-w-[90vw] rounded-sm border bg-popover p-3 text-popover-foreground shadow-sm"
                      />
                    ) : (
                      <span>{entry.transfers}</span>
                    )}
                  </td>

                  {/* Hit */}
                  <td className="p-2 sm:p-4 text-right font-mono hidden sm:table-cell">
                    {entry.hit}
                  </td>

                  {/* Bench Points */}
                  <td className="p-2 sm:p-4 text-right font-mono hidden sm:table-cell">
                    {entry.benchPoints > 0 ? (
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
                                  className="flex items-center justify-between gap-4 text-muted-foreground"
                                >
                                  <span className="pr-2">{p.name}</span>
                                  <span className="font-mono">{p.points}</span>
                                </li>
                              ))}
                            </ul>
                          ) : (
                            <p className="text-muted-foreground text-xs">No bench players</p>
                          )
                        }
                        className="max-w-[90vw] rounded-sm border bg-popover p-3 text-popover-foreground shadow-sm"
                      />
                    ) : (
                      <span>{entry.benchPoints}</span>
                    )}
                  </td>

                  {/* Total Points */}
                  <td className="p-2 sm:p-4 text-right font-mono">
                    {entry.totalPoints}
                  </td>
                </tr>
              ))
            : (
              <tr>
                <td
                  colSpan={8}
                  className="text-center text-muted-foreground p-4"
                >
                  No standings available
                </td>
              </tr>
            )}
        </tbody>
      </table>
    </div>
  );
}
