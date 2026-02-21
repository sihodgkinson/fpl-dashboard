import { logMetric } from "@/lib/metrics";

type CacheView = "league" | "transfers" | "chips" | "activity_impact";

const WARMUP_VIEWS: Array<{ view: CacheView; apiRoute: string }> = [
  { view: "league", apiRoute: "league" },
  { view: "transfers", apiRoute: "transfers" },
  { view: "chips", apiRoute: "chips" },
  { view: "activity_impact", apiRoute: "activity-impact" },
];

interface WarmTask {
  gw: number;
  view: CacheView;
  apiRoute: string;
}

interface WarmResult {
  attempted: number;
  succeeded: number;
  failed: number;
  timedOut: boolean;
}

async function mapWithConcurrency<T>(
  items: T[],
  concurrency: number,
  worker: (item: T) => Promise<void>
) {
  const executing = new Set<Promise<void>>();

  for (const item of items) {
    const task = worker(item).finally(() => {
      executing.delete(task);
    });

    executing.add(task);
    if (executing.size >= concurrency) {
      await Promise.race(executing);
    }
  }

  await Promise.all(executing);
}

export async function warmLeagueCache(params: {
  leagueId: number;
  currentGw: number;
  origin: string;
  fromGw?: number;
  toGw?: number;
  concurrency?: number;
  timeBudgetMs?: number;
}): Promise<WarmResult> {
  const startedAt = Date.now();
  const concurrency = Math.max(1, params.concurrency ?? 2);
  const timeBudgetMs = Math.max(1000, params.timeBudgetMs ?? 10_000);
  const toGw = Math.max(1, Math.floor(params.toGw ?? params.currentGw));
  const fromGw = Math.max(1, Math.floor(params.fromGw ?? 1));
  const normalizedFromGw = Math.min(fromGw, toGw);
  const tasks: WarmTask[] = [];

  // Fill recent gameweeks first so the first user interactions are fast.
  for (let gw = toGw; gw >= normalizedFromGw; gw -= 1) {
    for (const { view, apiRoute } of WARMUP_VIEWS) {
      tasks.push({ gw, view, apiRoute });
    }
  }

  let attempted = 0;
  let succeeded = 0;
  let failed = 0;
  let timedOut = false;

  await mapWithConcurrency(tasks, concurrency, async (task) => {
    if (Date.now() - startedAt > timeBudgetMs) {
      timedOut = true;
      return;
    }

    attempted += 1;
    const url =
      `${params.origin}/api/${task.apiRoute}` +
      `?leagueId=${params.leagueId}&gw=${task.gw}&currentGw=${params.currentGw}`;

    try {
      const res = await fetch(url, { cache: "no-store" });
      if (res.ok) {
        succeeded += 1;
      } else {
        failed += 1;
      }
    } catch {
      failed += 1;
    }
  });

  const result = { attempted, succeeded, failed, timedOut };
  logMetric("cache.warmup.league", {
    leagueId: params.leagueId,
    currentGw: params.currentGw,
    fromGw: normalizedFromGw,
    toGw,
    ...result,
  });

  return result;
}
