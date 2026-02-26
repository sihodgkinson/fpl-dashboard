type OpsNotificationEvent =
  | "auth_success"
  | "league_added"
  | "backfill_failed";

interface OpsNotificationInput {
  eventType: OpsNotificationEvent;
  message: string;
  metadata?: Record<string, unknown>;
}

const SENSITIVE_KEY_PATTERN =
  /(token|cookie|secret|password|authorization|apikey|api_key|refresh)/i;

interface SlackField {
  label: string;
  value: string;
}

function getSlackWebhookUrl(): string | null {
  const value = process.env.SLACK_WEBHOOK_URL?.trim() || "";
  return value.length > 0 ? value : null;
}

function sanitizeMetadata(metadata?: Record<string, unknown>): Record<string, unknown> {
  if (!metadata) return {};

  const safe: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(metadata)) {
    if (value === undefined) continue;
    if (SENSITIVE_KEY_PATTERN.test(key)) continue;
    safe[key] = value;
  }
  return safe;
}

function asString(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function asNumber(value: unknown): number | null {
  if (typeof value !== "number" || !Number.isFinite(value)) return null;
  return value;
}

function asBoolean(value: unknown): boolean | null {
  if (typeof value !== "boolean") return null;
  return value;
}

function formatAuthMethod(value: string | null): string {
  if (!value) return "Unknown";
  const normalized = value.toLowerCase();
  if (normalized === "oauth") return "Google";
  if (normalized === "email_otp") return "Email OTP";
  if (normalized === "password") return "Email + Password";
  return value;
}

function formatNotificationContent(
  eventType: OpsNotificationEvent,
  message: string,
  metadata: Record<string, unknown>
): { title: string; summary: string; fields: SlackField[] } {
  if (eventType === "auth_success") {
    const email = asString(metadata.email) || "Unknown";
    const authMethod = formatAuthMethod(asString(metadata.authMethod));
    return {
      title: "New User Signup",
      summary: message,
      fields: [
        { label: "User email", value: email },
        { label: "Auth method", value: authMethod },
      ],
    };
  }

  if (eventType === "league_added") {
    const email = asString(metadata.email) || "Unknown";
    const leagueName = asString(metadata.leagueName) || "Unknown";
    const leagueId = asNumber(metadata.leagueId);
    const managerCount = asNumber(metadata.managerCount);
    const attempted = asNumber(metadata.cacheWarmupAttempted);
    const succeeded = asNumber(metadata.cacheWarmupSucceeded);
    const failed = asNumber(metadata.cacheWarmupFailed);
    const timedOut = asBoolean(metadata.cacheWarmupTimedOut);
    const queued = asBoolean(metadata.fullBackfillQueued);

    const fields: SlackField[] = [
      { label: "User email", value: email },
      { label: "League name", value: leagueName },
      { label: "League ID", value: leagueId !== null ? String(leagueId) : "Unknown" },
      { label: "Manager count", value: managerCount !== null ? String(managerCount) : "Unknown" },
      {
        label: "Cache warmup",
        value:
          attempted !== null && succeeded !== null
            ? `${succeeded}/${attempted} successful`
            : "Unknown",
      },
      {
        label: "Backfill status",
        value: queued === true ? "Backfill queued" : "Backfill not queued",
      },
    ];

    if ((failed !== null && failed > 0) || timedOut === true) {
      const issueParts: string[] = [];
      if (failed !== null && failed > 0) {
        issueParts.push(`${failed} warmup task(s) failed`);
      }
      if (timedOut === true) {
        issueParts.push("warmup timed out");
      }
      fields.push({ label: "Warmup issues", value: issueParts.join("; ") });
    }

    return {
      title: "League Added",
      summary: message,
      fields,
    };
  }

  const leagueId = asNumber(metadata.leagueId);
  const jobId = asNumber(metadata.jobId);
  const attempts = asNumber(metadata.attempts);
  const error = asString(metadata.error);
  const fields: SlackField[] = [];

  if (leagueId !== null) fields.push({ label: "League ID", value: String(leagueId) });
  if (jobId !== null) fields.push({ label: "Job ID", value: String(jobId) });
  if (attempts !== null) fields.push({ label: "Attempt", value: String(attempts) });
  if (error) fields.push({ label: "Error", value: error });

  return {
    title: "Backfill Failure",
    summary: message,
    fields,
  };
}

export async function sendOpsNotification({
  eventType,
  message,
  metadata,
}: OpsNotificationInput): Promise<void> {
  const webhookUrl = getSlackWebhookUrl();
  if (!webhookUrl) return;

  const safeMetadata = sanitizeMetadata(metadata);
  const { title, summary, fields } = formatNotificationContent(
    eventType,
    message,
    safeMetadata
  );
  const text = `[GameweekIQ] ${title}: ${summary}`;
  const lines = [`*${title}*`, summary];

  if (fields.length > 0) {
    lines.push("");
    for (const field of fields) {
      lines.push(`*${field.label}:* ${field.value}`);
    }
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 5000);

  try {
    const response = await fetch(webhookUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        text,
        blocks: [
          {
            type: "section",
            text: {
              type: "mrkdwn",
              text: lines.join("\n"),
            },
          },
        ],
      }),
      cache: "no-store",
      signal: controller.signal,
    });

    if (!response.ok) {
      console.error("[opsNotifications] Slack webhook request failed:", response.status);
    }
  } catch (error) {
    const messageText = error instanceof Error ? error.message : "Unknown error";
    console.error("[opsNotifications] Slack notification failed:", messageText);
  } finally {
    clearTimeout(timeout);
  }
}
