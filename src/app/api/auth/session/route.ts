import { NextRequest, NextResponse } from "next/server";
import {
  attachAuthCookies,
  clearAuthCookies,
  getRequestSessionUser,
} from "@/lib/supabaseAuth";

export async function GET(request: NextRequest) {
  const { user, refreshedSession, reauthReason } = await getRequestSessionUser(request);

  const response = NextResponse.json({
    isAuthenticated: Boolean(user),
    user: user
      ? {
          id: user.id,
          email: user.email || null,
          name: user.user_metadata?.full_name || user.user_metadata?.name || null,
          avatarUrl: user.user_metadata?.avatar_url || user.user_metadata?.picture || null,
        }
      : null,
  });

  if (reauthReason === "refresh_invalid") {
    return clearAuthCookies(response);
  }

  return attachAuthCookies(
    response,
    refreshedSession
  );
}
