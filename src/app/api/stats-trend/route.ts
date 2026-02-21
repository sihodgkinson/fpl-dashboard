import { NextResponse } from "next/server";
import { withTiming } from "@/lib/metrics";
import {
  getCachedActivityImpactPayloadRange,
  getCachedLeaguePayloadRange,
} from "@/lib/supabaseCache";
import { EnrichedStanding } from "@/types/fpl";

const DEFAULT_WINDOW = 8;
const MAX_WINDOW = 20;

interface TrendPoint {
  gw: number;
  value: number | null;
  manager: string | null;
  team: string | null;
}

interface TrendSeries {
  points: TrendPoint[];
  average: number | null;
}

function computeAverage(points: TrendPoint[]): number | null {
  const values = points
    .map((point) => point.value)
    .filter((value): value is number => typeof value === "number");
  if (values.length === 0) return null;
  return Number((values.reduce((sum, value) => sum + value, 0) / values.length).toFixed(2));
}

function extractPoint(
  gw: number,
  standing: EnrichedStanding | null,
  value: number | null
): TrendPoint {
  return {
    gw,
    value,
    manager: standing?.player_name ?? null,
    team: standing?.entry_name ?? null,
  };
}

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const leagueId = Number(searchParams.get("leagueId"));
  const gw = Number(searchParams.get("gw"));
  const windowParam = Number(searchParams.get("window"));
  const windowSize =
    Number.isInteger(windowParam) && windowParam > 0
      ? Math.min(windowParam, MAX_WINDOW)
      : DEFAULT_WINDOW;

  return withTiming(
    "api.stats-trend.GET",
    { leagueId, gw, windowSize },
    async () => {
      if (!Number.isInteger(leagueId) || leagueId <= 0 || !Number.isInteger(gw) || gw <= 0) {
        return NextResponse.json(
          { error: "Invalid query params. Expected positive integers for leagueId and gw." },
          { status: 400 }
        );
      }

      const fromGw = Math.max(1, gw - windowSize + 1);
      const toGw = gw;
      const [rows, activityRows] = await Promise.all([
        getCachedLeaguePayloadRange(leagueId, fromGw, toGw),
        getCachedActivityImpactPayloadRange(leagueId, fromGw, toGw),
      ]);
      const byGw = new Map(rows.map((row) => [row.gw, row.payload]));
      const activityByGw = new Map(activityRows.map((row) => [row.gw, row.payload]));

      const mostPoints: TrendPoint[] = [];
      const fewestPoints: TrendPoint[] = [];
      const mostBench: TrendPoint[] = [];
      const fewestBench: TrendPoint[] = [];
      const mostTransfers: TrendPoint[] = [];
      const mostInfluence: TrendPoint[] = [];
      const leastInfluence: TrendPoint[] = [];

      for (let candidateGw = fromGw; candidateGw <= toGw; candidateGw += 1) {
        const payload = byGw.get(candidateGw);
        const stats = payload?.stats;

        mostPoints.push(
          extractPoint(candidateGw, stats?.mostPoints ?? null, stats?.mostPoints?.gwPoints ?? null)
        );
        fewestPoints.push(
          extractPoint(
            candidateGw,
            stats?.fewestPoints ?? null,
            stats?.fewestPoints?.gwPoints ?? null
          )
        );
        mostBench.push(
          extractPoint(candidateGw, stats?.mostBench ?? null, stats?.mostBench?.benchPoints ?? null)
        );
        const standings = payload?.standings ?? [];
        const fewestBenchStanding =
          standings.length > 0
            ? standings.reduce((min: EnrichedStanding, team: EnrichedStanding) =>
                team.benchPoints < min.benchPoints ? team : min
              )
            : null;
        fewestBench.push(
          extractPoint(
            candidateGw,
            fewestBenchStanding,
            fewestBenchStanding?.benchPoints ?? null
          )
        );
        mostTransfers.push(
          extractPoint(
            candidateGw,
            stats?.mostTransfers ?? null,
            stats?.mostTransfers?.transfers ?? null
          )
        );

        const activityPayload = activityByGw.get(candidateGw) ?? [];
        const mostInfluenceRow =
          activityPayload.length > 0
            ? [...activityPayload].sort((a, b) => b.gwDecisionScore - a.gwDecisionScore)[0]
            : null;
        const leastInfluenceRow =
          activityPayload.length > 0
            ? [...activityPayload].sort((a, b) => a.gwDecisionScore - b.gwDecisionScore)[0]
            : null;
        mostInfluence.push({
          gw: candidateGw,
          value: mostInfluenceRow?.gwDecisionScore ?? null,
          manager: mostInfluenceRow?.manager ?? null,
          team: mostInfluenceRow?.team ?? null,
        });
        leastInfluence.push({
          gw: candidateGw,
          value: leastInfluenceRow?.gwDecisionScore ?? null,
          manager: leastInfluenceRow?.manager ?? null,
          team: leastInfluenceRow?.team ?? null,
        });
      }

      const response: {
        fromGw: number;
        toGw: number;
        window: number;
        series: {
          mostPoints: TrendSeries;
          fewestPoints: TrendSeries;
          mostBench: TrendSeries;
          fewestBench: TrendSeries;
          mostTransfers: TrendSeries;
          mostInfluence: TrendSeries;
          leastInfluence: TrendSeries;
        };
      } = {
        fromGw,
        toGw,
        window: windowSize,
        series: {
          mostPoints: {
            points: mostPoints,
            average: computeAverage(mostPoints),
          },
          fewestPoints: {
            points: fewestPoints,
            average: computeAverage(fewestPoints),
          },
          mostBench: {
            points: mostBench,
            average: computeAverage(mostBench),
          },
          fewestBench: {
            points: fewestBench,
            average: computeAverage(fewestBench),
          },
          mostTransfers: {
            points: mostTransfers,
            average: computeAverage(mostTransfers),
          },
          mostInfluence: {
            points: mostInfluence,
            average: computeAverage(mostInfluence),
          },
          leastInfluence: {
            points: leastInfluence,
            average: computeAverage(leastInfluence),
          },
        },
      };

      return NextResponse.json(response);
    }
  );
}
