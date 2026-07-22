"use client";

import {
  BookOpen,
  ChevronDown,
  Crosshair,
  Gauge,
  LayoutDashboard,
  Route,
  Scale,
  Sparkles,
  WalletCards,
} from "lucide-react";
import Link from "next/link";
import { useEffect, useRef, useState, type RefObject } from "react";

import { cn } from "@/lib/utils";

type Milestone = {
  id: string;
  step: string;
  title: string;
  subtitle: string;
  body: string;
  icon: typeof BookOpen;
  side: "left" | "right";
  accent: string;
};

const milestones: Milestone[] = [
  {
    id: "journey",
    step: "01",
    title: "The path of a trader",
    subtitle: "Clarity before capital",
    body: "Markets reward process. Trade Road maps your edge as a journey—not a feed of random charts—so every session builds on the last.",
    icon: Route,
    side: "left",
    accent: "from-cyan-400/20 to-transparent",
  },
  {
    id: "journal",
    step: "02",
    title: "Trade journal",
    subtitle: "Entries that teach",
    body: "Log pair, plan, outcome, and notes with screenshots. Turn noise into a searchable record you can review after the close.",
    icon: BookOpen,
    side: "right",
    accent: "from-sky-400/20 to-transparent",
  },
  {
    id: "portfolio",
    step: "03",
    title: "Portfolio",
    subtitle: "Book and balance",
    body: "Daily long/short snapshots, targets, and regime notes—so exposure is intentional, not accidental overnight drift.",
    icon: WalletCards,
    side: "left",
    accent: "from-emerald-400/15 to-transparent",
  },
  {
    id: "volume",
    step: "04",
    title: "Volume profile",
    subtitle: "Auction structure",
    body: "Developing and fixed-range profiles with POC, value area, HVN/LVN, and initial balance—AMT language that sits next to your journal.",
    icon: LayoutDashboard,
    side: "right",
    accent: "from-amber-400/15 to-transparent",
  },
  {
    id: "risk",
    step: "05",
    title: "Risk to reward",
    subtitle: "Size the road ahead",
    body: "Risk calculator and journal linkage keep R:R visible before you press the trigger—process over impulse.",
    icon: Scale,
    side: "left",
    accent: "from-fuchsia-400/10 to-transparent",
  },
  {
    id: "mastery",
    step: "06",
    title: "Compound the craft",
    subtitle: "Dashboard as cockpit",
    body: "CVD research, strategy lab, calendar, and daily overviews in one dark-tech workspace. Open the road and keep driving.",
    icon: Gauge,
    side: "right",
    accent: "from-cyan-300/20 to-transparent",
  },
];

function usePrefersReducedMotion() {
  const [reduced, setReduced] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    setReduced(mq.matches);
    const onChange = () => setReduced(mq.matches);
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, []);
  return reduced;
}

function useScrollProgress(ref: RefObject<HTMLElement | null>) {
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    const el = ref.current;
    if (!el) {
      return;
    }

    let frame = 0;
    const update = () => {
      frame = 0;
      const rect = el.getBoundingClientRect();
      const view = window.innerHeight || 1;
      const total = rect.height + view;
      const traveled = view - rect.top;
      setProgress(Math.min(1, Math.max(0, traveled / total)));
    };

    const onScroll = () => {
      if (frame) {
        return;
      }
      frame = window.requestAnimationFrame(update);
    };

    update();
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll);
    return () => {
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
      if (frame) {
        window.cancelAnimationFrame(frame);
      }
    };
  }, [ref]);

  return progress;
}

