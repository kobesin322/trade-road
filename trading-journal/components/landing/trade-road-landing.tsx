"use client";

import {
  BookOpen,
  ChevronDown,
  Crosshair,
  Flag,
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
  /** Position along the map path 0–1 */
  t: number;
  /** Card offset from path: negative = left, positive = right */
  cardX: number;
  cardY: number;
};

/**
 * Winding map path (viewBox 0 0 800 1400) — inspired by concept trail:
 * peaks → flag → switchbacks → bridge → valley → destination.
 */
const PATH_D =
  "M 400 48 C 360 120, 280 160, 240 220 C 200 280, 220 340, 300 380 C 380 420, 480 400, 540 460 C 600 520, 560 600, 480 640 C 400 680, 280 700, 260 780 C 240 860, 340 900, 420 940 C 500 980, 580 1020, 560 1100 C 540 1180, 420 1220, 380 1280 C 360 1320, 400 1360, 400 1380";

/** Approximate waypoints along path for milestone pins (x,y in viewBox space) */
const PIN_POINTS: Array<{ x: number; y: number }> = [
  { x: 400, y: 48 },
  { x: 240, y: 220 },
  { x: 540, y: 460 },
  { x: 260, y: 780 },
  { x: 560, y: 1100 },
  { x: 400, y: 1380 },
];

