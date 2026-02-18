type MetricMeta = Record<string, unknown>;

declare global {
  var __fplMetricsCounters: Record<string, number> | undefined;
}

const metricsEnabled = process.env.FPL_METRICS !== "0";
const shouldLog = metricsEnabled && process.env.NODE_ENV !== "test";

function nowMs() {
  return Date.now();
}

function getCounters(): Record<string, number> {
  if (!globalThis.__fplMetricsCounters) {
    globalThis.__fplMetricsCounters = {};
  }
  return globalThis.__fplMetricsCounters;
}

export function incrementCounter(name: string, by = 1): number {
  const counters = getCounters();
  counters[name] = (counters[name] ?? 0) + by;
  return counters[name];
}

export function getCounter(name: string): number {
  return getCounters()[name] ?? 0;
}

export function logMetric(name: string, meta: MetricMeta = {}) {
  if (!shouldLog) return;
  console.info(
    `[metrics] ${name} ${Object.entries(meta)
      .map(([key, value]) => `${key}=${String(value)}`)
      .join(" ")}`
  );
}

export async function withTiming<T>(
  name: string,
  meta: MetricMeta,
  fn: () => Promise<T>
): Promise<T> {
  const callCount = incrementCounter(`${name}.calls`);
  const startMs = nowMs();

  try {
    const result = await fn();
    logMetric(name, {
      ...meta,
      durationMs: nowMs() - startMs,
      calls: callCount,
      success: true,
    });
    return result;
  } catch (error) {
    incrementCounter(`${name}.errors`);
    logMetric(name, {
      ...meta,
      durationMs: nowMs() - startMs,
      calls: callCount,
      success: false,
      error:
        error instanceof Error ? error.message : "Unknown non-Error exception",
    });
    throw error;
  }
}
