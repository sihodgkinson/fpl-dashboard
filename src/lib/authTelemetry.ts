export type AuthTelemetryEvent =
  | "refresh_success"
  | "refresh_failed_transient"
  | "refresh_failed_invalid"
  | "forced_reauth_reason";

interface AuthTelemetryMetadata {
  [key: string]: unknown;
}

const SENSITIVE_KEY_PATTERN = /(token|cookie|secret|password|authorization|apikey|api_key|email)/i;

function sanitizeMetadata(metadata?: AuthTelemetryMetadata): AuthTelemetryMetadata {
  if (!metadata) return {};

  const safe: AuthTelemetryMetadata = {};
  for (const [key, value] of Object.entries(metadata)) {
    if (value === undefined) continue;
    if (SENSITIVE_KEY_PATTERN.test(key)) continue;
    safe[key] = value;
  }

  return safe;
}

export function emitAuthTelemetry(
  event: AuthTelemetryEvent,
  metadata?: AuthTelemetryMetadata
): void {
  const payload = {
    event,
    timestamp: new Date().toISOString(),
    metadata: sanitizeMetadata(metadata),
  };

  console.info("[auth.telemetry]", JSON.stringify(payload));
}
