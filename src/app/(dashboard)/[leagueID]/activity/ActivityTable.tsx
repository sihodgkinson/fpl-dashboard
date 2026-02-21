"use client";

import useSWR from "swr";
import { useSearchParams } from "next/navigation";
import { ChevronDown, ChevronUp, Minus } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";

const fetcher = (url: string) => fetch(url).then((res) => res.json());

interface ActivityImpactRow {
  entryId: number;
  pos: number;
  movement: number;
  team: string;
  manager: string;
  chip: string | null;
  transfers: Array<{ in: string; out: string; impact: number }>;
  transferImpactNet: number;
  chipImpact: number;
  gwDecisionScore: number;
  runningInfluenceTotal: number;
}

function formatChipName(chip: string | null): string {
  if (!chip) return "—";
  switch (chip) {
    case "wildcard":
      return "Wildcard";
    case "3xc":
      return "Triple Captain";
    case "bboost":
      return "Bench Boost";
    case "freehit":
      return "Free Hit";
    default:
      return chip;
  }
}

function formatSignedNumber(value: number): string {
  if (value > 0) return `+${value}`;
  return String(value);
}

function scoreClass(value: number): string {
  if (value > 0) return "text-green-600 dark:text-green-400";
  if (value < 0) return "text-red-600 dark:text-red-400";
  return "text-muted-foreground";
}

function ActivityRowSkeleton() {
  return (
    <tr className="animate-pulse">
      <td className="p-2 sm:p-4">
        <Skeleton className="h-4 w-8" />
      </td>
      <td className="p-2 sm:p-4">
        <Skeleton className="mb-1 h-4 w-32" />
        <Skeleton className="h-3 w-20" />
      </td>
      <td className="hidden p-2 sm:table-cell sm:p-4">
        <Skeleton className="h-4 w-28" />
      </td>
      <td className="p-2 sm:p-4">
        <Skeleton className="h-4 w-24" />
      </td>
      <td className="p-2 sm:p-4">
        <Skeleton className="mb-1 h-4 w-40" />
        <Skeleton className="h-4 w-36" />
      </td>
      <td className="p-2 text-right sm:p-4">
        <Skeleton className="ml-auto h-4 w-12" />
      </td>
      <td className="hidden p-2 text-right sm:table-cell sm:p-4">
        <Skeleton className="ml-auto h-4 w-10" />
      </td>
      <td className="p-2 text-right sm:p-4">
        <Skeleton className="ml-auto h-4 w-12" />
      </td>
      <td className="p-2 text-right sm:p-4">
        <Skeleton className="ml-auto h-4 w-14" />
      </td>
    </tr>
  );
}

export function ActivityTab({
  leagueId,
  currentGw,
}: {
  leagueId: number;
  currentGw: number;
}) {
  const searchParams = useSearchParams();
  const gw = Number(searchParams.get("gw")) || currentGw;

  const { data, error } = useSWR<ActivityImpactRow[]>(
    `/api/activity-impact?leagueId=${leagueId}&gw=${gw}&currentGw=${currentGw}`,
    fetcher,
    { refreshInterval: 0, revalidateOnFocus: false }
  );

  if (error) return <div>Error loading activity</div>;

  return (
    <div className="mobile-landscape-table w-full overflow-x-auto rounded-md border border-border sm:h-full sm:overflow-auto">
      <table className="w-full table-auto text-sm">
        <thead className="sticky top-0 z-10 bg-muted">
          <tr className="border-b bg-card font-semibold text-foreground">
            <th className="p-2 text-left sm:p-4">Pos</th>
            <th className="p-2 text-left sm:p-4">Team</th>
            <th className="hidden p-2 text-left sm:table-cell sm:p-4">Manager</th>
            <th className="p-2 text-left sm:p-4">Chips Used</th>
            <th className="p-2 text-left sm:p-4">Transfers</th>
            <th className="p-2 text-right sm:p-4">Transfer Net</th>
            <th className="hidden p-2 text-right sm:table-cell sm:p-4">Chip Impact</th>
            <th className="p-2 text-right sm:p-4">GW Score</th>
            <th className="p-2 text-right sm:p-4">Influence Total</th>
          </tr>
        </thead>
        <tbody>
          {!data
            ? [...Array(5)].map((_, i) => <ActivityRowSkeleton key={i} />)
            : data.map((row) => (
                <tr
                  key={row.entryId}
                  className="border-b transition-colors last:border-b-0 hover:bg-muted/30"
                >
                  <td className="p-2 font-mono sm:p-4">
                    <div className="flex items-center gap-1">
                      <span>{row.pos}</span>
                      {row.movement > 0 ? (
                        <ChevronUp className="h-4 w-4 text-green-600" />
                      ) : row.movement < 0 ? (
                        <ChevronDown className="h-4 w-4 text-red-600" />
                      ) : (
                        <Minus className="h-4 w-4 text-muted-foreground" />
                      )}
                    </div>
                  </td>

                  <td className="p-2 sm:p-4">
                    <div className="font-medium">{row.team}</div>
                    <div className="mt-0.5 block text-xs text-muted-foreground sm:hidden">
                      {row.manager}
                    </div>
                  </td>

                  <td className="hidden p-2 sm:table-cell sm:p-4">{row.manager}</td>

                  <td className="p-2 sm:p-4">
                    {row.chip ? (
                      <span>{formatChipName(row.chip)}</span>
                    ) : (
                      <span className="text-muted-foreground">—</span>
                    )}
                  </td>

                  <td className="p-2 sm:p-4">
                    {row.transfers.length > 0 ? (
                      <div className="space-y-1">
                        {row.transfers.map((transfer, index) => (
                          <div key={index}>
                            {transfer.out} → {transfer.in}{" "}
                            <span className={scoreClass(transfer.impact)}>
                              ({formatSignedNumber(transfer.impact)})
                            </span>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <span className="text-muted-foreground">—</span>
                    )}
                  </td>

                  <td className={`p-2 text-right font-mono sm:p-4 ${scoreClass(row.transferImpactNet)}`}>
                    {formatSignedNumber(row.transferImpactNet)}
                  </td>

                  <td className={`hidden p-2 text-right font-mono sm:table-cell sm:p-4 ${scoreClass(row.chipImpact)}`}>
                    {formatSignedNumber(row.chipImpact)}
                  </td>

                  <td className={`p-2 text-right font-mono sm:p-4 ${scoreClass(row.gwDecisionScore)}`}>
                    {formatSignedNumber(row.gwDecisionScore)}
                  </td>

                  <td className={`p-2 text-right font-mono sm:p-4 ${scoreClass(row.runningInfluenceTotal)}`}>
                    {formatSignedNumber(row.runningInfluenceTotal)}
                  </td>
                </tr>
              ))}
        </tbody>
      </table>
    </div>
  );
}
