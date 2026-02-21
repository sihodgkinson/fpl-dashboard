"use client";

import useSWR from "swr";
import { useSearchParams } from "next/navigation";
import { Skeleton } from "@/components/ui/skeleton";

const fetcher = (url: string) => fetch(url).then((res) => res.json());

interface TransfersResponse {
  manager: string;
  team: string;
  transfers: {
    in: string;
    out: string;
  }[];
}

interface ChipsResponse {
  team: string;
  manager: string;
  chip: string | null;
}

interface ActivityRow {
  team: string;
  manager: string;
  chip: string | null;
  transfers: {
    in: string;
    out: string;
  }[];
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

function ActivityRowSkeleton() {
  return (
    <tr className="animate-pulse">
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
    </tr>
  );
}

function buildActivityRows(
  transfersRows: TransfersResponse[],
  chipRows: ChipsResponse[]
): ActivityRow[] {
  const chipsByKey = new Map(
    chipRows.map((row) => [`${row.team}::${row.manager}`, row.chip] as const)
  );

  return transfersRows.map((row) => ({
    team: row.team,
    manager: row.manager,
    chip: chipsByKey.get(`${row.team}::${row.manager}`) ?? null,
    transfers: row.transfers,
  }));
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

  const { data, error } = useSWR<ActivityRow[]>(
    `activity:${leagueId}:${gw}:${currentGw}`,
    async () => {
      const [transfersRows, chipRows] = await Promise.all([
        fetcher(
          `/api/transfers?leagueId=${leagueId}&gw=${gw}&currentGw=${currentGw}`
        ) as Promise<TransfersResponse[]>,
        fetcher(`/api/chips?leagueId=${leagueId}&gw=${gw}&currentGw=${currentGw}`) as Promise<
          ChipsResponse[]
        >,
      ]);
      return buildActivityRows(transfersRows, chipRows);
    },
    { refreshInterval: 0, revalidateOnFocus: false }
  );

  if (error) return <div>Error loading activity</div>;

  return (
    <div className="mobile-landscape-table w-full overflow-x-auto rounded-md border border-border sm:h-full sm:overflow-auto">
      <table className="w-full table-auto text-sm">
        <thead className="sticky top-0 z-10 bg-muted">
          <tr className="border-b bg-card font-semibold text-foreground">
            <th className="w-1/4 p-2 text-left sm:p-4">Team</th>
            <th className="hidden w-1/4 p-2 text-left sm:table-cell sm:p-4">Manager</th>
            <th className="w-1/4 p-2 text-left sm:p-4">Chips Used</th>
            <th className="w-1/4 p-2 text-left sm:p-4">Transfers</th>
          </tr>
        </thead>
        <tbody>
          {!data
            ? [...Array(5)].map((_, i) => <ActivityRowSkeleton key={i} />)
            : data.map((row, idx) => (
                <tr
                  key={idx}
                  className="border-b transition-colors last:border-b-0 hover:bg-muted/30"
                >
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
                        {row.transfers.map((t, i) => (
                          <div key={i}>
                            {t.out} → {t.in}
                          </div>
                        ))}
                      </div>
                    ) : (
                      <span className="text-muted-foreground">—</span>
                    )}
                  </td>
                </tr>
              ))}
        </tbody>
      </table>
    </div>
  );
}
