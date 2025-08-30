"use client";

import useSWR from "swr";
import { useSearchParams } from "next/navigation";

const fetcher = (url: string) => fetch(url).then((res) => res.json());

interface TransfersResponse {
  manager: string;
  team: string;
  transfers: {
    in: string;
    out: string;
  }[];
}

export function TransfersTab({
  leagueId,
  currentGw,
}: {
  leagueId: number;
  currentGw: number;
}) {
  const searchParams = useSearchParams();
  const gw = Number(searchParams.get("gw")) || currentGw;

  const { data, error } = useSWR<TransfersResponse[]>(
    `/api/transfers?leagueId=${leagueId}&gw=${gw}`,
    fetcher,
    { refreshInterval: 60000 } // refresh every 60s
  );

  if (error) return <div>Error loading transfers</div>;
  if (!data) return <div>Loading...</div>;

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
          <tr className="border-b bg-muted/50 text-foreground font-semibold">
            <th className="p-2 sm:p-4 text-left w-1/3">Team</th>
            <th className="p-2 sm:p-4 text-left w-1/3 hidden sm:table-cell">
              Manager
            </th>
            <th className="p-2 sm:p-4 text-left w-1/3">Transfers</th>
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

              {/* Transfers */}
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
                  <span className="text-muted-foreground">No transfers</span>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}