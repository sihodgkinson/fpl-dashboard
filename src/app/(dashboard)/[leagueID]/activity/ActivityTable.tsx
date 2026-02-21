"use client";

import useSWR from "swr";
import { useSearchParams } from "next/navigation";
import { ChevronDown, ChevronUp, Minus } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { ResponsiveInfoCard } from "@/components/ui/responsive-info-card";

const fetcher = (url: string) => fetch(url).then((res) => res.json());

interface ActivityImpactRow {
  entryId: number;
  pos: number;
  movement: number;
  team: string;
  manager: string;
  chip: string | null;
  chipCaptainName: string | null;
  transfers: Array<{ in: string; out: string; impact: number }>;
  transferImpactNet: number;
  chipImpact: number;
  captainImpact: number;
  previousCaptainName: string | null;
  previousCaptainPoints: number | null;
  currentCaptainName: string | null;
  currentCaptainPoints: number | null;
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
      <td className="hidden p-2 md:table-cell sm:p-4">
        <Skeleton className="h-4 w-28" />
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
      <td className="hidden p-2 text-right sm:table-cell sm:p-4">
        <Skeleton className="ml-auto h-4 w-10" />
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
            <th className="p-2 text-left sm:p-4 w-3/100">Pos</th>
            <th className="p-2 text-left sm:p-4 w-25/100">Team</th>
            <th className="hidden p-2 text-left md:table-cell sm:p-4 w-22/100">Manager</th>
            <th className="hidden p-2 text-right sm:table-cell sm:p-4 w-10/100">
              <div className="inline-flex items-center justify-end">
                <ResponsiveInfoCard
                  trigger={
                    <button
                      type="button"
                      className="cursor-pointer underline decoration-dotted"
                      aria-label="How Transfer Net is calculated"
                    >
                      Transfers
                    </button>
                  }
                  content={
                    <div className="space-y-2 text-sm text-muted-foreground leading-relaxed">
                      <p className="font-medium text-foreground">
                        How Transfer Impact is calculated
                      </p>
                      <p>
                        <span className="text-foreground">Transfer Impact</span> = points from
                        players bought
                        {" \u2212 "}points from players sold{" \u2212 "}transfer hit cost.
                      </p>
                      <p>For Free Hit, transfer hit cost is always treated as 0.</p>
                    </div>
                  }
                  className="w-72 rounded-sm border bg-popover p-3 text-popover-foreground shadow-sm"
                />
              </div>
            </th>
            <th className="hidden p-2 text-right sm:table-cell sm:p-4 w-10/100">
              <div className="inline-flex items-center justify-end">
                <ResponsiveInfoCard
                  trigger={
                    <button
                      type="button"
                      className="cursor-pointer underline decoration-dotted"
                      aria-label="How Chip Impact is calculated"
                    >
                      Chips
                    </button>
                  }
                  content={
                    <div className="space-y-2 text-sm text-muted-foreground leading-relaxed">
                      <p className="font-medium text-foreground">How Chip Impact is calculated</p>
                      <p>
                        <span className="text-foreground">Chip Impact</span> = extra points
                        gained from chip effects in this GW.
                      </p>
                      <p>Bench Boost: bench points.</p>
                      <p>Triple Captain: extra captain points from the third multiplier.</p>
                      <p>Wildcard and Free Hit: currently 0 impact.</p>
                    </div>
                  }
                  className="w-72 rounded-sm border bg-popover p-3 text-popover-foreground shadow-sm"
                />
              </div>
            </th>
            <th className="hidden p-2 text-right sm:table-cell sm:p-4 w-10/100">
              <div className="inline-flex items-center justify-end">
                <ResponsiveInfoCard
                  trigger={
                    <button
                      type="button"
                      className="cursor-pointer underline decoration-dotted"
                      aria-label="How Captain Impact is calculated"
                    >
                      Captain
                    </button>
                  }
                  content={
                    <div className="space-y-2 text-sm text-muted-foreground leading-relaxed">
                      <p className="font-medium text-foreground">
                        How Captain Impact is calculated
                      </p>
                      <p>
                        If captain changed from last GW:
                        {" "}
                        <span className="text-foreground">
                          2 × (new captain points − previous captain points)
                        </span>
                        .
                      </p>
                      <p>If captain did not change, impact is 0.</p>
                      <p>If the old captain left the squad, impact is 0 (covered by transfers).</p>
                    </div>
                  }
                  className="w-80 rounded-sm border bg-popover p-3 text-popover-foreground shadow-sm"
                />
              </div>
            </th>
            <th className="p-2 text-right sm:p-4 w-10/100">GW Gain</th>
            <th className="p-2 text-right sm:p-4 w-10/100">Total Gain</th>
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
                    <div className="block text-xs text-muted-foreground md:hidden">
                      {row.manager}
                    </div>
                  </td>

