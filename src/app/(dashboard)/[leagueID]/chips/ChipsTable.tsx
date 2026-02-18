"use client";

import useSWR from "swr";
import { useSearchParams } from "next/navigation";
import { Skeleton } from "@/components/ui/skeleton"; // ✅ add skeleton

const fetcher = (url: string) => fetch(url).then((res) => res.json());

interface ChipsResponse {
  team: string;
  manager: string;
  chip: string | null;
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

// ✅ Skeleton row for chips
function ChipRowSkeleton() {
  return (
    <tr className="animate-pulse">
      <td className="p-2 sm:p-4">
        <Skeleton className="h-4 w-32 mb-1" />
        <Skeleton className="h-3 w-20" />
      </td>
      <td className="p-2 sm:p-4 hidden sm:table-cell">
        <Skeleton className="h-4 w-28" />
      </td>
      <td className="p-2 sm:p-4">
        <Skeleton className="h-4 w-24" />
      </td>
    </tr>
  );
}

export function ChipsTab({
  leagueId,
  currentGw,
}: {
  leagueId: number;
  currentGw: number;
}) {
  const searchParams = useSearchParams();
  const gw = Number(searchParams.get("gw")) || currentGw;

  const { data, error } = useSWR<ChipsResponse[]>(
    `/api/chips?leagueId=${leagueId}&gw=${gw}&currentGw=${currentGw}`,
    fetcher,
    { refreshInterval: 60000 }
  );

  if (error) return <div>Error loading chips</div>;

  return (
    <div
      className="
        w-full overflow-x-auto rounded-md border border-border
        h-auto overflow-y-visible
        lg:h-[calc(100vh-435px)] sm:overflow-y-auto
      "
    >
      <table className="w-full table-auto text-sm">
        <thead className="sticky top-0 bg-muted z-10">
          <tr className="border-b text-foreground font-semibold bg-card">
            <th className="p-2 sm:p-4 text-left w-1/3">Team</th>
            <th className="p-2 sm:p-4 text-left w-1/3 hidden sm:table-cell">
              Manager
            </th>
            <th className="p-2 sm:p-4 text-left w-1/3">Chip Used</th>
          </tr>
        </thead>
        <tbody>
          {/* ✅ If no data yet, show 5 skeleton rows */}
          {!data
            ? [...Array(5)].map((_, i) => <ChipRowSkeleton key={i} />)
            : data.map((row, idx) => (
                <tr
                  key={idx}
                  className="border-b hover:bg-muted/30 last:border-b-0 transition-colors"
                >
                  {/* Team (with Manager underneath on mobile) */}
                  <td className="p-2 sm:p-4">
                    <div className="font-medium">{row.team}</div>
                    <div className="text-muted-foreground text-xs mt-0.5 block sm:hidden">
                      {row.manager}
                    </div>
                  </td>

                  {/* Manager (hidden on mobile) */}
                  <td className="p-2 sm:p-4 hidden sm:table-cell">
                    {row.manager}
                  </td>

                  {/* Chip Used */}
                  <td className="p-2 sm:p-4">
                    {row.chip ? (
                      <span>{formatChipName(row.chip)}</span>
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
