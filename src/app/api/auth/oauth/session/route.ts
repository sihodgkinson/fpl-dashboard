import { NextRequest, NextResponse } from "next/server";
import {
  attachAuthCookies,
  getUserForAccessToken,
} from "@/lib/supabaseAuth";
import {
  USER_LEAGUES_COOKIE,
  migrateUserKeyLeaguesToUserId,
  seedDefaultUserLeagues,
} from "@/lib/userLeagues";

export async function POST(request: NextRequest) {
  let body: { accessToken?: unknown; refreshToken?: unknown };
  try {
    body = (await request.json()) as { accessToken?: unknown; refreshToken?: unknown };
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  const accessToken = String(body.accessToken || "");
  const refreshToken = String(body.refreshToken || "");
  if (!accessToken || !refreshToken) {
    return NextResponse.json(
      { error: "Missing OAuth tokens." },
      { status: 400 }
    );
  }

  const user = await getUserForAccessToken(accessToken);
  if (!user?.id) {
    return NextResponse.json({ error: "Invalid access token." }, { status: 401 });
  }

  const userKey = request.cookies.get(USER_LEAGUES_COOKIE)?.value;
  if (userKey) {
    await migrateUserKeyLeaguesToUserId({ userId: user.id, userKey });
  } else {
    await seedDefaultUserLeagues({ userId: user.id });
  }

  return attachAuthCookies(
    NextResponse.json({
      ok: true,
      user: {
        id: user.id,
        email: user.email || null,
      },
    }),
    {
      access_token: accessToken,
      refresh_token: refreshToken,
    }
  );
}
