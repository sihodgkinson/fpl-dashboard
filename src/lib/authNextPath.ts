const DEFAULT_NEXT_PATH = "/dashboard";

export function sanitizeNextPath(
  value: string | null | undefined,
  fallback = DEFAULT_NEXT_PATH
): string {
  if (!value) return fallback;

  const trimmed = value.trim();
  if (!trimmed.startsWith("/")) return fallback;
  if (trimmed.startsWith("//")) return fallback;

  try {
    const parsed = new URL(trimmed, "http://localhost");
    return `${parsed.pathname}${parsed.search}${parsed.hash}`;
  } catch {
    return fallback;
  }
}
