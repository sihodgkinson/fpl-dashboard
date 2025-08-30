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
    <div className="w-full overflow-x-auto rounded-md border border-border">
      <table className="w-full table-auto text-sm">
        <thead>
          <tr className="border-b bg-muted/50 text-foreground">
            <th className="px-4 py-2 text-left font-semibold w-1/3">Team</th>
            <th className="px-4 py-2 text-left font-semibold w-1/3">Manager</th>
            <th className="px-4 py-2 text-left font-semibold w-1/3">Transfers</th>
          </tr>
        </thead>
        <tbody>
          {data.map((row, idx) => (
            <tr
              key={idx}
              className="border-b hover:bg-muted/30 last:border-b-0"
            >
              <td className="px-4 py-2">{row.team}</td>
              <td className="px-4 py-2">{row.manager}</td>
              <td className="px-4 py-2">
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