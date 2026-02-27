import { redirect } from "next/navigation";
import { OnboardingGate } from "@/components/common/OnboardingGate";
import { sanitizeNextPath } from "@/lib/authNextPath";
import { LEAGUEIQ_VIEW_BY_KEY } from "@/lib/leagueiqRoutes";
import { loadLeagueIQPageData } from "@/lib/server/leagueIQPageData";

export default async function DashboardEntryPage({
  searchParams,
}: {
  searchParams: Promise<{ leagueId?: string; gw?: string }>;
}) {
  const params = await searchParams;
  const pageData = await loadLeagueIQPageData(params);

  if (pageData.status === "unauthenticated") {
    const nextParams = new URLSearchParams();
    if (params.leagueId) nextParams.set("leagueId", params.leagueId);
    if (params.gw) nextParams.set("gw", params.gw);

    const nextPath = sanitizeNextPath(
      `/dashboard${nextParams.size > 0 ? `?${nextParams.toString()}` : ""}`,
      "/dashboard"
    );

    redirect(`/signin?next=${encodeURIComponent(nextPath)}`);
  }

  if (pageData.status === "onboarding") {
    return <OnboardingGate isAuthenticated currentGw={pageData.currentGw} />;
  }

  const paramsForRedirect = new URLSearchParams();
  paramsForRedirect.set("leagueId", String(pageData.selectedLeagueId));
  paramsForRedirect.set("gw", String(pageData.gw));

  redirect(`${LEAGUEIQ_VIEW_BY_KEY["league-table"].path}?${paramsForRedirect.toString()}`);
}
