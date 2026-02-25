import { NextRequest, NextResponse } from "next/server";
import { attachAuthCookies, verifyEmailOtp } from "@/lib/supabaseAuth";
import { sendOpsNotification } from "@/lib/opsNotifications";

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export async function POST(request: NextRequest) {
  let body: { email?: unknown; token?: unknown };
  try {
    body = (await request.json()) as { email?: unknown; token?: unknown };
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  const email = String(body.email || "").trim().toLowerCase();
  const token = String(body.token || "").trim();

  if (!EMAIL_PATTERN.test(email)) {
    return NextResponse.json({ error: "Enter a valid email address." }, { status: 400 });
  }

  if (!/^\d{4,10}$/.test(token)) {
    return NextResponse.json({ error: "Enter a valid login code." }, { status: 400 });
  }

  const result = await verifyEmailOtp(email, token);
  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: 401 });
  }

  void sendOpsNotification({
    eventType: "auth_success",
    message: "Email OTP authentication completed successfully.",
    metadata: {
      authMethod: "email_otp",
      userId: result.user.id,
      email: result.user.email || email,
    },
  });

  return attachAuthCookies(
    NextResponse.json({
      ok: true,
      user: {
        id: result.user.id,
        email: result.user.email || email,
      },
    }),
    result.session
  );
}
