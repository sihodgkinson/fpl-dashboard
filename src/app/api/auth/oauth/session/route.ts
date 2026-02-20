import { NextRequest, NextResponse } from "next/server";
import {
  attachAuthCookies,
  getUserForAccessToken,
} from "@/lib/supabaseAuth";

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

  return attachAuthCookies(
    NextResponse.json({
      ok: true,
      user: {
        id: user.id,
        email: user.email || null,
        name: user.user_metadata?.full_name || user.user_metadata?.name || null,
        avatarUrl: user.user_metadata?.avatar_url || user.user_metadata?.picture || null,
      },
    }),
    {
      access_token: accessToken,
      refresh_token: refreshToken,
    }
  );
}
