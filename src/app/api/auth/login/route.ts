import { NextRequest, NextResponse } from "next/server";
import {
  attachAuthCookies,
  signInWithPassword,
} from "@/lib/supabaseAuth";
import { sendOpsNotification } from "@/lib/opsNotifications";

export async function POST(request: NextRequest) {
  let body: { email?: unknown; password?: unknown };
  try {
    body = (await request.json()) as { email?: unknown; password?: unknown };
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  const email = String(body.email || "").trim().toLowerCase();
  const password = String(body.password || "");
  if (!email || !password) {
    return NextResponse.json(
      { error: "Email and password are required." },
      { status: 400 }
    );
  }

  const result = await signInWithPassword(email, password);
  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: 401 });
  }

  void sendOpsNotification({
    eventType: "user_login",
    message: "Password authentication completed successfully.",
    metadata: {
      authMethod: "password",
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
