"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import useSWR from "swr";
import { LogIn, LogOut, UserPlus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { GoogleSignInButton } from "@/components/common/GoogleSignInButton";

interface SessionResponse {
  isAuthenticated: boolean;
  user: {
    id: string;
    email: string | null;
  } | null;
}

const fetcher = async (url: string) => {
  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(`Request failed: ${res.status}`);
  }
  return (await res.json()) as SessionResponse;
};

export function AuthPanel() {
  const router = useRouter();
  const [open, setOpen] = React.useState(false);
  const [mode, setMode] = React.useState<"login" | "signup">("login");
  const [email, setEmail] = React.useState("");
  const [password, setPassword] = React.useState("");
  const [error, setError] = React.useState<string | null>(null);
  const [message, setMessage] = React.useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = React.useState(false);

  const { data, mutate } = useSWR<SessionResponse>("/api/auth/session", fetcher, {
    revalidateOnFocus: true,
  });

  async function handleSubmit() {
    setIsSubmitting(true);
    setError(null);
    setMessage(null);

    try {
      const endpoint = mode === "login" ? "/api/auth/login" : "/api/auth/signup";
      const res = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });

      const payload = (await res.json()) as { error?: string; requiresEmailConfirmation?: boolean };
      if (!res.ok) {
        setError(payload.error || "Authentication failed.");
        return;
      }

      if (payload.requiresEmailConfirmation) {
        setMessage("Check your email to confirm your account, then sign in.");
        return;
      }

      await mutate();
      setOpen(false);
      router.refresh();
    } catch {
      setError("Authentication failed.");
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleLogout() {
    await fetch("/api/auth/logout", { method: "POST" });
    await mutate();
    router.push("/");
    router.refresh();
  }

  function handleGoogleSignIn() {
    window.location.assign("/api/auth/google/start");
  }

  if (data?.isAuthenticated) {
    return (
      <div className="flex items-center gap-2">
        <span className="hidden md:inline text-xs text-muted-foreground max-w-40 truncate">
          {data.user?.email || "Signed in"}
        </span>
        <Button
          type="button"
          variant="outline"
          size="icon"
          className="h-12 w-12"
          onClick={handleLogout}
          aria-label="Log out"
        >
          <LogOut />
        </Button>
      </div>
    );
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="outline"
          size="icon"
          className="h-12 w-12"
          aria-label={mode === "login" ? "Log in" : "Create account"}
        >
          {mode === "login" ? <LogIn /> : <UserPlus />}
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-80">
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <Button
              type="button"
              variant={mode === "login" ? "default" : "outline"}
              size="sm"
              onClick={() => setMode("login")}
            >
              Log In
            </Button>
            <Button
              type="button"
              variant={mode === "signup" ? "default" : "outline"}
              size="sm"
              onClick={() => setMode("signup")}
            >
              Sign Up
            </Button>
          </div>

          <Input
            type="email"
            placeholder="Email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            disabled={isSubmitting}
          />
          <Input
            type="password"
            placeholder="Password (min 8 chars)"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            disabled={isSubmitting}
          />
          <GoogleSignInButton onClick={handleGoogleSignIn} disabled={isSubmitting} />
          {error ? <p className="text-xs text-destructive">{error}</p> : null}
          {message ? <p className="text-xs text-muted-foreground">{message}</p> : null}
          <Button type="button" onClick={handleSubmit} disabled={isSubmitting}>
            {isSubmitting
              ? "Please wait..."
              : mode === "login"
                ? "Log In"
                : "Create Account"}
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  );
}
