"use client";

import useSWR from "swr";
import { useSearchParams } from "next/navigation";

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
    `/api/chips?leagueId=${leagueId}&gw=${gw}`,
    fetcher,
    { refreshInterval: 60000 }
  );

  if (error) return <div>Error loading chips</div>;
  if (!data) return <div>Loading...</div>;

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
          <tr className="border-b bg-muted/50 text-foreground font-semibold">
            <th className="p-2 sm:p-4 text-left w-1/3">Team</th>
            <th className="p-2 sm:p-4 text-left w-1/3 hidden sm:table-cell">
              Manager
            </th>
            <th className="p-2 sm:p-4 text-left w-1/3">Chip Used</th>
          </tr>
        </thead>
        <tbody>
          {data.map((row, idx) => (
            <tr
              key={idx}
              className="border-b hover:bg-muted/30 last:border-b-0"
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