const DEFAULT_LEAGUE_IDS = [430552, 4311, 1295109];
const DEFAULT_BASE_URL = "http://localhost:3000";
const DEFAULT_CONCURRENCY = 3;
const DEFAULT_VIEWS = ["league", "transfers", "chips"];
const SUPPORTED_VIEWS = ["league", "transfers", "chips", "activity_impact"];

function parseLeagueIds(value) {
  if (!value) return DEFAULT_LEAGUE_IDS;
  return value
    .split(",")
    .map((v) => Number(v.trim()))
    .filter((v) => Number.isInteger(v) && v > 0);
}

function parsePositiveInt(value, fallback) {
  if (!value) return fallback;
  const num = Number(value);
  return Number.isInteger(num) && num > 0 ? num : fallback;
}

function parseViews(value) {
  if (!value) return DEFAULT_VIEWS;
  const views = value
    .split(",")
    .map((v) => v.trim().toLowerCase().replace("-", "_"))
    .filter((v) => SUPPORTED_VIEWS.includes(v));
  return views.length > 0 ? views : DEFAULT_VIEWS;
}

function viewToApiPath(view) {
  switch (view) {
    case "activity_impact":
      return "activity-impact";
    default:
      return view;
  }
}

async function getCurrentGw() {
  const res = await fetch(
    "https://fantasy.premierleague.com/api/bootstrap-static/",
    { cache: "no-store" }
  );
  if (!res.ok) {
    throw new Error(`Failed to fetch bootstrap-static (${res.status})`);
  }

  const data = await res.json();
  const current = data?.events?.find((event) => event.is_current);
  return current?.id ?? 1;
}

async function mapWithConcurrency(items, limit, mapper) {
  const results = new Array(items.length);
  let nextIndex = 0;

  async function worker() {
    while (true) {
      const i = nextIndex;
      nextIndex += 1;
      if (i >= items.length) return;
      results[i] = await mapper(items[i], i);
    }
  }

  await Promise.all(
    Array.from({ length: Math.min(limit, items.length) }, () => worker())
  );
  return results;
}

async function main() {
  const baseUrl = process.env.BACKFILL_BASE_URL ?? DEFAULT_BASE_URL;
  const leagueIds = parseLeagueIds(process.env.BACKFILL_LEAGUE_IDS);
  const fromGw = parsePositiveInt(process.env.BACKFILL_FROM_GW, 1);
  const concurrency = parsePositiveInt(
    process.env.BACKFILL_CONCURRENCY,
    DEFAULT_CONCURRENCY
  );
  const views = parseViews(process.env.BACKFILL_VIEWS);

  if (leagueIds.length === 0) {
    throw new Error("No valid BACKFILL_LEAGUE_IDS provided.");
  }

  const currentGw = parsePositiveInt(
    process.env.BACKFILL_CURRENT_GW,
    await getCurrentGw()
  );
  const defaultToGw = Math.max(1, currentGw - 1);
  const toGw = parsePositiveInt(process.env.BACKFILL_TO_GW, defaultToGw);

  if (toGw < fromGw) {
    throw new Error(`Invalid range: from GW ${fromGw} > to GW ${toGw}`);
  }

  const tasks = [];
  for (const leagueId of leagueIds) {
    for (let gw = fromGw; gw <= toGw; gw += 1) {
      for (const view of views) {
        tasks.push({ leagueId, gw, view });
      }
    }
  }

  console.log(
    `Starting cache backfill: leagues=${leagueIds.join(",")} views=${views.join(",")} range=${fromGw}-${toGw} currentGw=${currentGw} tasks=${tasks.length} concurrency=${concurrency}`
  );

  const failures = [];
  let completed = 0;

  await mapWithConcurrency(tasks, concurrency, async ({ leagueId, gw, view }) => {
    const endpoint = viewToApiPath(view);
    const url = `${baseUrl}/api/${endpoint}?leagueId=${leagueId}&gw=${gw}&currentGw=${currentGw}`;
    const res = await fetch(url, { cache: "no-store" });

    completed += 1;
    if (completed % 10 === 0 || completed === tasks.length) {
      console.log(`Progress: ${completed}/${tasks.length}`);
    }

    if (!res.ok) {
      const body = await res.text();
      failures.push({
        leagueId,
        gw,
        view,
        status: res.status,
        body: body.slice(0, 300),
      });
    }
  });

  if (failures.length > 0) {
    console.error(`Backfill finished with ${failures.length} failures.`);
    failures.slice(0, 20).forEach((failure) => {
      console.error(
        `view=${failure.view} league=${failure.leagueId} gw=${failure.gw} status=${failure.status} body=${failure.body}`
      );
    });
    process.exitCode = 1;
    return;
  }

  console.log("Backfill finished successfully.");
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
