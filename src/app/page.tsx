import Link from "next/link";
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
import { WaitlistSignup } from "@/components/common/WaitlistSignup";
import { getServerSessionUser } from "@/lib/supabaseAuth";

const pillars = [
  {
    title: "Live League Intelligence",
    description:
      "Track every gameweek with near-live updates so you can react before rivals do.",
    icon: Zap,
    imageLight: "/landing/feature-live-league-light.png",
    imageDark: "/landing/feature-live-league-dark.png",
  },
  {
    title: "Decision Impact Analysis",
    description:
      "Quantify rival decisions with clear gain/loss scoring so every move is measurable.",
    icon: BarChart3,
    imageLight: "/landing/feature-impact-analysis-light.png",
    imageDark: "/landing/feature-impact-analysis-dark.png",
  },
  {
    title: "Designed for speed",
    description:
      "Fast loading and instant switching keep insights quick across desktop and mobile.",
    icon: Gauge,
    imageLight: "/landing/feature-speed-light.png",
    imageDark: "/landing/feature-speed-dark.png",
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
    subtitle: "All features are free while in beta*",
    cta: "Get started",
    href: "/api/auth/google/start",
    features: [
      "Live League Table + GW 1 Table",
      "Manager Influence with decision scoring",
      "Near-live updates during active gameweeks",
      "Automatic league backfill on add",
      "Up to 3 tracked clubs/leagues per account",
      "Up to 30 managers per league",
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
  const contactSubject = encodeURIComponent("GameweekIQ enquiry");
  const contactHref = `mailto:hello@gameweekiq.com?subject=${contactSubject}`;

  return (
    <div id="top" className="min-h-svh bg-background text-foreground">
      <header className="sticky top-0 z-40 border-b border-border bg-[#f2f4f8] dark:border-border dark:bg-[#0a0a0a]">
        <div className="px-4 md:px-10 lg:px-20">
          <div className="mx-auto flex h-[72px] w-full max-w-[1282px] items-center justify-between">
            <a
              href="#top"
              className="flex items-center gap-3 transition-opacity hover:opacity-90"
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src="/landing/logo-light.svg"
                alt="GameweekIQ logo"
                className="h-8 w-8 object-contain dark:hidden"
              />
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src="/landing/logo-dark.svg"
                alt="GameweekIQ logo"
                className="hidden h-8 w-8 object-contain dark:block"
              />
              <span className="text-base font-medium tracking-tight">GameweekIQ</span>
            </a>

            <div className="flex items-center gap-3">
              <nav className="hidden items-center gap-2 text-[14px] text-muted-foreground md:flex">
                <a
                  href="#features"
                  className="inline-flex h-8 cursor-pointer items-center rounded-[6px] px-3.5 transition-colors hover:bg-[#e3e8f1] hover:text-foreground dark:hover:bg-[#17181a]"
                >
                  Features
                </a>
                <a
                  href="#pricing"
                  className="inline-flex h-8 cursor-pointer items-center rounded-[6px] px-3.5 transition-colors hover:bg-[#e3e8f1] hover:text-foreground dark:hover:bg-[#17181a]"
                >
                  Pricing
                </a>
                <a
                  href={contactHref}
                  className="inline-flex h-8 cursor-pointer items-center rounded-[6px] px-3.5 transition-colors hover:bg-[#e3e8f1] hover:text-foreground dark:hover:bg-[#17181a]"
                >
                  Contact
                </a>
              </nav>
              <Link
                href={primaryCtaHref}
                className="inline-flex h-8 items-center rounded-[6px] bg-[#171a20] px-3 text-[14px] font-semibold text-[#f2f4f8] transition-opacity hover:opacity-90 dark:bg-[#f2f4f8] dark:text-[#171a20]"
              >
                {primaryCtaLabel}
              </Link>
              <ModeToggle className="h-8 w-8" />
            </div>
          </div>
        </div>
      </header>

      <main>
        <section className="relative overflow-hidden border-b border-border bg-[linear-gradient(to_bottom,#f2f4f8_50%,#e3e8f1_100%)] dark:border-border dark:bg-[linear-gradient(to_bottom,#08090a_50%,#7f8288_100%)]">
          <div className="px-4 md:px-10 lg:px-20">
            <div className="mx-auto w-full max-w-[1282px] pb-24 pt-12 sm:pb-28 sm:pt-32">
            <div className="max-w-[860px]">
              <span className="mb-8 inline-flex items-center rounded-full border border-[#d1d7e2] bg-[#eef2f8]/85 px-4 py-1.5 text-[11px] font-medium text-[#5f6470] backdrop-blur dark:border-border/70 dark:bg-background/75 dark:text-[#83878e] sm:text-sm">
                Built for FPL managers who want an edge every gameweek
              </span>
              <h1 className="text-balance text-4xl font-semibold tracking-[-0.02em] leading-[1.05] sm:text-6xl sm:leading-[1.03]">
                Mini-league standings, decoded.
                <br />
                Every change exposed.
              </h1>
              <p className="mt-6 max-w-2xl text-pretty text-sm leading-relaxed text-[#5f6470] dark:text-[#83878e] sm:max-w-none sm:whitespace-nowrap sm:text-base sm:leading-[1.55]">
                Live, gameweek-by-gameweek insights that show exactly how transfers,
                chips, and captain calls impact your mini-league.
              </p>
            </div>

            <div className="mt-12 sm:mt-14">
              <div className="relative isolate mx-auto w-full max-w-[360px] md:max-w-[1320px]">
                <div className="overflow-hidden rounded-2xl border border-border/70 shadow-[0_26px_58px_-24px_rgba(39,52,77,0.3)] dark:shadow-[0_70px_140px_-55px_rgba(2,6,23,0.8)]">
                  <div className="w-full md:hidden">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src="/landing/mobile-light.png"
                      alt="GameweekIQ mobile dashboard in light mode"
                      className="block h-auto w-full dark:hidden"
                    />
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src="/landing/mobile-dark.png"
                      alt="GameweekIQ mobile dashboard in dark mode"
                      className="hidden h-auto w-full dark:block"
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
                <div className="pointer-events-none absolute inset-x-[8%] -bottom-12 -z-10 h-24 rounded-full bg-slate-500/30 blur-2xl dark:bg-black/50" />
              </div>
            </div>
            </div>
          </div>
        </section>

        <section className="bg-[#f2f4f8] py-16 dark:bg-[#08090a] sm:py-20">
          <div className="px-4 md:px-10 lg:px-20">
            <div className="mx-auto flex w-full max-w-[1282px] flex-col gap-10 sm:gap-16">
              <section>
                <h2 className="max-w-[1100px] pt-2 text-balance text-3xl font-semibold leading-[1.12] tracking-tight text-[#5f6470] dark:text-[#83878e] sm:pt-4 sm:text-5xl sm:leading-[1.08]">
                  <span className="text-foreground">Your league table, upgraded.</span>{" "}
                  Go beyond points totals with
                  decision-level intelligence to quickly understand who gained,
                  who slipped, and why.
                </h2>
              </section>

              <section className="grid grid-cols-1 gap-6 sm:grid-cols-3 sm:gap-0">
                {pillars.map(({ title, description, icon: Icon, imageLight, imageDark }, index) => (
                  <article
                    key={title}
                    className={`p-6 sm:min-h-[460px] sm:p-10 ${
                      index < pillars.length - 1
                        ? "sm:border-r sm:border-border dark:sm:border-border"
                        : ""
                    }`}
                  >
                    <div className="relative h-88 overflow-hidden rounded-lg border border-border bg-[#e9edf4] dark:border-border dark:bg-[#0d0f11]">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={imageLight}
                        alt={`${title} light mode`}
                        className="h-full w-full object-cover object-center opacity-90 dark:hidden"
                      />
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={imageDark}
                        alt={`${title} dark mode`}
                        className="hidden h-full w-full object-cover object-center opacity-80 dark:block"
                      />
                      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(120%_85%_at_50%_18%,rgba(255,255,255,0.16)_0%,rgba(255,255,255,0)_55%)] dark:bg-[radial-gradient(120%_85%_at_50%_18%,rgba(255,255,255,0.08)_0%,rgba(255,255,255,0)_55%)]" />
                      <div className="pointer-events-none absolute inset-0 bg-gradient-to-b from-transparent via-transparent to-background/25 dark:to-black/35" />
                      <div className="pointer-events-none absolute inset-0 shadow-[inset_0_0_0_1px_rgba(255,255,255,0.06),inset_0_-110px_140px_-75px_rgba(15,23,42,0.4)] dark:shadow-[inset_0_0_0_1px_rgba(255,255,255,0.06),inset_0_-110px_140px_-75px_rgba(2,6,23,0.78)]" />
                    </div>
                    <Icon className="mt-6 h-6 w-6 text-[#5f6470] dark:text-[#6a6f76]" strokeWidth={1.8} />
                    <h3 className="mt-4 text-[19px] font-semibold tracking-tight text-foreground sm:text-[20px]">
                      {title}
                    </h3>
                    <p className="mt-3 text-base leading-relaxed text-[#5f6470] dark:text-[#83878e]">
                      {description}
                    </p>
                  </article>
                ))}
              </section>
            </div>
          </div>

          <div className="my-16 h-px w-full bg-border dark:bg-border sm:my-20" />

          <section id="features" className="scroll-mt-28 px-4 pb-16 md:px-10 lg:px-20">
            <div className="mx-auto w-full max-w-[1282px]">
              <div className="mx-auto max-w-[860px] text-center">
                <h3 className="text-balance text-4xl font-semibold tracking-tight text-foreground sm:text-5xl sm:leading-[1.08]">
                  Everything you need to out-think your mini-league rivals.
                </h3>
                <p className="mt-5 text-pretty text-base leading-relaxed text-[#5f6470] dark:text-[#83878e] sm:text-lg">
                  Focused tools built around gameweek decisions, so you can spot
                  <br className="hidden sm:block" />
                  {" "}momentum shifts early and act with confidence.
                </p>
              </div>

              <div className="mx-auto mt-14 grid max-w-[1008px] grid-cols-1 justify-items-center gap-6 sm:grid-cols-2 lg:grid-cols-3">
                {features.map((feature, index) => {
                  const Icon = featureIcons[index % featureIcons.length];
                  return (
                    <article
                      key={feature}
                      className="flex h-[240px] w-full max-w-[420px] flex-col rounded-xl border border-border bg-[#e9edf4] p-6 dark:border-border dark:bg-[#0d0f11] sm:h-[255px] lg:h-[273px] lg:w-[320px]"
                    >
                      <div className="inline-flex h-12 w-12 items-center justify-center rounded-md bg-[#dde3ec] dark:bg-[#1b1c1d]">
                        <Icon className="h-6 w-6 text-[#171a20] dark:text-white" strokeWidth={2} />
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

          <div className="my-16 h-px w-full bg-border dark:bg-border sm:my-20" />

          <section id="pricing" className="scroll-mt-28 px-4 pb-28 md:px-10 lg:px-20">
            <div className="mx-auto w-full max-w-[1282px]">
              <div className="mx-auto max-w-[860px] text-center">
                <h3 className="text-balance text-4xl font-semibold tracking-tight text-foreground sm:text-5xl sm:leading-[1.08]">
                  Pricing
                </h3>
                <p className="mt-5 text-pretty text-base leading-relaxed text-[#5f6470] dark:text-[#83878e] sm:text-lg">
                  Start free today while GameweekIQ is in beta.{" "}
                  <br className="sm:hidden" />
                  <br className="hidden sm:block" />
                  Premium is on the roadmap for managers who want deeper
                  competitive intelligence.
                </p>
              </div>

              <div className="mx-auto mt-14 grid max-w-[760px] grid-cols-1 gap-6 md:grid-cols-2">
                {pricingTiers.map((tier) => (
                  <article
                    key={tier.name}
                    className={`flex min-h-[560px] flex-col rounded-2xl border bg-[#e9edf4] dark:bg-[#0d0f11] ${
                      tier.highlighted
                        ? "border-[#bcc5d3] shadow-[0_18px_40px_-28px_rgba(44,51,65,0.2)] dark:border-border dark:shadow-[0_18px_40px_-28px_rgba(166,186,255,0.45)]"
                        : "border-border dark:border-border"
                    }`}
                  >
                    <div className="border-b border-border p-7 dark:border-border">
                      <h4 className="text-3xl font-semibold tracking-tight text-foreground">
                        {tier.name}
                      </h4>
                      <p className="mt-3 text-2xl font-medium text-foreground">{tier.price}</p>
                      <p className="mt-2 text-sm text-[#5f6470] dark:text-[#83878e]">{tier.subtitle}</p>
                    </div>

                    <ul className="flex-1 space-y-3 p-7">
                      {tier.features.map((feature) => (
                        <li key={feature} className="flex items-start gap-3 text-[15px] text-[#434955] dark:text-[#cfd2d8]">
                          <span className="mt-0.5 inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-[#cfd8e6] dark:bg-[#2f3540]">
                            <Check className="h-3.5 w-3.5 text-[#2f3949] dark:text-[#d5defd]" strokeWidth={2.5} />
                          </span>
                          <span>{feature}</span>
                        </li>
                      ))}
                    </ul>

                    <div className="p-7 pt-0">
                      {tier.cta === "Join waitlist" ? (
                        <WaitlistSignup />
                      ) : (
                        <Link
                          href={primaryCtaHref}
                          className="inline-flex h-10 w-full items-center justify-center rounded-md bg-white text-sm font-semibold text-black transition-all hover:bg-white/90"
                        >
                          {primaryCtaLabel}
                        </Link>
                      )}
                    </div>
                  </article>
                ))}
              </div>
              <p className="mx-auto mt-6 max-w-[760px] text-center text-xs text-[#5f6470] dark:text-[#83878e]">
                *Beta capacity limits apply and may change as infrastructure scales.
              </p>
            </div>
          </section>
        </section>
      </main>
    </div>
  );
}
