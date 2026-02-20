import { NextRequest, NextResponse } from "next/server";
import {
  attachAuthCookies,
  getRequestSessionUser,
} from "@/lib/supabaseAuth";

export async function GET(request: NextRequest) {
  const { user, refreshedSession } = await getRequestSessionUser(request);

  return attachAuthCookies(
    NextResponse.json({
      isAuthenticated: Boolean(user),
      user: user
        ? {
            id: user.id,
            email: user.email || null,
            name: user.user_metadata?.full_name || user.user_metadata?.name || null,
            avatarUrl: user.user_metadata?.avatar_url || user.user_metadata?.picture || null,
          }
        : null,
    }),
    refreshedSession
  );
}
