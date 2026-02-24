"use client";

import * as React from "react";
import Link from "next/link";
import { GoogleSignInButton } from "@/components/common/GoogleSignInButton";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

interface SignInPanelProps {
  nextPath: string;
}

type SignInStep = "method" | "email" | "check" | "code";

interface ApiErrorResponse {
  error?: string;
}

const AUTH_NEXT_KEY = "auth_next_path";
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function formatMaskedEmail(email: string) {
  const [local, domain] = email.split("@");
  if (!local || !domain) return email;
  if (local.length <= 2) return `${local[0] ?? ""}***@${domain}`;
  return `${local.slice(0, 2)}***@${domain}`;
}

export function SignInPanel({ nextPath }: SignInPanelProps) {
  const [step, setStep] = React.useState<SignInStep>("method");
  const [email, setEmail] = React.useState("");
  const [loginCode, setLoginCode] = React.useState("");
  const [error, setError] = React.useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = React.useState(false);

  function setAuthNextPath() {
    try {
      window.sessionStorage.setItem(AUTH_NEXT_KEY, nextPath);
    } catch {
      // Ignore storage failures; callback falls back to /dashboard.
    }
  }

  async function handleContinueWithEmail() {
    const normalizedEmail = email.trim().toLowerCase();
    if (!EMAIL_PATTERN.test(normalizedEmail)) {
      setError("Enter a valid email address.");
      return;
    }

    setIsSubmitting(true);
    setError(null);

    try {
      setAuthNextPath();

      const res = await fetch("/api/auth/email/otp/start", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: normalizedEmail,
          redirectTo: window.location.origin + "/auth/callback",
        }),
      });

      const payload = (await res.json()) as ApiErrorResponse;
      if (!res.ok) {
        setError(payload.error || "Could not send login code.");
        return;
      }

      setEmail(normalizedEmail);
      setStep("check");
    } catch {
      setError("Could not send login code.");
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleVerifyCode() {
    const normalizedEmail = email.trim().toLowerCase();
    const normalizedCode = loginCode.trim();

    if (!EMAIL_PATTERN.test(normalizedEmail)) {
      setError("Enter a valid email address.");
      setStep("email");
      return;
    }

    if (!/^\d{4,10}$/.test(normalizedCode)) {
      setError("Enter a valid login code.");
      return;
    }

    setIsSubmitting(true);
    setError(null);

    try {
      const res = await fetch("/api/auth/email/otp/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: normalizedEmail, token: normalizedCode }),
      });

      const payload = (await res.json()) as ApiErrorResponse;
      if (!res.ok) {
        setError(payload.error || "Invalid or expired login code.");
        return;
      }

      try {
        window.sessionStorage.removeItem(AUTH_NEXT_KEY);
      } catch {
        // Ignore storage failures.
      }

      window.location.assign(nextPath);
    } catch {
      setError("Invalid or expired login code.");
    } finally {
      setIsSubmitting(false);
    }
  }

  function renderMethodStep() {
    return (
      <>
        <h1 className="text-center text-base font-semibold">Sign in to GameweekIQ</h1>
        <GoogleSignInButton
          onClick={() => {
            setAuthNextPath();
            window.location.assign("/api/auth/google/start");
          }}
          disabled={isSubmitting}
          className="h-[38px] w-[240px] cursor-pointer"
        />
        <p className="text-[11px] uppercase tracking-[0.14em] text-muted-foreground">OR</p>
        <Button
          type="button"
          variant="outline"
          className="h-[38px] w-[240px] cursor-pointer"
          onClick={() => {
            setError(null);
            setStep("email");
          }}
          disabled={isSubmitting}
        >
          Continue with email
        </Button>
        <Button asChild type="button" variant="ghost" className="h-[38px] w-[240px] cursor-pointer">
          <Link href="/">Back to homepage</Link>
        </Button>
      </>
    );
  }

  function renderEmailStep() {
    return (
      <>
        <h1 className="text-center text-base font-semibold">What&apos;s your email address?</h1>
        <Input
          type="email"
          inputMode="email"
          autoComplete="email"
          placeholder="Enter your email address..."
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          disabled={isSubmitting}
          className="h-[38px] w-[240px]"
        />
        <Button
          type="button"
          className="h-[38px] w-[240px] cursor-pointer"
          onClick={handleContinueWithEmail}
          disabled={isSubmitting}
        >
          {isSubmitting ? "Sending..." : "Continue with email"}
        </Button>
        <Button
          type="button"
          variant="ghost"
          className="h-[32px] w-[240px] cursor-pointer"
          onClick={() => {
            setError(null);
            setStep("method");
          }}
          disabled={isSubmitting}
        >
          Back to login
        </Button>
      </>
    );
  }

  function renderCheckStep() {
    return (
      <>
        <h1 className="text-center text-base font-semibold">Check your email</h1>
        <p className="w-[260px] text-center text-xs text-muted-foreground">
          We&apos;ve sent you a temporary login link and code. Please check your inbox at
          <br />
          <span className="text-foreground">{formatMaskedEmail(email)}</span>.
        </p>
        <Button
          type="button"
          className="h-[38px] w-[240px] cursor-pointer"
          onClick={() => {
            setError(null);
            setStep("code");
          }}
          disabled={isSubmitting}
        >
          Enter code manually
        </Button>
        <Button
          type="button"
          variant="ghost"
          className="h-[32px] w-[240px] cursor-pointer"
          onClick={() => {
            setError(null);
            setStep("method");
          }}
          disabled={isSubmitting}
        >
          Back to login
        </Button>
      </>
    );
  }

  function renderCodeStep() {
    return (
      <>
        <h1 className="text-center text-base font-semibold">Check your email</h1>
        <p className="w-[260px] text-center text-xs text-muted-foreground">
          We&apos;ve sent a temporary login code to
          <br />
          <span className="text-foreground">{formatMaskedEmail(email)}</span>.
        </p>
        <Input
          inputMode="numeric"
          autoComplete="one-time-code"
          placeholder="Enter code"
          value={loginCode}
          onChange={(event) => setLoginCode(event.target.value.replace(/\D/g, ""))}
          maxLength={10}
          disabled={isSubmitting}
          className="h-[38px] w-[240px]"
        />
        <Button
          type="button"
          className="h-[38px] w-[240px] cursor-pointer"
          onClick={handleVerifyCode}
          disabled={isSubmitting}
        >
          {isSubmitting ? "Signing in..." : "Continue with login code"}
        </Button>
        <Button
          type="button"
          variant="ghost"
          className="h-[32px] w-[240px] cursor-pointer"
          onClick={() => {
            setError(null);
            setStep("method");
          }}
          disabled={isSubmitting}
        >
          Back to login
        </Button>
      </>
    );
  }

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

        {step === "method" ? renderMethodStep() : null}
        {step === "email" ? renderEmailStep() : null}
        {step === "check" ? renderCheckStep() : null}
        {step === "code" ? renderCodeStep() : null}

        {error ? <p className="w-[260px] text-center text-sm text-destructive">{error}</p> : null}
      </div>
    </main>
  );
}
