import Link from "next/link";
import Image from "next/image";
import {
  BarChart3,
  Check,
  Compass,
  Gauge,
  RefreshCw,
  Sparkles,
  Table2,
  TrendingUp,
  Zap,
} from "lucide-react";
import { ModeToggle } from "@/components/common/ModeToggle";
import { getServerSessionUser } from "@/lib/supabaseAuth";

const pillars = [
  {
    title: "Live League Intelligence",
    description:
      "Track every gameweek with near-live updates so you can react before rivals do.",
    icon: Zap,
  },
  {
    title: "Decision Impact Analysis",
    description:
      "Quantify rival decisions with clear gain/loss scoring so every move is measurable.",
    icon: BarChart3,
  },
  {
    title: "Designed for speed",
    description:
      "Fast loading and instant switching keep insights quick across desktop and mobile.",
    icon: Gauge,
  },
];

const features = [
  "League Table with trend widgets and gameweek navigation",
  "Manager Influence with Transfer, Chip, and Captain impact",
  "GW 1 Table to compare original squads over the season",
  "Automatic historical backfill when adding a new league",
  "Cache-first data pipeline for fast historical browsing",
  "Touch-friendly mobile UX with swipe gameweek controls",
];

const featureIcons = [Table2, TrendingUp, Compass, RefreshCw, Sparkles, Gauge];

const pricingTiers = [
  {
    name: "Free",
    price: "$0",
    subtitle: "All core features are free during beta period",
    cta: "Get started",
    href: "/api/auth/google/start",
    features: [
      "Live League Table + GW 1 Table",
      "Manager Influence with decision scoring",
      "Near-live updates during active gameweeks",
      "Automatic league backfill on add",
      "Mobile swipe controls and responsive tables",
      "Google sign-in and multi-device sync",
    ],
    highlighted: true,
  },
  {
    name: "Premium",
    price: "Coming soon",
    subtitle: "Advanced insights for serious competitors",
    cta: "Join waitlist",
    href: "#contact",
    features: [
      "Advanced manager edge and trend models",
      "Custom alerts for key league movements",
      "Private leagues and priority refresh windows",
      "Extended historical analytics and exports",
      "Side-by-side rival comparison tools",
      "Early access to new intelligence modules",
    ],
    highlighted: false,
  },
];

