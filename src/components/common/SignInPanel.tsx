"use client";

import * as React from "react";
import Link from "next/link";
import { GoogleSignInButton } from "@/components/common/GoogleSignInButton";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { isValidEmailFormat, normalizeEmail } from "@/lib/emailValidation";

interface SignInPanelProps {
  nextPath: string;
}

type SignInStep = "method" | "email" | "check" | "code";

interface ApiErrorResponse {
  error?: string;
  message?: string;
}

const AUTH_NEXT_KEY = "auth_next_path";
const INVALID_EMAIL_ERROR = "Enter a valid email address.";
const RESEND_COOLDOWN_SECONDS = 45;

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
  const [emailError, setEmailError] = React.useState<string | null>(null);
  const [emailSentMessage, setEmailSentMessage] = React.useState<string | null>(null);
  const [resendCooldownSeconds, setResendCooldownSeconds] = React.useState(0);
  const [resendCooldownEmail, setResendCooldownEmail] = React.useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = React.useState(false);
  const normalizedEmail = normalizeEmail(email);
  const isEmailValid = isValidEmailFormat(normalizedEmail);
  const isOtpCooldownActive =
    resendCooldownSeconds > 0 &&
    resendCooldownEmail !== null &&
    normalizedEmail === resendCooldownEmail;
  const emailInputRef = React.useRef<HTMLInputElement | null>(null);

  React.useEffect(() => {
    if (step !== "email") return;
    const handle = window.requestAnimationFrame(() => {
      emailInputRef.current?.focus();
      emailInputRef.current?.select();
    });
    return () => {
      window.cancelAnimationFrame(handle);
    };
  }, [step]);

  React.useEffect(() => {
    if (resendCooldownSeconds <= 0) return;
    const interval = window.setInterval(() => {
      setResendCooldownSeconds((current) => (current > 0 ? current - 1 : 0));
    }, 1000);
    return () => {
      window.clearInterval(interval);
    };
  }, [resendCooldownSeconds]);

  React.useEffect(() => {
    if (resendCooldownSeconds > 0) return;
    setResendCooldownEmail(null);
  }, [resendCooldownSeconds]);

  function setAuthNextPath() {
    try {
      window.sessionStorage.setItem(AUTH_NEXT_KEY, nextPath);
    } catch {
      // Ignore storage failures; callback falls back to /dashboard.
    }
  }

  function validateEmailInput(value: string) {
    if (!isValidEmailFormat(value)) {
      setEmailError(INVALID_EMAIL_ERROR);
      return false;
    }
    setEmailError(null);
    return true;
  }

  async function sendEmailOtp(options?: { resend?: boolean }) {
    const isResend = options?.resend === true;
    if (!validateEmailInput(email)) {
      return;
    }

    setIsSubmitting(true);
    setError(null);
    if (isResend) {
      setEmailSentMessage(null);
    }

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
        if (payload.error === "invalid_email") {
          setEmailError(INVALID_EMAIL_ERROR);
          return;
        }
        setError(payload.message || payload.error || "Could not send login code.");
        return;
      }

      setEmail(normalizedEmail);
      setResendCooldownSeconds(RESEND_COOLDOWN_SECONDS);
      setResendCooldownEmail(normalizedEmail);
      if (isResend) {
        setEmailSentMessage("Email resent.");
      } else {
        setEmailSentMessage(null);
        setStep("check");
      }
    } catch {
      setError(isResend ? "Could not resend email." : "Could not send login code.");
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleContinueWithEmail() {
    await sendEmailOtp();
  }

  async function handleResendEmail() {
    if (resendCooldownSeconds > 0) return;
    await sendEmailOtp({ resend: true });
  }

  async function handleVerifyCode() {
    const normalizedCode = loginCode.trim();

    if (!validateEmailInput(email)) {
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
            setEmailError(null);
            setEmailSentMessage(null);
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
          ref={emailInputRef}
          type="email"
          inputMode="email"
          autoComplete="email"
          placeholder="Enter your email address..."
          value={email}
          onChange={(event) => {
            const nextValue = event.target.value;
            setEmail(nextValue);
            setError(null);
            if (emailError) {
              validateEmailInput(nextValue);
            }
            if (emailSentMessage) {
              setEmailSentMessage(null);
            }
          }}
          onBlur={(event) => {
            validateEmailInput(event.target.value);
          }}
          disabled={isSubmitting}
          className="h-[38px] w-[240px]"
          aria-invalid={emailError ? true : false}
        />
        {emailError ? <p className="w-[240px] text-left text-xs text-destructive">{emailError}</p> : null}
        <Button
          type="button"
          className="h-[38px] w-[240px] cursor-pointer"
          onClick={handleContinueWithEmail}
          disabled={isSubmitting || !isEmailValid || isOtpCooldownActive}
        >
          {isSubmitting ? "Sending..." : "Continue with email"}
        </Button>
        {isOtpCooldownActive ? (
          <p className="w-[260px] text-center text-xs text-muted-foreground">
            You can request another email in {resendCooldownSeconds}s.
          </p>
        ) : null}
        <Button
          type="button"
          variant="ghost"
          className="h-[32px] w-[240px] cursor-pointer"
          onClick={() => {
            setError(null);
            setEmailError(null);
            setEmailSentMessage(null);
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
            setEmailError(null);
            setStep("code");
          }}
          disabled={isSubmitting}
        >
          Enter code manually
        </Button>
        <Button
          type="button"
          variant="outline"
          className="h-[32px] w-[240px] cursor-pointer"
          onClick={handleResendEmail}
          disabled={isSubmitting || resendCooldownSeconds > 0}
        >
          {isSubmitting
            ? "Sending..."
            : resendCooldownSeconds > 0
              ? `You can resend in ${resendCooldownSeconds}s`
              : "Resend email"}
        </Button>
        <Button
          type="button"
          variant="ghost"
          className="h-[32px] w-[240px] cursor-pointer"
          onClick={() => {
            setError(null);
            setEmailError(null);
            setEmailSentMessage(null);
            setLoginCode("");
            setStep("email");
          }}
          disabled={isSubmitting}
        >
          Change email address
        </Button>
        {emailSentMessage ? (
          <p className="w-[260px] text-center text-xs text-muted-foreground">{emailSentMessage}</p>
        ) : null}
        <Button
          type="button"
          variant="ghost"
          className="h-[32px] w-[240px] cursor-pointer"
          onClick={() => {
            setError(null);
            setEmailError(null);
            setEmailSentMessage(null);
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
            setEmailError(null);
            setEmailSentMessage(null);
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
          src="/logo-light.svg"
          alt="GameweekIQ logo"
          className="h-18 w-18 object-contain dark:hidden"
        />
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src="/logo-dark.svg"
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