const milestones: Milestone[] = [
  {
    id: "journey",
    step: "01",
    title: "The path of a trader",
    subtitle: "Clarity before capital",
    body: "Markets reward process. Trade Road maps your edge as a journey—not a feed of random charts—so every session builds on the last.",
    icon: Route,
    t: 0,
    cardX: -1,
    cardY: 0,
  },
  {
    id: "journal",
    step: "02",
    title: "Trade journal",
    subtitle: "Entries that teach",
    body: "Log pair, plan, outcome, and notes with screenshots. Turn noise into a searchable record you can review after the close.",
    icon: BookOpen,
    t: 0.18,
    cardX: 1,
    cardY: 0,
  },
  {
    id: "portfolio",
    step: "03",
    title: "Portfolio",
    subtitle: "Book and balance",
    body: "Daily long/short snapshots, targets, and regime notes—so exposure is intentional, not accidental overnight drift.",
    icon: WalletCards,
    t: 0.36,
    cardX: -1,
    cardY: 0,
  },
  {
    id: "volume",
    step: "04",
    title: "Volume profile",
    subtitle: "Auction structure",
    body: "Developing and fixed-range profiles with POC, value area, HVN/LVN, and initial balance—AMT language next to your journal.",
    icon: LayoutDashboard,
    t: 0.55,
    cardX: 1,
    cardY: 0,
  },
  {
    id: "risk",
    step: "05",
    title: "Risk to reward",
    subtitle: "Size the road ahead",
    body: "Risk calculator and journal linkage keep R:R visible before you press the trigger—process over impulse.",
    icon: Scale,
    t: 0.78,
    cardX: -1,
    cardY: 0,
  },
  {
    id: "mastery",
    step: "06",
    title: "Compound the craft",
    subtitle: "Dashboard as cockpit",
    body: "CVD research, strategy lab, calendar, and daily overviews in one dark-tech workspace. Open the road and keep driving.",
    icon: Gauge,
    t: 1,
    cardX: 1,
    cardY: 0,
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
      const total = Math.max(rect.height - view * 0.35, 1);
      const traveled = -rect.top + view * 0.2;
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
  const pathRef = useRef<SVGPathElement>(null);
  const reducedMotion = usePrefersReducedMotion();
  const progress = useScrollProgress(roadRef);
  const [navSolid, setNavSolid] = useState(false);
  const [pathLen, setPathLen] = useState(2400);

  useEffect(() => {
    const onScroll = () => setNavSolid(window.scrollY > 24);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  useEffect(() => {
    if (pathRef.current) {
      setPathLen(pathRef.current.getTotalLength());
    }
  }, []);

  const roadFill = reducedMotion ? 1 : progress;
  const dashOffset = pathLen * (1 - roadFill);

  return (
    <div className="relative min-h-dvh overflow-x-hidden bg-[#070a12] text-white">
      <div className="app-shell-bg pointer-events-none fixed inset-0" />
      <div className="app-grain" aria-hidden />

      <div
        className="pointer-events-none fixed -left-32 top-24 h-80 w-80 rounded-full bg-cyan-400/10 blur-3xl"
        style={
          reducedMotion ? undefined : { transform: `translate3d(0, ${progress * -40}px, 0)` }
        }
        aria-hidden
      />
      <div
        className="pointer-events-none fixed -right-24 top-[40%] h-96 w-96 rounded-full bg-sky-500/10 blur-3xl"
        style={
          reducedMotion ? undefined : { transform: `translate3d(0, ${progress * 60}px, 0)` }
        }
        aria-hidden
      />

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
        <section className="relative flex min-h-[100dvh] flex-col justify-center px-4 pb-24 pt-28 sm:px-6">
          <div className="mx-auto grid w-full max-w-6xl gap-12 lg:grid-cols-[1.05fr_0.95fr] lg:items-center">
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
                  Follow the trail
                  <ChevronDown className="h-4 w-4 animate-bounce" />
                </a>
              </div>
              <dl className="mt-10 grid max-w-md grid-cols-3 gap-3">
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

            <HeroMapPreview reducedMotion={reducedMotion} progress={progress} />
          </div>
        </section>

        {/* Map journey */}
        <section
          ref={roadRef}
          id="journey"
          className="relative px-0 pb-28"
          aria-label="Trader journey path map"
        >
          <div className="mx-auto max-w-6xl px-4 sm:px-6">
            <div className="mb-10 max-w-xl md:mb-14">
              <p className="text-[11px] font-semibold tracking-[0.2em] text-cyan-200/70 uppercase">
                Trail map
              </p>
              <h2 className="mt-3 text-3xl font-bold tracking-tight text-white sm:text-4xl">
                A winding road through your process
              </h2>
              <p className="mt-3 text-sm leading-relaxed text-zinc-500 sm:text-base">
                Scroll to light the trail—from the flag at the summit through journal, portfolio,
                volume profile, risk, and mastery.
              </p>
            </div>
          </div>

          {/* Full-bleed map canvas */}
          <div className="relative mx-auto w-full max-w-5xl overflow-hidden px-2 sm:px-4">
            <div className="relative rounded-[1.5rem] border border-white/10 bg-[#0a101c]/90 shadow-[inset_0_1px_0_rgba(255,255,255,0.05)] sm:rounded-[2rem]">
              {/* Terrain SVG background + path */}
              <div className="relative w-full" style={{ aspectRatio: "800 / 1400" }}>
                <svg
                  viewBox="0 0 800 1400"
                  className="absolute inset-0 h-full w-full"
                  preserveAspectRatio="xMidYMid meet"
                  aria-hidden
                >
                  <defs>
                    <linearGradient id="trailStroke" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#67e8f9" />
                      <stop offset="45%" stopColor="#22d3ee" />
                      <stop offset="100%" stopColor="#0ea5e9" />
                    </linearGradient>
                    <linearGradient id="hillFill" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#122033" />
                      <stop offset="100%" stopColor="#0a101c" />
                    </linearGradient>
                    <filter id="softGlow" x="-20%" y="-20%" width="140%" height="140%">
                      <feGaussianBlur stdDeviation="4" result="b" />
                      <feMerge>
                        <feMergeNode in="b" />
                        <feMergeNode in="SourceGraphic" />
                      </feMerge>
                    </filter>
                  </defs>

                  {/* Sky wash */}
                  <rect width="800" height="1400" fill="#080d16" />
                  <ellipse cx="400" cy="80" rx="420" ry="120" fill="rgba(34,211,238,0.06)" />

                  {/* Distant mountains */}
                  <path
                    d="M0 220 L80 140 L160 200 L240 100 L320 180 L400 90 L480 170 L560 110 L640 190 L720 130 L800 200 L800 280 L0 280 Z"
                    fill="#0f1a2a"
                    opacity="0.9"
                  />
                  <path
                    d="M0 260 L100 180 L200 240 L300 150 L420 230 L520 160 L620 240 L720 170 L800 250 L800 320 L0 320 Z"
                    fill="#122033"
                  />

                  {/* Rolling hills */}
                  <path
                    d="M0 520 C 120 460, 200 540, 320 500 S 520 460, 640 520 S 760 500, 800 540 L800 700 L0 700 Z"
                    fill="url(#hillFill)"
                  />
                  <path
                    d="M0 900 C 100 840, 220 920, 360 880 S 560 840, 680 900 S 760 920, 800 880 L800 1100 L0 1100 Z"
                    fill="#0d1726"
                  />
                  <path
                    d="M0 1200 C 140 1140, 280 1220, 420 1180 S 620 1140, 800 1220 L800 1400 L0 1400 Z"
                    fill="#0b1420"
                  />

                  {/* Contour / trail dust lines */}
                  <g stroke="rgba(148,163,184,0.12)" strokeWidth="1" fill="none">
                    <path d="M60 340 C 140 320, 180 360, 260 340" />
                    <path d="M500 300 C 580 280, 640 320, 720 300" />
                    <path d="M80 640 C 160 610, 220 660, 300 630" />
                    <path d="M480 720 C 560 700, 620 740, 720 710" />
                    <path d="M100 1000 C 200 970, 280 1020, 380 990" />
                    <path d="M420 1240 C 500 1210, 580 1260, 680 1230" />
                  </g>

                  {/* Trees (simple pines) */}
                  {[
                    [90, 380],
                    [140, 400],
                    [680, 360],
                    [720, 390],
                    [100, 720],
                    [160, 750],
                    [640, 760],
                    [700, 730],
                    [120, 1050],
                    [680, 1080],
                    [80, 1280],
                    [720, 1260],
                  ].map(([tx, ty], i) => (
                    <g key={i} opacity="0.55">
                      <path
                        d={`M${tx} ${ty - 28} L${tx - 12} ${ty} L${tx + 12} ${ty} Z`}
                        fill="#1a3a4a"
                      />
                      <path
                        d={`M${tx} ${ty - 18} L${tx - 10} ${ty + 6} L${tx + 10} ${ty + 6} Z`}
                        fill="#1e4558"
                      />
                      <rect x={tx - 2} y={ty + 4} width="4" height="10" fill="#2a2a22" />
                    </g>
                  ))}

                  {/* Bridge near mid-trail */}
                  <g transform="translate(200, 760)">
                    <path
                      d="M0 40 Q 80 0, 160 40"
                      fill="none"
                      stroke="rgba(148,163,184,0.45)"
                      strokeWidth="6"
                    />
                    <path
                      d="M0 40 Q 80 8, 160 40"
                      fill="none"
                      stroke="rgba(34,211,238,0.25)"
                      strokeWidth="2"
                    />
                    <line x1="20" y1="36" x2="20" y2="56" stroke="rgba(148,163,184,0.4)" strokeWidth="3" />
                    <line x1="80" y1="20" x2="80" y2="56" stroke="rgba(148,163,184,0.4)" strokeWidth="3" />
                    <line x1="140" y1="36" x2="140" y2="56" stroke="rgba(148,163,184,0.4)" strokeWidth="3" />
                  </g>

                  {/* Path base (untraveled) */}
                  <path
                    d={PATH_D}
                    fill="none"
                    stroke="rgba(255,255,255,0.1)"
                    strokeWidth="14"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                  <path
                    d={PATH_D}
                    fill="none"
                    stroke="rgba(34,211,238,0.15)"
                    strokeWidth="6"
                    strokeLinecap="round"
                    strokeDasharray="10 14"
                  />

                  {/* Path progress fill */}
                  <path
                    ref={pathRef}
                    d={PATH_D}
                    fill="none"
                    stroke="url(#trailStroke)"
                    strokeWidth="10"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeDasharray={pathLen}
                    strokeDashoffset={dashOffset}
                    filter="url(#softGlow)"
                    style={{ transition: reducedMotion ? undefined : "stroke-dashoffset 80ms linear" }}
                  />
                  {/* Center dashes on full trail */}
                  <path
                    d={PATH_D}
                    fill="none"
                    stroke="rgba(255,255,255,0.28)"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeDasharray="8 12"
                    opacity={0.5}
                  />

                  {/* Summit flag */}
                  <g transform="translate(400, 48)">
                    <line x1="0" y1="0" x2="0" y2="36" stroke="#94a3b8" strokeWidth="3" />
                    <path d="M2 2 L28 12 L2 22 Z" fill="#22d3ee" />
                    <circle cx="0" cy="0" r="6" fill="#070a12" stroke="#22d3ee" strokeWidth="2" />
                  </g>

                  {/* Milestone pins */}
                  {PIN_POINTS.map((pt, i) => {
                    const lit = roadFill >= milestones[i].t - 0.02;
                    return (
                      <g key={milestones[i].id} transform={`translate(${pt.x}, ${pt.y})`}>
                        <circle
                          r="16"
                          fill={lit ? "rgba(34,211,238,0.2)" : "rgba(15,23,42,0.8)"}
                          stroke={lit ? "#22d3ee" : "rgba(148,163,184,0.35)"}
                          strokeWidth="2"
                          className="transition-colors duration-500"
                        />
                        <circle r="5" fill={lit ? "#22d3ee" : "#64748b"} />
                        {/* Branch connector stub toward card side */}
                        <line
                          x1={milestones[i].cardX < 0 ? -16 : 16}
                          y1="0"
                          x2={milestones[i].cardX < 0 ? -48 : 48}
                          y2="0"
                          stroke={lit ? "rgba(34,211,238,0.5)" : "rgba(148,163,184,0.25)"}
                          strokeWidth="2"
                          strokeDasharray="4 4"
                        />
                      </g>
                    );
                  })}
                </svg>

                {/* HTML milestone cards overlaid on map */}
                <ol className="pointer-events-none absolute inset-0 hidden list-none md:block">
                  {milestones.map((item, index) => {
                    const pin = PIN_POINTS[index];
                    const lit = roadFill >= item.t - 0.02;
                    const leftPct = (pin.x / 800) * 100;
                    const topPct = (pin.y / 1400) * 100;
                    const Icon = item.icon;
                    const isLeft = item.cardX < 0;

                    return (
                      <li
                        key={item.id}
                        id={item.id}
                        className="pointer-events-auto absolute scroll-mt-28"
                        style={{
                          left: `${leftPct}%`,
                          top: `${topPct}%`,
                          transform: isLeft
                            ? "translate(calc(-100% - 12px), -50%)"
                            : "translate(12px, -50%)",
                          width: "min(38%, 16.5rem)",
                          maxWidth: "16.5rem",
                        }}
                      >
                        <article
                          className={cn(
                            "rounded-2xl border bg-[#0c1422]/92 p-3 shadow-xl backdrop-blur-md transition duration-500 sm:p-4",
                            lit
                              ? "border-cyan-300/40 shadow-cyan-500/10"
                              : "border-white/10 opacity-80",
                            !reducedMotion && "hover:-translate-y-0.5",
                          )}
                        >
                          <div className="flex items-start gap-2.5">
                            <span
                              className={cn(
                                "inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border",
                                lit
                                  ? "border-cyan-300/40 bg-cyan-300/15 text-cyan-200"
                                  : "border-white/10 bg-white/5 text-zinc-400",
                              )}
                            >
                              {index === 0 ? (
                                <Flag className="h-4 w-4" strokeWidth={1.75} />
                              ) : (
                                <Icon className="h-4 w-4" strokeWidth={1.75} />
                              )}
                            </span>
                            <div className="min-w-0">
                              <p className="font-mono text-[10px] font-semibold tracking-widest text-cyan-200/70">
                                {item.step}
                              </p>
                              <h3 className="text-sm font-bold tracking-tight text-white sm:text-base">
                                {item.title}
                              </h3>
                              <p className="mt-0.5 text-xs font-medium text-cyan-100/70">
                                {item.subtitle}
                              </p>
                              <p className="mt-1.5 hidden text-xs leading-relaxed text-zinc-400 sm:block">
                                {item.body}
                              </p>
                            </div>
                          </div>
                        </article>
                      </li>
                    );
                  })}
                </ol>
              </div>
            </div>

            {/* Mobile body text under map (cards are compact) */}
            <div className="mt-8 space-y-4 px-2 md:hidden">
              {milestones.map((item) => {
                const Icon = item.icon;
                return (
                  <div
                    key={`m-${item.id}`}
                    id={item.id}
                    className="scroll-mt-28 rounded-2xl border border-white/10 bg-white/[0.03] p-4"
                  >
                    <div className="flex items-center gap-2 text-cyan-200">
                      <Icon className="h-4 w-4" />
                      <span className="font-mono text-[10px] tracking-widest">{item.step}</span>
                    </div>
                    <h3 className="mt-1 font-bold text-white">{item.title}</h3>
                    <p className="mt-1 text-sm text-zinc-400">{item.body}</p>
                  </div>
                );
              })}
            </div>
          </div>
        </section>

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

function HeroMapPreview({
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
        reducedMotion ? undefined : { transform: `translate3d(0, ${progress * -20}px, 0)` }
      }
    >
      <div className="absolute -inset-4 rounded-[2rem] bg-gradient-to-br from-cyan-400/20 via-transparent to-sky-500/10 blur-2xl" />
      <div className="relative overflow-hidden rounded-[1.75rem] border border-white/10 bg-white/[0.04] p-5 shadow-[inset_0_1px_0_rgba(255,255,255,0.06)] backdrop-blur-md">
        <div className="flex items-center justify-between text-xs text-zinc-500">
          <span className="font-semibold tracking-wide text-cyan-200/80">TRAIL PREVIEW</span>
          <span className="inline-flex items-center gap-1 text-cyan-200/80">
            <Flag className="h-3 w-3" /> Summit
          </span>
        </div>
        <svg viewBox="0 0 320 240" className="mt-3 h-auto w-full" aria-hidden>
          <rect width="320" height="240" rx="14" fill="#080d16" />
          <path
            d="M0 90 L50 50 L90 80 L130 40 L180 75 L220 45 L270 85 L320 55 L320 120 L0 120 Z"
            fill="#122033"
          />
          <path
            d="M0 160 C 60 130, 120 180, 180 150 S 260 140, 320 170 L320 240 L0 240 Z"
            fill="#0d1726"
          />
          {/* mini winding path */}
          <path
            d="M40 40 C 70 70, 50 100, 90 120 S 150 130, 170 160 S 140 190, 200 210"
            fill="none"
            stroke="rgba(255,255,255,0.12)"
            strokeWidth="12"
            strokeLinecap="round"
          />
          <path
            d="M40 40 C 70 70, 50 100, 90 120 S 150 130, 170 160 S 140 190, 200 210"
            fill="none"
            stroke="#22d3ee"
            strokeWidth="5"
            strokeLinecap="round"
            strokeDasharray="8 10"
          />
          <g transform="translate(40,40)">
            <line x1="0" y1="0" x2="0" y2="18" stroke="#94a3b8" strokeWidth="2" />
            <path d="M1 1 L14 7 L1 13 Z" fill="#22d3ee" />
          </g>
          {/* bridge */}
          <path
            d="M120 155 Q 150 140, 180 155"
            fill="none"
            stroke="rgba(148,163,184,0.5)"
            strokeWidth="4"
          />
          {[
            [90, 120],
            [170, 160],
            [200, 210],
          ].map(([x, y], i) => (
            <circle key={i} cx={x} cy={y} r="6" fill="#070a12" stroke="#22d3ee" strokeWidth="2" />
          ))}
        </svg>
        <p className="mt-1 text-center text-xs text-zinc-500">
          Map-style path · peaks, bridge, waypoints
        </p>
      </div>
    </div>
  );
}