export default async function Home() {
  const sessionUser = await getServerSessionUser();
  const isAuthenticated = Boolean(sessionUser?.id);
  const primaryCtaHref = isAuthenticated ? "/dashboard" : "/api/auth/google/start";
  const primaryCtaLabel = isAuthenticated ? "Go to dashboard" : "Get started";

  return (
    <div id="top" className="min-h-svh bg-background text-foreground">
      <header className="sticky top-0 z-40 border-b border-[#1d1d1e] bg-[#0a0a0a]">
        <div className="px-4 md:px-10 lg:px-20">
          <div className="mx-auto flex h-[72px] w-full max-w-[1282px] items-center justify-between">
            <a
              href="#top"
              className="flex items-center gap-3 transition-opacity hover:opacity-90"
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src="/favicon.ico"
                alt="GameweekIQ logo"
                className="h-8 w-8 rounded-md border border-border/80 bg-background object-cover"
              />
              <span className="text-base font-medium tracking-tight">GameweekIQ</span>
            </a>

            <div className="flex items-center gap-3">
              <nav className="hidden items-center gap-2 text-[14px] text-muted-foreground md:flex">
                <a
                  href="#features"
                  className="inline-flex h-8 cursor-pointer items-center rounded-[6px] px-3.5 transition-colors hover:bg-[#17181a] hover:text-foreground"
                >
                  Features
                </a>
                <a
                  href="#pricing"
                  className="inline-flex h-8 cursor-pointer items-center rounded-[6px] px-3.5 transition-colors hover:bg-[#17181a] hover:text-foreground"
                >
                  Pricing
                </a>
                <button
                  type="button"
                  className="inline-flex h-8 cursor-pointer items-center rounded-[6px] px-3.5 transition-colors hover:bg-[#17181a] hover:text-foreground"
                >
                  Contact
                </button>
              </nav>
              <Link
                href={primaryCtaHref}
                className="inline-flex h-8 items-center rounded-[6px] bg-primary px-3 text-[14px] font-semibold text-primary-foreground transition-opacity hover:opacity-90"
              >
                {primaryCtaLabel}
              </Link>
              <ModeToggle className="h-8 w-8" />
            </div>
          </div>
        </div>
      </header>

      <main>
        <section className="relative overflow-hidden border-b border-[#1d1d1e] bg-[linear-gradient(to_bottom,#08090a_50%,#7f8288_100%)]">
          <div className="px-4 md:px-10 lg:px-20">
            <div className="mx-auto w-full max-w-[1282px] pb-24 pt-24 sm:pb-28 sm:pt-32">
            <div className="max-w-[860px]">
              <span className="mb-8 inline-flex items-center rounded-full border border-border/70 bg-background/75 px-4 py-1.5 text-sm font-medium text-[#83878e] backdrop-blur">
                Built for FPL managers who want an edge every gameweek
              </span>
              <h1 className="text-balance text-5xl font-semibold tracking-[-0.02em] leading-[1.04] sm:text-6xl sm:leading-[1.03]">
                Mini-league standings, decoded.
                <br className="hidden sm:block" />
                Every change explained.
              </h1>
              <p className="mt-6 max-w-2xl text-pretty text-sm leading-relaxed text-[#83878e] sm:text-base sm:leading-[1.55]">
                Live, gameweek-by-gameweek insights that show exactly how transfers,
                <br />
                chips, and captain calls impact your mini-league.
              </p>
            </div>

            <div className="mt-12 sm:mt-14">
              <div className="relative left-1/2 w-full max-w-[360px] -translate-x-1/2 md:w-[1320px] md:max-w-none">
                <div className="overflow-hidden rounded-2xl border border-border/70 shadow-[0_70px_140px_-55px_rgba(2,6,23,0.8)]">
                  <div className="relative aspect-[9/19.5] w-full md:hidden">
                    <Image
                      src="/landing/mobile-light.png"
                      alt="GameweekIQ mobile dashboard in light mode"
                      fill
                      priority
                      className="object-cover dark:hidden"
                    />
                    <Image
                      src="/landing/mobile-dark.png"
                      alt="GameweekIQ mobile dashboard in dark mode"
                      fill
                      priority
                      className="hidden object-cover dark:block"
                    />
                  </div>

                  <div className="hidden w-full md:block">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src="/landing/dashboard-light.png"
                      alt="GameweekIQ desktop dashboard in light mode"
                      className="block h-auto w-full dark:hidden"
                    />
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src="/landing/dashboard-dark.png"
                      alt="GameweekIQ desktop dashboard in dark mode"
                      className="hidden h-auto w-full dark:block"
                    />
                  </div>
                </div>
                <div className="pointer-events-none absolute inset-x-[8%] -bottom-10 h-20 rounded-full bg-black/30 blur-2xl dark:bg-black/50" />
              </div>
            </div>
            </div>
          </div>
        </section>

        <section className="bg-[#08090a] py-16 sm:py-20">
          <div className="px-4 md:px-10 lg:px-20">
            <div className="mx-auto flex w-full max-w-[1282px] flex-col gap-16">
              <section>
                <h2 className="max-w-[1100px] pt-2 text-balance text-4xl font-semibold leading-[1.1] tracking-tight text-[#83878e] sm:pt-4 sm:text-5xl sm:leading-[1.08]">
                  <span className="text-foreground">Your league table, upgraded.</span>{" "}
                  Go beyond points totals. GameweekIQ combines classic standings with
                  decision-level intelligence so you can quickly understand who gained,
                  who slipped, and why.
                </h2>
              </section>

              <section className="grid grid-cols-1 gap-0 sm:grid-cols-3">
                {pillars.map(({ title, description, icon: Icon }, index) => (
                  <article
                    key={title}
                    className="border-b border-[#1d1d1e] p-6 sm:min-h-[460px] sm:border-b-0 sm:p-10"
                    style={{
                      borderRight:
                        index < pillars.length - 1 ? "1px solid #1d1d1e" : "none",
                    }}
                  >
                    <div className="h-88 rounded-lg border border-[#1d1d1e] bg-[#0d0f11]" />
                    <Icon className="mt-6 h-6 w-6 text-[#6a6f76]" strokeWidth={1.8} />
                    <h3 className="mt-4 text-[19px] font-semibold tracking-tight text-foreground sm:text-[20px]">
                      {title}
                    </h3>
                    <p className="mt-3 text-base leading-relaxed text-[#83878e]">
                      {description}
                    </p>
                  </article>
                ))}
              </section>
            </div>
          </div>

          <div className="my-28 h-px w-full bg-[#1d1d1e]" />

          <section id="features" className="scroll-mt-28 px-4 pb-16 md:px-10 lg:px-20">
            <div className="mx-auto w-full max-w-[1282px]">
              <div className="mx-auto max-w-[860px] text-center">
                <h3 className="text-balance text-4xl font-semibold tracking-tight text-foreground sm:text-5xl sm:leading-[1.08]">
                  Everything you need to out-think your mini-league.
                </h3>
                <p className="mt-5 text-pretty text-base leading-relaxed text-[#83878e] sm:text-lg">
                  Focused tools built around gameweek decisions, so you can spot
                  <br className="hidden sm:block" />
                  momentum shifts early and act with confidence.
                </p>
              </div>

              <div className="mx-auto mt-14 grid max-w-[1008px] grid-cols-1 justify-items-center gap-6 sm:grid-cols-2 lg:grid-cols-3">
                {features.map((feature, index) => {
                  const Icon = featureIcons[index % featureIcons.length];
                  return (
                    <article
                      key={feature}
                      className="flex h-[240px] w-full max-w-[420px] flex-col rounded-xl border border-[#1d1d1e] bg-[#0d0f11] p-6 sm:h-[255px] lg:h-[273px] lg:w-[320px]"
                    >
                      <div className="inline-flex h-12 w-12 items-center justify-center rounded-md bg-[#1b1c1d]">
                        <Icon className="h-6 w-6 text-white" strokeWidth={2} />
                      </div>
                      <p className="mt-auto pt-8 text-pretty text-[19px] leading-[1.28] tracking-tight text-foreground sm:text-[20px]">
                        {feature}
                      </p>
                    </article>
                  );
                })}
              </div>

            </div>
          </section>

          <div className="my-20 h-px w-full bg-[#1d1d1e]" />

          <section id="pricing" className="scroll-mt-28 px-4 pb-28 md:px-10 lg:px-20">
            <div className="mx-auto w-full max-w-[1282px]">
              <div className="mx-auto max-w-[860px] text-center">
                <h3 className="text-balance text-4xl font-semibold tracking-tight text-foreground sm:text-5xl sm:leading-[1.08]">
                  Pricing
                </h3>
                <p className="mt-5 text-pretty text-base leading-relaxed text-[#83878e] sm:text-lg">
                  Start free today while GameweekIQ is in beta.
                  <br className="hidden sm:block" />
                  Premium is on the roadmap for managers who want deeper
                  competitive intelligence.
                </p>
              </div>

              <div className="mx-auto mt-14 grid max-w-[760px] grid-cols-1 gap-6 md:grid-cols-2">
                {pricingTiers.map((tier) => (
                  <article
                    key={tier.name}
                    className={`flex min-h-[560px] flex-col rounded-2xl border bg-[#0d0f11] ${
                      tier.highlighted
                        ? "border-[#2f3440] shadow-[0_18px_40px_-28px_rgba(166,186,255,0.45)]"
                        : "border-[#1d1d1e]"
                    }`}
                  >
                    <div className="border-b border-[#1d1d1e] p-7">
                      <h4 className="text-3xl font-semibold tracking-tight text-foreground">
                        {tier.name}
                      </h4>
                      <p className="mt-3 text-2xl font-medium text-foreground">{tier.price}</p>
                      <p className="mt-2 text-sm text-[#83878e]">{tier.subtitle}</p>
                    </div>

                    <ul className="flex-1 space-y-3 p-7">
                      {tier.features.map((feature) => (
                        <li key={feature} className="flex items-start gap-3 text-[15px] text-[#cfd2d8]">
                          <span className="mt-0.5 inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-[#2f3540]">
                            <Check className="h-3.5 w-3.5 text-[#d5defd]" strokeWidth={2.5} />
                          </span>
                          <span>{feature}</span>
                        </li>
                      ))}
                    </ul>

                    <div className="p-7 pt-0">
                      <Link
                        href={
                          tier.cta === "Get started"
                            ? primaryCtaHref
                            : tier.href
                        }
                        className={`inline-flex h-10 w-full items-center justify-center rounded-md text-sm font-semibold transition-all ${
                          tier.highlighted
                            ? "bg-white text-black hover:bg-white/90"
                            : "bg-[#1c2026] text-foreground hover:bg-[#232832]"
                        }`}
                      >
                        {tier.cta === "Get started" ? primaryCtaLabel : tier.cta}
                      </Link>
                    </div>
                  </article>
                ))}
              </div>
            </div>
          </section>
        </section>
      </main>
    </div>
  );
}