                  <td className="hidden p-2 md:table-cell sm:p-4">{row.manager}</td>

                  <td
                    className={`hidden p-2 text-right font-mono sm:table-cell sm:p-4 ${scoreClass(
                      row.transferImpactNet
                    )}`}
                  >
                    {row.transfers.length > 0 ? (
                      <ResponsiveInfoCard
                        trigger={
                          <button className="cursor-pointer underline decoration-dotted">
                            {formatSignedNumber(row.transferImpactNet)}
                          </button>
                        }
                        content={
                          <ul className="space-y-1 text-sm">
                            {row.transfers.map((transfer, index) => (
                              <li key={index}>
                                <span className="text-muted-foreground">{transfer.out}</span>
                                <span className="mx-2 text-muted-foreground">→</span>
                                <span className="text-muted-foreground">{transfer.in}</span>{" "}
                                <span className={scoreClass(transfer.impact)}>
                                  ({formatSignedNumber(transfer.impact)})
                                </span>
                              </li>
                            ))}
                          </ul>
                        }
                        className="w-64 rounded-sm border bg-popover p-3 text-popover-foreground shadow-sm"
                      />
                    ) : (
                      <span>{formatSignedNumber(row.transferImpactNet)}</span>
                    )}
                  </td>

                  <td className={`hidden p-2 text-right font-mono sm:table-cell sm:p-4 ${scoreClass(row.chipImpact)}`}>
                    {row.chip ? (
                      <ResponsiveInfoCard
                        trigger={
                          <button className="cursor-pointer underline decoration-dotted">
                            {formatSignedNumber(row.chipImpact)}
                          </button>
                        }
                        content={
                          <div className="text-sm text-muted-foreground">
                            {row.chip === "3xc" ? (
                              <>
                                <span>Triple Captain</span>
                                {row.chipCaptainName ? (
                                  <>
                                    <span className="mx-2">→</span>
                                    <span>{row.chipCaptainName}</span>
                                  </>
                                ) : null}
                              </>
                            ) : (
                              formatChipName(row.chip)
                            )}
                          </div>
                        }
                        className="w-56 rounded-sm border bg-popover p-3 text-popover-foreground shadow-sm"
                      />
                    ) : (
                      <span>{formatSignedNumber(row.chipImpact)}</span>
                    )}
                  </td>

                  <td className={`hidden p-2 text-right font-mono sm:table-cell sm:p-4 ${scoreClass(row.captainImpact)}`}>
                    {row.previousCaptainName && row.currentCaptainName ? (
                      <ResponsiveInfoCard
                        trigger={
                          <button className="cursor-pointer underline decoration-dotted">
                            {formatSignedNumber(row.captainImpact)}
                          </button>
                        }
                        content={
                          <div className="text-sm text-muted-foreground">
                            <span>{row.previousCaptainName}</span>
                            <span className="ml-1">
                              ({row.previousCaptainPoints ?? 0})
                            </span>
                            <span className="mx-2">→</span>
                            <span>{row.currentCaptainName}</span>
                            <span className="ml-1">
                              ({row.currentCaptainPoints ?? 0})
                            </span>
                          </div>
                        }
                        className="w-64 rounded-sm border bg-popover p-3 text-popover-foreground shadow-sm"
                      />
                    ) : (
                      <span>{formatSignedNumber(row.captainImpact)}</span>
                    )}
                  </td>

                  <td className={`p-2 text-right font-mono sm:p-4 ${scoreClass(row.gwDecisionScore)}`}>
                    <ResponsiveInfoCard
                      trigger={
                        <button className="cursor-pointer underline decoration-dotted">
                          {formatSignedNumber(row.gwDecisionScore)}
                        </button>
                      }
                      content={
                        <div className="space-y-1 text-sm">
                          <div className="flex items-center justify-between gap-3">
                            <span className="text-muted-foreground">Transfer Impact</span>
                            <span className={scoreClass(row.transferImpactNet)}>
                              {formatSignedNumber(row.transferImpactNet)}
                            </span>
                          </div>
                          <div className="flex items-center justify-between gap-3">
                            <span className="text-muted-foreground">Chip Impact</span>
                            <span className={scoreClass(row.chipImpact)}>
                              {formatSignedNumber(row.chipImpact)}
                            </span>
                          </div>
                          <div className="flex items-center justify-between gap-3">
                            <span className="text-muted-foreground">Captain Impact</span>
                            <span className={scoreClass(row.captainImpact)}>
                              {formatSignedNumber(row.captainImpact)}
                            </span>
                          </div>
                        </div>
                      }
                      className="w-64 rounded-sm border bg-popover p-3 text-popover-foreground shadow-sm"
                    />
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
