import { NextRequest, NextResponse } from "next/server";
import {
  attachAuthCookies,
  signUpWithPassword,
} from "@/lib/supabaseAuth";
import {
  USER_LEAGUES_COOKIE,
  migrateUserKeyLeaguesToUserId,
  seedDefaultUserLeagues,
} from "@/lib/userLeagues";

export async function POST(request: NextRequest) {
  let body: { email?: unknown; password?: unknown };
  try {
    body = (await request.json()) as { email?: unknown; password?: unknown };
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  const email = String(body.email || "").trim().toLowerCase();
  const password = String(body.password || "");
  if (!email || !password || password.length < 8) {
    return NextResponse.json(
      { error: "Email and password (min 8 chars) are required." },
      { status: 400 }
    );
  }

  const result = await signUpWithPassword(email, password);
  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: 400 });
  }

  const userKey = request.cookies.get(USER_LEAGUES_COOKIE)?.value;
  if (userKey) {
    await migrateUserKeyLeaguesToUserId({ userId: result.user.id, userKey });
  } else {
    await seedDefaultUserLeagues({ userId: result.user.id });
  }

  const response = NextResponse.json({
    ok: true,
    user: {
      id: result.user.id,
      email: result.user.email || email,
    },
    requiresEmailConfirmation: result.session === null,
  });

  if (!result.session) return response;
  return attachAuthCookies(response, result.session);
}
