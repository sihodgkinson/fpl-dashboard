import { getCurrentGameweek, getMaxGameweek } from "@/lib/fpl";
import { redirect } from "next/navigation";
import { LeagueTable } from "@/components/dashboard/LeagueTable";

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ gw?: string }>;
}) {
  const leagueId = 430552;

  const [currentGw, maxGw] = await Promise.all([
    getCurrentGameweek(),
    getMaxGameweek(),
  ]);

  const params = await searchParams;
  const gw = params.gw ? Number(params.gw) : currentGw;

  if (gw > maxGw) {
    redirect(`/dashboard?gw=${maxGw}`);
  }

  return (
    <LeagueTable leagueId={leagueId} gw={gw} currentGw={currentGw} />
  );
}