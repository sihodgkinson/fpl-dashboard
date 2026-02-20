import { NextResponse } from "next/server";
import { clearAuthCookies } from "@/lib/supabaseAuth";

export async function POST() {
  return clearAuthCookies(NextResponse.json({ ok: true }));
}
