"use client";

import * as React from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

interface WaitlistSignupProps {
  className?: string;
}

interface WaitlistResponse {
  ok?: boolean;
  error?: string;
  retryAfterSeconds?: number;
}

export function WaitlistSignup({ className }: WaitlistSignupProps) {
  const [email, setEmail] = React.useState("");
  const [isSubmitting, setIsSubmitting] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [success, setSuccess] = React.useState(false);
  const [retryAfterSeconds, setRetryAfterSeconds] = React.useState(0);

  React.useEffect(() => {
    if (retryAfterSeconds <= 0) return;
    const timer = window.setTimeout(() => {
      setRetryAfterSeconds((seconds) => Math.max(0, seconds - 1));
    }, 1000);
    return () => window.clearTimeout(timer);
  }, [retryAfterSeconds]);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (isSubmitting || success) return;

    const normalizedEmail = email.trim().toLowerCase();
    if (!normalizedEmail) {
      setError("Enter your email address.");
      return;
    }

    setIsSubmitting(true);
    setError(null);

    try {
      const res = await fetch("/api/waitlist", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: normalizedEmail,
          source: "landing_pricing_waitlist",
        }),
      });
      const payload = (await res.json()) as WaitlistResponse;
      if (!res.ok) {
        if (
          res.status === 429 &&
          typeof payload.retryAfterSeconds === "number" &&
          payload.retryAfterSeconds > 0
        ) {
          setRetryAfterSeconds(Math.ceil(payload.retryAfterSeconds));
        }
        setError(payload.error || "Could not join waitlist.");
        return;
      }

      setSuccess(true);
      setEmail("");
    } catch {
      setError("Could not join waitlist.");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className={className}>
      <Input
        type="email"
        inputMode="email"
        autoComplete="email"
        placeholder="you@example.com"
        value={email}
        onChange={(event) => setEmail(event.target.value)}
        disabled={isSubmitting || success}
        className="h-10"
      />
      <Button
        type="submit"
        disabled={isSubmitting || success || retryAfterSeconds > 0}
        className="mt-2 h-10 w-full bg-[#e2e7ef] text-foreground hover:bg-[#d6dde8] dark:bg-[#1c2026] dark:hover:bg-[#232832]"
      >
        {success ? "Joined waitlist" : isSubmitting ? "Joining..." : "Join waitlist"}
      </Button>
      {retryAfterSeconds > 0 ? (
        <p className="mt-2 text-xs text-muted-foreground">
          Too many attempts. Try again in {retryAfterSeconds}s.
        </p>
      ) : null}
      {error ? <p className="mt-2 text-xs text-destructive">{error}</p> : null}
      {success ? (
        <p className="mt-2 text-xs text-[#5f6470] dark:text-[#83878e]">
          Thanks. You are on the waitlist.
        </p>
      ) : null}
    </form>
  );
}
