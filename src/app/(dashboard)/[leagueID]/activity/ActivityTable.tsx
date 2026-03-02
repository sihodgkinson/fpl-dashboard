"use client";

import useSWR from "swr";
import { useSearchParams } from "next/navigation";
import { ChevronDown, ChevronUp, Minus } from "lucide-react";
import { DashboardTableCard } from "@/components/common/DashboardTableCard";
import { Skeleton } from "@/components/ui/skeleton";
import { ResponsiveInfoCard } from "@/components/ui/responsive-info-card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

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
  runningTransferImpactTotal?: number;
  runningChipImpactTotal?: number;
  runningCaptainImpactTotal?: number;
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
    <TableRow className="animate-pulse hover:bg-transparent">
      <TableCell>
        <Skeleton className="h-4 w-8" />
      </TableCell>
      <TableCell>
        <Skeleton className="mb-1 h-4 w-32" />
        <Skeleton className="h-3 w-20" />
      </TableCell>
      <TableCell className="hidden md:table-cell">
        <Skeleton className="h-4 w-28" />
      </TableCell>
      <TableCell className="text-right">
        <Skeleton className="ml-auto h-4 w-12" />
      </TableCell>
      <TableCell className="hidden text-right sm:table-cell">
        <Skeleton className="ml-auto h-4 w-10" />
      </TableCell>
      <TableCell className="hidden text-right sm:table-cell">
        <Skeleton className="ml-auto h-4 w-10" />
      </TableCell>
      <TableCell className="text-right">
        <Skeleton className="ml-auto h-4 w-12" />
      </TableCell>
      <TableCell className="text-right">
        <Skeleton className="ml-auto h-4 w-14" />
      </TableCell>
    </TableRow>
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
    <DashboardTableCard className="mobile-landscape-table" fillHeight>
      <Table className="w-full table-auto text-sm">
        <TableHeader className="bg-background [&_th]:h-10 [&_th]:!py-0 [&_th]:font-semibold">
          <TableRow className="text-foreground hover:bg-transparent">
            <TableHead className="w-3/100 text-left">Pos</TableHead>
            <TableHead className="w-25/100 text-left">Team</TableHead>
            <TableHead className="hidden w-22/100 text-left md:table-cell">
              Manager
            </TableHead>
            <TableHead className="hidden w-10/100 text-right sm:table-cell">
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
                    <div className="text-sm leading-relaxed text-muted-foreground">
                      Transfer impact shows how many points your transfers earned you this
                      gameweek, after subtracting any points spent on transfer hits. If you used
                      a Free Hit, no transfer cost is deducted.
                    </div>
                  }
                  className="!w-80 max-w-[85vw] whitespace-normal break-words rounded-sm border bg-popover p-2.5 text-popover-foreground shadow-sm"
                />
              </div>
            </TableHead>
            <TableHead className="hidden w-10/100 text-right sm:table-cell">
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
                    <div className="text-sm leading-relaxed text-muted-foreground">
                      Chip impact shows the extra points gained from using a chip this gameweek.
                      Bench Boost adds your bench points, Triple Captain adds the additional
                      captain points, and Wildcard or Free Hit do not directly add points so are
                      shown as zero.
                    </div>
                  }
                  className="!w-80 max-w-[85vw] whitespace-normal break-words rounded-sm border bg-popover p-2.5 text-popover-foreground shadow-sm"
                />
              </div>
            </TableHead>
            <TableHead className="hidden w-10/100 text-right sm:table-cell">
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
                    <div className="text-sm leading-relaxed text-muted-foreground">
                      Captain impact shows the points gained or lost from changing your captain
                      compared to last gameweek. It is calculated as double the points difference
                      between your new captain and your previous captain. If you keep the same
                      captain, or your previous captain is no longer in your squad, the impact is
                      zero.
                    </div>
                  }
                  className="!w-80 max-w-[85vw] whitespace-normal break-words rounded-sm border bg-popover p-2.5 text-popover-foreground shadow-sm"
                />
              </div>
            </TableHead>
            <TableHead className="w-10/100 text-right">GW</TableHead>
            <TableHead className="w-10/100 text-right">Total</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {!data
            ? [...Array(5)].map((_, i) => <ActivityRowSkeleton key={i} />)
            : data.map((row) => (
                <TableRow key={row.entryId} className="hover:bg-muted/30">
                  <TableCell className="font-mono">
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
                  </TableCell>

                  <TableCell>
                    <div className="font-medium">{row.team}</div>
                    <div className="block text-xs text-muted-foreground md:hidden">
                      {row.manager}
                    </div>
                  </TableCell>

                  <TableCell className="hidden md:table-cell">{row.manager}</TableCell>

                  <TableCell
                    className={`hidden text-right font-mono sm:table-cell ${scoreClass(
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
                        content={(() => {
                          const transferImpactGross = row.transfers.reduce(
                            (sum, transfer) => sum + transfer.impact,
                            0
                          );
                          const transferHit = row.transferImpactNet - transferImpactGross;

                          return (
                            <ul className="space-y-1 text-sm">
                              {row.transfers.map((transfer, index) => (
                                <li key={index} className="flex items-center justify-between gap-4">
                                  <span className="text-muted-foreground">
                                    {transfer.out}
                                    <span className="mx-2">→</span>
                                    {transfer.in}
                                  </span>
                                  <span className={`font-mono text-right ${scoreClass(transfer.impact)}`}>
                                    {formatSignedNumber(transfer.impact)}
                                  </span>
                                </li>
                              ))}
                              {transferHit < 0 ? (
                                <li className="flex items-center justify-between gap-4">
                                  <span className="text-muted-foreground">Hit</span>
                                  <span className={`font-mono text-right ${scoreClass(transferHit)}`}>
                                    {formatSignedNumber(transferHit)}
                                  </span>
                                </li>
                              ) : null}
                            </ul>
                          );
                        })()}
                        className="max-w-[90vw] rounded-sm border bg-popover p-3 text-popover-foreground shadow-sm"
                      />
                    ) : (
                      <span>{formatSignedNumber(row.transferImpactNet)}</span>
                    )}
                  </TableCell>

                  <TableCell
                    className={`hidden text-right font-mono sm:table-cell ${scoreClass(
                      row.chipImpact
                    )}`}
                  >
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
                        className="max-w-[90vw] rounded-sm border bg-popover p-3 text-popover-foreground shadow-sm"
                      />
                    ) : (
                      <span>{formatSignedNumber(row.chipImpact)}</span>
                    )}
                  </TableCell>

                  <TableCell
                    className={`hidden text-right font-mono sm:table-cell ${scoreClass(
                      row.captainImpact
                    )}`}
                  >
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
                            <span className="mx-2">→</span>
                            <span>{row.currentCaptainName}</span>
                          </div>
                        }
                        className="max-w-[90vw] rounded-sm border bg-popover p-3 text-popover-foreground shadow-sm"
                      />
                    ) : (
                      <span>{formatSignedNumber(row.captainImpact)}</span>
                    )}
                  </TableCell>

                  <TableCell className={`text-right font-mono ${scoreClass(row.gwDecisionScore)}`}>
                    <ResponsiveInfoCard
                      trigger={
                        <button className="cursor-pointer underline decoration-dotted">
                          {formatSignedNumber(row.gwDecisionScore)}
                        </button>
                      }
                      content={
                        <div className="space-y-1 text-sm">
                          <div className="flex items-center justify-between gap-3">
                            <span className="text-muted-foreground">Transfers</span>
                            <span className={`font-mono text-right ${scoreClass(row.transferImpactNet)}`}>
                              {formatSignedNumber(row.transferImpactNet)}
                            </span>
                          </div>
                          <div className="flex items-center justify-between gap-3">
                            <span className="text-muted-foreground">Chips</span>
                            <span className={`font-mono text-right ${scoreClass(row.chipImpact)}`}>
                              {formatSignedNumber(row.chipImpact)}
                            </span>
                          </div>
                          <div className="flex items-center justify-between gap-3">
                            <span className="text-muted-foreground">Captain</span>
                            <span className={`font-mono text-right ${scoreClass(row.captainImpact)}`}>
                              {formatSignedNumber(row.captainImpact)}
                            </span>
                          </div>
                        </div>
                      }
                      className="max-w-[90vw] rounded-sm border bg-popover p-3 text-popover-foreground shadow-sm"
                    />
                  </TableCell>

                  <TableCell
                    className={`text-right font-mono ${scoreClass(
                      row.runningInfluenceTotal
                    )}`}
                  >
                    <ResponsiveInfoCard
                      trigger={
                        <button className="cursor-pointer underline decoration-dotted">
                          {formatSignedNumber(row.runningInfluenceTotal)}
                        </button>
                      }
                      content={
                        <div className="space-y-1 text-sm">
                          <div className="flex items-center justify-between gap-3">
                            <span className="text-muted-foreground">Transfers</span>
                            {typeof row.runningTransferImpactTotal === "number" ? (
                              <span
                                className={`font-mono text-right ${scoreClass(
                                  row.runningTransferImpactTotal
                                )}`}
                              >
                                {formatSignedNumber(row.runningTransferImpactTotal)}
                              </span>
                            ) : (
                              <span className="text-muted-foreground">—</span>
                            )}
                          </div>
                          <div className="flex items-center justify-between gap-3">
                            <span className="text-muted-foreground">Chips</span>
                            {typeof row.runningChipImpactTotal === "number" ? (
                              <span
                                className={`font-mono text-right ${scoreClass(
                                  row.runningChipImpactTotal
                                )}`}
                              >
                                {formatSignedNumber(row.runningChipImpactTotal)}
                              </span>
                            ) : (
                              <span className="text-muted-foreground">—</span>
                            )}
                          </div>
                          <div className="flex items-center justify-between gap-3">
                            <span className="text-muted-foreground">Captain</span>
                            {typeof row.runningCaptainImpactTotal === "number" ? (
                              <span
                                className={`font-mono text-right ${scoreClass(
                                  row.runningCaptainImpactTotal
                                )}`}
                              >
                                {formatSignedNumber(row.runningCaptainImpactTotal)}
                              </span>
                            ) : (
                              <span className="text-muted-foreground">—</span>
                            )}
                          </div>
                        </div>
                      }
                      className="max-w-[90vw] rounded-sm border bg-popover p-3 text-popover-foreground shadow-sm"
                    />
                  </TableCell>
                </TableRow>
              ))}
        </TableBody>
      </Table>
    </DashboardTableCard>
  );
}
