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
const MAX_METADATA_CHARS = 1800;

function getSlackWebhookUrl(): string | null {
  const value = process.env.SLACK_WEBHOOK_URL?.trim() || "";
  return value.length > 0 ? value : null;
}

function sanitizeMetadata(metadata?: Record<string, unknown>): string | null {
  if (!metadata) return null;

  const safe: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(metadata)) {
    if (value === undefined) continue;
    if (SENSITIVE_KEY_PATTERN.test(key)) {
      safe[key] = "[redacted]";
      continue;
    }
    safe[key] = value;
  }

  if (Object.keys(safe).length === 0) return null;

  try {
    const serialized = JSON.stringify(safe, null, 2);
    if (serialized.length <= MAX_METADATA_CHARS) return serialized;
    return `${serialized.slice(0, MAX_METADATA_CHARS)}…`;
  } catch {
    return null;
  }
}

export async function sendOpsNotification({
  eventType,
  message,
  metadata,
}: OpsNotificationInput): Promise<void> {
  const webhookUrl = getSlackWebhookUrl();
  if (!webhookUrl) return;

  const metadataText = sanitizeMetadata(metadata);
  const text = `[GameweekIQ] ${eventType}: ${message}`;
  const lines = [
    "*GameweekIQ Ops Event*",
    `*Event:* \`${eventType}\``,
    `*Message:* ${message}`,
  ];

  if (metadataText) {
    lines.push("*Metadata:*");
    lines.push("```");
    lines.push(metadataText);
    lines.push("```");
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

