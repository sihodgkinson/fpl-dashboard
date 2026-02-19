import { NextRequest, NextResponse } from "next/server";
import {
  attachAuthCookies,
  signInWithPassword,
} from "@/lib/supabaseAuth";
import {
  USER_LEAGUES_COOKIE,
  migrateUserKeyLeaguesToUserId,
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

  const userKey = request.cookies.get(USER_LEAGUES_COOKIE)?.value;
  if (userKey) {
    await migrateUserKeyLeaguesToUserId({ userId: result.user.id, userKey });
  }

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