export function TradeRoadLanding() {
  const roadRef = useRef<HTMLElement>(null);
  const reducedMotion = usePrefersReducedMotion();
  const progress = useScrollProgress(roadRef);
  const [navSolid, setNavSolid] = useState(false);

  useEffect(() => {
    const onScroll = () => setNavSolid(window.scrollY > 24);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  const roadFill = reducedMotion ? 1 : progress;

  return (
    <div className="relative min-h-dvh overflow-x-hidden bg-[#070a12] text-white">
      <div className="app-shell-bg pointer-events-none fixed inset-0" />
      <div className="app-grain" aria-hidden />

      {/* Ambient orbs (parallax-lite via fixed layers) */}
      <div
        className="pointer-events-none fixed -left-32 top-24 h-80 w-80 rounded-full bg-cyan-400/10 blur-3xl"
        style={
          reducedMotion
            ? undefined
            : { transform: `translate3d(0, ${progress * -40}px, 0)` }
        }
        aria-hidden
      />
      <div
        className="pointer-events-none fixed -right-24 top-[40%] h-96 w-96 rounded-full bg-sky-500/10 blur-3xl"
        style={
          reducedMotion
            ? undefined
            : { transform: `translate3d(0, ${progress * 60}px, 0)` }
        }
        aria-hidden
      />

      {/* Nav */}
      <header
        className={cn(
          "fixed inset-x-0 top-0 z-50 transition-[background-color,border-color,backdrop-filter] duration-300",
          navSolid
            ? "border-b border-white/10 bg-[#070a12]/80 backdrop-blur-xl"
            : "border-b border-transparent bg-transparent",
        )}
        style={{ paddingTop: "env(safe-area-inset-top, 0px)" }}
      >
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4 sm:px-6">
          <Link href="/" className="flex items-center gap-2 text-sm font-semibold tracking-wide">
            <span className="inline-flex h-8 w-8 items-center justify-center rounded-xl border border-cyan-300/30 bg-cyan-300/10 text-cyan-200">
              <Sparkles className="h-4 w-4" strokeWidth={1.75} />
            </span>
            <span className="text-white">Trade Road</span>
          </Link>
          <nav className="hidden items-center gap-6 text-sm text-zinc-400 md:flex" aria-label="Landing">
            <a href="#journey" className="transition hover:text-white">
              Journey
            </a>
            <a href="#journal" className="transition hover:text-white">
              Journal
            </a>
            <a href="#volume" className="transition hover:text-white">
              Profile
            </a>
            <a href="#risk" className="transition hover:text-white">
              Risk
            </a>
          </nav>
          <div className="flex items-center gap-2">
            <Link
              href="/login"
              className="inline-flex min-h-11 items-center rounded-full px-4 text-sm font-semibold text-zinc-300 transition hover:text-white"
            >
              Sign in
            </Link>
            <Link
              href="/login"
              className="inline-flex min-h-11 items-center rounded-full border border-cyan-300/40 bg-cyan-300 px-4 text-sm font-bold text-slate-950 transition hover:bg-cyan-200 active:scale-[0.98]"
            >
              Open the road
            </Link>
          </div>
        </div>
      </header>

      <main id="main-content">
        {/* Hero */}
        <section className="relative flex min-h-[100dvh] flex-col justify-center px-4 pb-24 pt-28 sm:px-6">
          <div className="mx-auto grid w-full max-w-6xl gap-12 lg:grid-cols-[1.1fr_0.9fr] lg:items-center">
            <div>
              <p className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.04] px-3 py-1.5 text-[11px] font-semibold tracking-[0.18em] text-cyan-200/80 uppercase">
                <Crosshair className="h-3.5 w-3.5" />
                Futures · Crypto · Cash equities
              </p>
              <h1 className="mt-6 max-w-[14ch] text-4xl font-bold tracking-tight text-balance text-white sm:text-5xl lg:text-6xl">
                Your trading journey, mapped as a road
              </h1>
              <p className="mt-5 max-w-[48ch] text-base leading-relaxed text-zinc-400 sm:text-lg">
                A dark-tech journal and auction cockpit for serious process: log trades, track the
                book, read volume structure, and size risk before you execute.
              </p>
              <div className="mt-8 flex flex-wrap items-center gap-3">
                <Link
                  href="/login"
                  className="inline-flex min-h-12 items-center justify-center rounded-full bg-cyan-300 px-6 text-sm font-bold text-slate-950 transition hover:bg-cyan-200 active:scale-[0.98]"
                >
                  Start free
                </Link>
                <a
                  href="#journey"
                  className="inline-flex min-h-12 items-center justify-center gap-2 rounded-full border border-white/15 bg-white/[0.04] px-6 text-sm font-semibold text-zinc-200 transition hover:border-cyan-300/40 hover:bg-cyan-300/10"
                >
                  Scroll the path
                  <ChevronDown className="h-4 w-4 animate-bounce" />
                </a>
              </div>
              <dl className="mt-10 grid grid-cols-3 gap-3 max-w-md">
                {[
                  ["Journal", "Process"],
                  ["Profile", "Structure"],
                  ["R:R", "Discipline"],
                ].map(([k, v]) => (
                  <div
                    key={k}
                    className="rounded-2xl border border-white/10 bg-white/[0.03] px-3 py-3"
                  >
                    <dt className="text-[11px] font-medium text-zinc-500">{k}</dt>
                    <dd className="mt-1 text-sm font-semibold text-cyan-100">{v}</dd>
                  </div>
                ))}
              </dl>
            </div>

            <HeroRoadCard reducedMotion={reducedMotion} progress={progress} />
          </div>
        </section>

        {/* Journey with road spine */}
        <section
          ref={roadRef}
          id="journey"
          className="relative mx-auto max-w-6xl px-4 pb-28 sm:px-6"
          aria-label="Trader journey path"
        >
          <div className="mb-14 max-w-xl">
            <p className="text-[11px] font-semibold tracking-[0.2em] text-cyan-200/70 uppercase">
              The road
            </p>
            <h2 className="mt-3 text-3xl font-bold tracking-tight text-white sm:text-4xl">
              Six milestones. One continuous path.
            </h2>
            <p className="mt-3 text-sm leading-relaxed text-zinc-500 sm:text-base">
              Scroll to travel the route—from first intent through journal, portfolio, volume
              profile, and risk.
            </p>
          </div>

          <div className="relative">
            {/* Road spine */}
            <div
              className="pointer-events-none absolute left-1/2 top-0 bottom-0 hidden w-1 -translate-x-1/2 md:block"
              aria-hidden
            >
              <div className="absolute inset-0 rounded-full bg-white/10" />
              <div
                className="absolute inset-x-0 top-0 rounded-full bg-gradient-to-b from-cyan-300 via-sky-400 to-cyan-500 shadow-[0_0_24px_rgba(34,211,238,0.45)]"
                style={{ height: `${roadFill * 100}%` }}
              />
              {/* dashed center line effect */}
              <div
                className="absolute inset-x-[1px] top-0 bottom-0 border-l border-dashed border-white/20"
                style={{ opacity: 0.5 }}
              />
            </div>

            {/* Mobile road */}
            <div
              className="pointer-events-none absolute left-5 top-0 bottom-0 w-0.5 bg-white/10 md:hidden"
              aria-hidden
            >
              <div
                className="absolute inset-x-0 top-0 bg-cyan-300/80"
                style={{ height: `${roadFill * 100}%` }}
              />
            </div>

            <ol className="space-y-10 md:space-y-24">
              {milestones.map((item, index) => (
                <MilestoneCard
                  key={item.id}
                  item={item}
                  index={index}
                  reducedMotion={reducedMotion}
                  active={progress > index / milestones.length}
                />
              ))}
            </ol>
          </div>
        </section>

        {/* Closing CTA */}
        <section className="relative border-t border-white/10 px-4 py-24 sm:px-6">
          <div className="mx-auto max-w-3xl text-center">
            <p className="text-[11px] font-semibold tracking-[0.2em] text-cyan-200/70 uppercase">
              Next waypoint
            </p>
            <h2 className="mt-4 text-3xl font-bold tracking-tight text-balance text-white sm:text-4xl">
              Step onto the road
            </h2>
            <p className="mx-auto mt-4 max-w-[48ch] text-sm leading-relaxed text-zinc-400 sm:text-base">
              Sign in to open your journal, portfolio snapshots, volume profile lab, and risk tools
              in one futuristic cockpit.
            </p>
            <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
              <Link
                href="/login"
                className="inline-flex min-h-12 items-center rounded-full bg-cyan-300 px-8 text-sm font-bold text-slate-950 transition hover:bg-cyan-200 active:scale-[0.98]"
              >
                Enter Trade Road
              </Link>
              <Link
                href="/app"
                className="inline-flex min-h-12 items-center rounded-full border border-white/15 bg-white/[0.04] px-8 text-sm font-semibold text-zinc-200 transition hover:border-cyan-300/40"
              >
                I already have access
              </Link>
            </div>
          </div>
        </section>
      </main>

      <footer className="border-t border-white/10 px-4 py-8 text-center text-xs text-zinc-600 sm:px-6">
        <p>Trade Road · process infrastructure for discretionary traders</p>
      </footer>
    </div>
  );
}

function HeroRoadCard({
  reducedMotion,
  progress,
}: {
  reducedMotion: boolean;
  progress: number;
}) {
  return (
    <div
      className="relative mx-auto w-full max-w-md"
      style={
        reducedMotion
          ? undefined
          : { transform: `translate3d(0, ${progress * -24}px, 0)` }
      }
    >
      <div className="absolute -inset-4 rounded-[2rem] bg-gradient-to-br from-cyan-400/20 via-transparent to-sky-500/10 blur-2xl" />
      <div className="relative overflow-hidden rounded-[1.75rem] border border-white/10 bg-white/[0.04] p-6 shadow-[inset_0_1px_0_rgba(255,255,255,0.06)] backdrop-blur-md">
        <div className="flex items-center justify-between text-xs text-zinc-500">
          <span className="font-semibold tracking-wide text-cyan-200/80">SESSION MAP</span>
          <span className="font-mono tabular-nums text-zinc-400">LIVE</span>
        </div>
        <svg viewBox="0 0 320 220" className="mt-4 h-auto w-full" aria-hidden>
          <defs>
            <linearGradient id="roadGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#22d3ee" stopOpacity="0.9" />
              <stop offset="100%" stopColor="#0ea5e9" stopOpacity="0.3" />
            </linearGradient>
          </defs>
          <rect width="320" height="220" rx="16" fill="#0a0f18" />
          <path
            d="M40 30 C 80 50, 90 90, 120 110 S 200 140, 220 170 S 280 200, 290 210"
            fill="none"
            stroke="url(#roadGrad)"
            strokeWidth="10"
            strokeLinecap="round"
          />
          <path
            d="M40 30 C 80 50, 90 90, 120 110 S 200 140, 220 170 S 280 200, 290 210"
            fill="none"
            stroke="rgba(255,255,255,0.35)"
            strokeWidth="1.5"
            strokeDasharray="6 8"
            strokeLinecap="round"
          />
          {[
            [40, 30],
            [120, 110],
            [220, 170],
            [290, 210],
          ].map(([x, y], i) => (
            <g key={i}>
              <circle cx={x} cy={y} r="8" fill="#070a12" stroke="#22d3ee" strokeWidth="2" />
              <circle cx={x} cy={y} r="3" fill="#22d3ee" />
            </g>
          ))}
          <text x="52" y="28" fill="#a1a1aa" fontSize="10" fontFamily="system-ui">
            Start
          </text>
          <text x="130" y="108" fill="#a1a1aa" fontSize="10" fontFamily="system-ui">
            Journal
          </text>
          <text x="228" y="168" fill="#a1a1aa" fontSize="10" fontFamily="system-ui">
            Profile
          </text>
          <text x="240" y="208" fill="#67e8f9" fontSize="10" fontFamily="system-ui">
            R:R
          </text>
        </svg>
        <p className="mt-2 text-center text-xs text-zinc-500">
          Parallax journey · exchange-grade dark UI
        </p>
      </div>
    </div>
  );
}

function MilestoneCard({
  item,
  index,
  reducedMotion,
  active,
}: {
  item: Milestone;
  index: number;
  reducedMotion: boolean;
  active: boolean;
}) {
  const Icon = item.icon;
  const isLeft = item.side === "left";

  return (
    <li
      id={item.id}
      className={cn(
        "relative grid scroll-mt-28 gap-4 md:grid-cols-2 md:gap-16",
        "pl-12 md:pl-0",
      )}
    >
      {/* Node on road */}
      <div
        className={cn(
          "absolute left-5 top-8 z-10 flex h-3 w-3 -translate-x-1/2 items-center justify-center md:left-1/2 md:top-1/2 md:-translate-y-1/2",
        )}
        aria-hidden
      >
        <span
          className={cn(
            "h-3 w-3 rounded-full border-2 border-cyan-300 bg-[#070a12] transition duration-500",
            active && "bg-cyan-300 shadow-[0_0_16px_rgba(34,211,238,0.8)]",
          )}
        />
      </div>

      <div
        className={cn(
          "md:col-span-1",
          isLeft ? "md:col-start-1 md:pr-12 md:text-right" : "md:col-start-2 md:pl-12",
          !isLeft && "md:row-start-1",
        )}
      >
        <article
          className={cn(
            "rounded-2xl border border-white/10 bg-white/[0.035] p-6 shadow-[inset_0_1px_0_rgba(255,255,255,0.06)] transition duration-500",
            "bg-gradient-to-br",
            item.accent,
            active ? "border-cyan-300/30" : "opacity-90",
            !reducedMotion && "hover:-translate-y-0.5 hover:border-cyan-300/40",
          )}
        >
          <div
            className={cn(
              "flex items-center gap-3",
              isLeft && "md:flex-row-reverse",
            )}
          >
            <span className="inline-flex h-11 w-11 items-center justify-center rounded-xl border border-white/10 bg-black/40 text-cyan-200">
              <Icon className="h-5 w-5" strokeWidth={1.75} />
            </span>
            <div className={cn(isLeft && "md:text-right")}>
              <p className="font-mono text-[11px] font-semibold tracking-widest text-cyan-200/70">
                {item.step}
              </p>
              <h3 className="text-xl font-bold tracking-tight text-white">{item.title}</h3>
            </div>
          </div>
          <p
            className={cn(
              "mt-2 text-sm font-medium text-cyan-100/80",
              isLeft && "md:text-right",
            )}
          >
            {item.subtitle}
          </p>
          <p
            className={cn(
              "mt-3 text-sm leading-relaxed text-zinc-400",
              isLeft && "md:ml-auto md:max-w-[36ch] md:text-right",
              !isLeft && "max-w-[40ch]",
            )}
          >
            {item.body}
          </p>
        </article>
      </div>

      {/* Spacer column for alternating layout */}
      <div
        className={cn(
          "hidden md:block",
          isLeft ? "md:col-start-2" : "md:col-start-1 md:row-start-1",
        )}
        aria-hidden
      >
        <div
          className={cn(
            "mt-10 font-mono text-6xl font-bold text-white/[0.04]",
            isLeft ? "text-left pl-8" : "text-right pr-8",
          )}
        >
          {item.step}
        </div>
      </div>
      <span className="sr-only">Milestone {index + 1}</span>
    </li>
  );
}
