"use client";

import { ChevronUp, ChevronDown, Minus } from "lucide-react";
import { ResponsiveInfoCard } from "@/components/ui/responsive-info-card";
import { Skeleton } from "@/components/ui/skeleton";

export interface GW1Standing {
  entry: number;
  entry_name: string;
  player_name: string;
  rank: number;
  movement: number;
  gwPoints: number;
  totalPoints: number;
  benchPoints: number;
  gwPlayers: {
    name: string;
    points: number;
    isCaptain: boolean;
    isViceCaptain: boolean;
  }[];
  benchPlayers: {
    name: string;
    points: number;
  }[];
}

interface GW1TableProps {
  standings: GW1Standing[];
  isLoading: boolean;
  hasError: boolean;
}

function TableRowSkeleton() {
  return (
    <tr className="animate-pulse">
      <td className="p-2 sm:p-4">
        <Skeleton className="h-4 w-6" />
      </td>
      <td className="p-2 sm:p-4">
        <Skeleton className="mb-1 h-4 w-32" />
        <Skeleton className="h-3 w-20" />
      </td>
      <td className="hidden p-2 md:table-cell sm:p-4">
        <Skeleton className="h-4 w-28" />
      </td>
      <td className="p-2 text-right sm:p-4">
        <Skeleton className="h-4 w-10" />
      </td>
      <td className="hidden p-2 text-right sm:table-cell sm:p-4">
        <Skeleton className="h-4 w-8" />
      </td>
      <td className="p-2 text-right sm:p-4">
        <Skeleton className="h-4 w-10" />
      </td>
    </tr>
  );
}

export function GW1Table({ standings, isLoading, hasError }: GW1TableProps) {
  if (hasError) return <div>Error loading GW1 table</div>;

  return (
    <div className="mobile-landscape-table w-full overflow-x-auto rounded-md border border-border sm:h-full sm:overflow-auto">
      <table className="w-full table-auto text-sm">
        <thead className="sticky top-0 z-10 bg-muted dark:bg-card">
          <tr className="border-b font-semibold text-foreground">
            <th className="w-3/100 p-2 text-left sm:p-4">Pos</th>
            <th className="w-25/100 p-2 text-left sm:p-4">Team</th>
            <th className="hidden w-22/100 p-2 text-left md:table-cell sm:p-4">Manager</th>
            <th className="w-10/100 p-2 text-right sm:p-4">GW Points</th>
            <th className="hidden w-10/100 p-2 text-right sm:table-cell sm:p-4">
              Bench Points
            </th>
            <th className="w-10/100 p-2 text-right sm:p-4">Total Points</th>
          </tr>
        </thead>
        <tbody>
          {isLoading
            ? [...Array(5)].map((_, i) => <TableRowSkeleton key={i} />)
            : standings.length > 0
              ? standings.map((entry) => (
                  <tr
                    key={entry.entry}
                    className="border-b transition-colors last:border-b-0 hover:bg-muted/30"
                  >
                    <td className="p-2 font-mono sm:p-4">
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

                    <td className="p-2 sm:p-4">
                      <div className="font-medium">{entry.entry_name}</div>
                      <div className="block text-xs text-muted-foreground md:hidden">
                        {entry.player_name}
                      </div>
                    </td>

                    <td className="hidden p-2 md:table-cell sm:p-4">{entry.player_name}</td>

                    <td className="p-2 text-right font-mono sm:p-4">
                      {entry.gwPoints > 0 ? (
                        <ResponsiveInfoCard
                          trigger={
                            <button className="cursor-pointer underline decoration-dotted">
                              {entry.gwPoints}
                            </button>
                          }
                          content={
                            entry.gwPlayers.length > 0 ? (
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
                              <p className="text-xs text-muted-foreground">No data</p>
                            )
                          }
                          className="max-w-[90vw] rounded-sm border bg-popover p-3 text-popover-foreground shadow-sm"
                        />
                      ) : (
                        <span>{entry.gwPoints}</span>
                      )}
                    </td>

                    <td className="hidden p-2 text-right font-mono sm:table-cell sm:p-4">
                      {entry.benchPoints > 0 ? (
                        <ResponsiveInfoCard
                          trigger={
                            <button className="cursor-pointer underline decoration-dotted">
                              {entry.benchPoints}
                            </button>
                          }
                          content={
                            entry.benchPlayers.length > 0 ? (
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
                              <p className="text-xs text-muted-foreground">No bench players</p>
                            )
                          }
                          className="max-w-[90vw] rounded-sm border bg-popover p-3 text-popover-foreground shadow-sm"
                        />
                      ) : (
                        <span>{entry.benchPoints}</span>
                      )}
                    </td>

                    <td className="p-2 text-right font-mono sm:p-4">{entry.totalPoints}</td>
                  </tr>
                ))
              : (
                  <tr>
                    <td colSpan={6} className="p-4 text-center text-muted-foreground">
                      No standings available
                    </td>
                  </tr>
                )}
        </tbody>
      </table>
    </div>
  );
}
