import Link from "next/link";
import { getServerSessionUser } from "@/lib/supabaseAuth";

export default async function NotFound() {
  const sessionUser = await getServerSessionUser();
  const isAuthenticated = Boolean(sessionUser?.id);
  const secondaryHref = isAuthenticated ? "/dashboard" : "/signin";
  const secondaryLabel = isAuthenticated ? "Go to dashboard" : "Sign in";

  return (
    <main className="min-h-svh grid place-items-center p-5">
      <section className="w-full max-w-xl rounded-xl border border-border bg-card/60 px-6 py-10 text-center shadow-sm backdrop-blur">
        <div className="mx-auto mb-5 flex w-fit items-center justify-center rounded-lg border border-border bg-background/70 p-3">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/logo-light.svg"
            alt="GameweekIQ logo"
            className="h-10 w-10 object-contain dark:hidden"
          />
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/logo-dark.svg"
            alt="GameweekIQ logo"
            className="hidden h-10 w-10 object-contain dark:block"
          />
        </div>

        <h1 className="text-balance text-2xl font-semibold tracking-tight sm:text-3xl">
          Page not found
        </h1>
        <p className="mx-auto mt-3 max-w-md text-sm text-muted-foreground sm:text-base">
          The link may be incorrect, expired, or the page may have moved.
        </p>

        <div className="mt-7 flex flex-col items-center justify-center gap-3 sm:flex-row">
          <Link
            href="/"
            className="inline-flex h-10 w-full items-center justify-center rounded-md bg-foreground px-4 text-sm font-semibold text-background transition-opacity hover:opacity-90 sm:w-auto"
          >
            Return home
          </Link>
          <Link
            href={secondaryHref}
            className="inline-flex h-10 w-full items-center justify-center rounded-md border border-border bg-background px-4 text-sm font-semibold text-foreground transition-colors hover:bg-muted sm:w-auto"
          >
            {secondaryLabel}
          </Link>
        </div>
      </section>
    </main>
  );
}

