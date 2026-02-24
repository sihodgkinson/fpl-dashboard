"use client";

import Link from "next/link";
import { GoogleSignInButton } from "@/components/common/GoogleSignInButton";
import { Button } from "@/components/ui/button";

interface SignInPanelProps {
  nextPath: string;
}

const AUTH_NEXT_KEY = "auth_next_path";

export function SignInPanel({ nextPath }: SignInPanelProps) {
  return (
    <main className="min-h-svh grid place-items-center p-5">
      <div className="w-full max-w-md flex flex-col items-center gap-4">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src="/landing/logo-light.svg"
          alt="GameweekIQ logo"
          className="h-18 w-18 object-contain dark:hidden"
        />
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src="/landing/logo-dark.svg"
          alt="GameweekIQ logo"
          className="hidden h-18 w-18 object-contain dark:block"
        />
        <h1 className="text-center text-base font-semibold">Sign in to GameweekIQ</h1>
        <p className="w-[260px] text-center text-xs text-muted-foreground">
          Continue with Google to access your leagues and synced dashboard data.
        </p>
        <GoogleSignInButton
          onClick={() => {
            try {
              window.sessionStorage.setItem(AUTH_NEXT_KEY, nextPath);
            } catch {
              // Ignore storage failures; callback falls back to /dashboard.
            }
            window.location.assign("/api/auth/google/start");
          }}
        />
        <Button asChild type="button" variant="ghost" className="h-[38px] w-[240px]">
          <Link href="/">Back to homepage</Link>
        </Button>
      </div>
    </main>
  );
}
