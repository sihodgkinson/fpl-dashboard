import { redirect, notFound } from "next/navigation";
import DashboardClient from "@/app/(dashboard)/[leagueID]/DashboardClient";
import { OnboardingGate } from "@/components/common/OnboardingGate";
import { sanitizeNextPath } from "@/lib/authNextPath";
import { isLeagueIQView } from "@/lib/leagueiqRoutes";
import { loadLeagueIQPageData } from "@/lib/server/leagueIQPageData";

export default async function LeagueIQViewPage({
  params,
  searchParams,
}: {
  params: Promise<{ view: string }>;
  searchParams: Promise<{ leagueId?: string; gw?: string }>;
}) {
  const [{ view }, query] = await Promise.all([params, searchParams]);
  if (!isLeagueIQView(view)) {
    notFound();
  }

  const pageData = await loadLeagueIQPageData(query);

  if (pageData.status === "unauthenticated") {
    const nextParams = new URLSearchParams();
    if (query.leagueId) nextParams.set("leagueId", query.leagueId);
    if (query.gw) nextParams.set("gw", query.gw);

    const nextPath = sanitizeNextPath(
      `/dashboard/leagueiq/${view}${nextParams.size > 0 ? `?${nextParams.toString()}` : ""}`,
      "/dashboard"
    );

    redirect(`/signin?next=${encodeURIComponent(nextPath)}`);
  }

  if (pageData.status === "onboarding") {
    return <OnboardingGate isAuthenticated currentGw={pageData.currentGw} />;
  }

  return (
    <DashboardClient
      leagues={pageData.leagues}
      selectedLeagueId={pageData.selectedLeagueId}
      currentGw={pageData.currentGw}
      maxGw={pageData.maxGw}
      gw={pageData.gw}
      activeView={view}
    />
  );
}
