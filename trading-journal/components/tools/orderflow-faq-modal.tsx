"use client";

import type { ReactNode } from "react";

import { Modal } from "@/components/ui/modal";

type OrderflowFaqModalProps = {
  open: boolean;
  onClose: () => void;
};

type LegendItem = {
  swatch: ReactNode;
  label: string;
  meaning: string;
};

type ExampleItem = {
  title: string;
  body: string;
};

type FaqSection = {
  id: string;
  title: string;
  paragraphs: string[];
  legend?: LegendItem[];
  examples?: ExampleItem[];
  diagram?: ReactNode;
  diagramTitle?: string;
};

function DiagramFrame({ title, children }: { title: string; children: ReactNode }) {
  return (
    <figure className="overflow-hidden rounded-2xl border border-white/10 bg-black/40">
      <figcaption className="border-b border-white/10 px-3 py-2 text-[11px] font-semibold tracking-wide text-zinc-500">
        {title}
      </figcaption>
      <div className="flex justify-center p-4">{children}</div>
    </figure>
  );
}

function LegendList({ items }: { items: LegendItem[] }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-3">
      <div className="mb-2 text-[11px] font-semibold uppercase tracking-[0.14em] text-zinc-500">
        Legend
      </div>
      <ul className="space-y-2.5">
        {items.map((item) => (
          <li key={item.label} className="flex gap-3 text-sm">
            <span className="mt-0.5 flex h-6 w-8 shrink-0 items-center justify-center">{item.swatch}</span>
            <span>
              <span className="font-semibold text-zinc-200">{item.label}</span>
              <span className="text-zinc-500"> — {item.meaning}</span>
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}

function ExampleList({ items }: { items: ExampleItem[] }) {
  return (
    <div className="space-y-2">
      <div className="text-[11px] font-semibold uppercase tracking-[0.14em] text-zinc-500">
        Examples
      </div>
      {items.map((item) => (
        <div
          key={item.title}
          className="rounded-2xl border border-cyan-300/15 bg-cyan-300/[0.06] px-3 py-2.5"
        >
          <div className="text-sm font-semibold text-cyan-100">{item.title}</div>
          <p className="mt-1 text-sm leading-relaxed text-zinc-400">{item.body}</p>
        </div>
      ))}
    </div>
  );
}

function SwatchCircle({
  fill,
  ring,
}: {
  fill: string;
  ring?: string;
}) {
  return (
    <span
      className="inline-block h-3.5 w-3.5 rounded-full"
      style={{
        backgroundColor: fill,
        boxShadow: ring ? `0 0 0 2px ${ring}` : undefined,
      }}
    />
  );
}

function SwatchDiamond({ fill }: { fill: string }) {
  return (
    <span
      className="inline-block h-3 w-3 rotate-45"
      style={{ backgroundColor: fill }}
    />
  );
}

function SwatchCell({ left, right }: { left: string; right: string }) {
  return (
    <span className="inline-flex h-3.5 w-7 overflow-hidden rounded-sm border border-white/20">
      <span className="h-full w-1/2" style={{ backgroundColor: left }} />
      <span className="h-full w-1/2" style={{ backgroundColor: right }} />
    </span>
  );
}

function SwatchHeat() {
  return (
    <span className="inline-block h-2.5 w-7 rounded-sm bg-gradient-to-r from-rose-500/70 via-emerald-500/50 to-emerald-400/80" />
  );
}

function CvdDiagram() {
  return (
    <svg viewBox="0 0 320 140" className="h-auto w-full max-w-sm" aria-hidden>
      <rect width="320" height="140" fill="#0a0f18" rx="12" />
      <text x="16" y="24" fill="#71717a" fontSize="11" fontFamily="system-ui">
        Price ($)
      </text>
      <polyline
        points="20,50 60,40 100,55 140,35 180,60 220,45 260,70 300,50"
        fill="none"
        stroke="#a1a1aa"
        strokeWidth="2"
      />
      <text x="16" y="100" fill="#71717a" fontSize="11" fontFamily="system-ui">
        Proxy CVD (vol units)
      </text>
      <polyline
        points="20,120 60,115 100,105 140,90 180,95 220,80 260,75 300,65"
        fill="none"
        stroke="#22d3ee"
        strokeWidth="2.5"
      />
    </svg>
  );
}

function SignalMarkersDiagram() {
  return (
    <svg viewBox="0 0 320 150" className="h-auto w-full max-w-sm" aria-hidden>
      <rect width="320" height="150" fill="#0a0f18" rx="12" />
      <text x="16" y="22" fill="#71717a" fontSize="10" fontFamily="system-ui">
        Price + Delta chart
      </text>
      <polyline
        points="24,90 60,70 100,78 140,55 180,62 220,48 260,58 300,42"
        fill="none"
        stroke="#f8fafc"
        strokeWidth="2"
      />
      {[40, 70, 100, 130, 160, 190, 220, 250].map((x, i) => (
        <rect
          key={x}
          x={x}
          y={i % 2 === 0 ? 100 : 110}
          width="14"
          height={i % 2 === 0 ? 28 : 18}
          rx="2"
          fill="rgba(34,211,238,0.35)"
        />
      ))}
      <circle cx="140" cy="55" r="6" fill="#22c55e" stroke="rgba(255,255,255,0.9)" strokeWidth="1.5" />
      <circle cx="220" cy="48" r="6" fill="#fb7185" stroke="rgba(255,255,255,0.9)" strokeWidth="1.5" />
      <text x="150" y="48" fill="#22c55e" fontSize="10" fontFamily="system-ui">
        Long
      </text>
      <text x="230" y="42" fill="#fb7185" fontSize="10" fontFamily="system-ui">
        Short
      </text>
      <text x="16" y="140" fill="#71717a" fontSize="10" fontFamily="system-ui">
        Green = long entry · Red = short entry
      </text>
    </svg>
  );
}

function ProfileDiagram() {
  return (
    <svg viewBox="0 0 320 160" className="h-auto w-full max-w-sm" aria-hidden>
      <rect width="320" height="160" fill="#0a0f18" rx="12" />
      {[
        [40, 20],
        [55, 35],
        [70, 55],
        [90, 90],
        [70, 60],
        [50, 40],
        [35, 25],
      ].map(([w], i) => (
        <rect
          key={i}
          x="40"
          y={18 + i * 18}
          width={w}
          height="12"
          rx="3"
          fill={i === 3 ? "#22d3ee" : "rgba(34,211,238,0.35)"}
        />
      ))}
      <line x1="160" y1="16" x2="160" y2="144" stroke="#fbbf24" strokeWidth="1.5" strokeDasharray="4 3" />
      <text x="168" y="30" fill="#fbbf24" fontSize="10" fontFamily="system-ui">
        POC
      </text>
      <rect x="155" y="36" width="6" height="72" fill="rgba(52,211,153,0.25)" />
      <text x="168" y="50" fill="#6ee7b7" fontSize="10" fontFamily="system-ui">
        VAH
      </text>
      <text x="168" y="108" fill="#6ee7b7" fontSize="10" fontFamily="system-ui">
        VAL
      </text>
      <text x="40" y="152" fill="#71717a" fontSize="10" fontFamily="system-ui">
        Volume at price (OHLCV distribution)
      </text>
    </svg>
  );
}

function HvnLvnDiagram() {
  return (
    <svg viewBox="0 0 320 120" className="h-auto w-full max-w-sm" aria-hidden>
      <rect width="320" height="120" fill="#0a0f18" rx="12" />
      <polyline
        points="20,90 50,70 80,40 110,75 140,85 170,45 200,80 230,55 260,88 300,70"
        fill="none"
        stroke="rgba(34,211,238,0.5)"
        strokeWidth="2"
      />
      <circle cx="80" cy="40" r="5" fill="#34d399" />
      <circle cx="170" cy="45" r="5" fill="#34d399" />
      <circle cx="140" cy="85" r="5" fill="#fb7185" />
      <text x="90" y="36" fill="#34d399" fontSize="10" fontFamily="system-ui">
        HVN
      </text>
      <text x="148" y="100" fill="#fb7185" fontSize="10" fontFamily="system-ui">
        LVN
      </text>
    </svg>
  );
}

function IbDiagram() {
  return (
    <svg viewBox="0 0 320 130" className="h-auto w-full max-w-sm" aria-hidden>
      <rect width="320" height="130" fill="#0a0f18" rx="12" />
      <rect x="30" y="30" width="80" height="70" fill="rgba(251,191,36,0.12)" stroke="#fbbf24" />
      <text x="40" y="24" fill="#fbbf24" fontSize="10" fontFamily="system-ui">
        Initial Balance
      </text>
      <text x="40" y="52" fill="#a1a1aa" fontSize="10" fontFamily="system-ui">
        IB High
      </text>
      <text x="40" y="90" fill="#a1a1aa" fontSize="10" fontFamily="system-ui">
        IB Low
      </text>
      <polyline
        points="110,60 150,50 190,70 230,40 270,55 300,48"
        fill="none"
        stroke="#a1a1aa"
        strokeWidth="2"
      />
      <text x="120" y="120" fill="#71717a" fontSize="10" fontFamily="system-ui">
        Rest of session develops outside IB
      </text>
    </svg>
  );
}

/** One footprint bar: bid left / ask right cells */
function FootprintCellDiagram() {
  return (
    <svg viewBox="0 0 340 200" className="h-auto w-full max-w-md" aria-hidden>
      <rect width="340" height="200" fill="#0a0f18" rx="12" />
      <text x="16" y="22" fill="#71717a" fontSize="11" fontFamily="system-ui">
        One bar · price up → down
      </text>

      {/* price labels */}
      {["101.00", "100.75", "100.50", "100.25", "100.00"].map((p, i) => (
        <text key={p} x="16" y={48 + i * 26} fill="#71717a" fontSize="10" fontFamily="ui-monospace, monospace">
          {p}
        </text>
      ))}

      {/* cells: left bid (rose), right ask (emerald) with opacity by size */}
      {[
        { bid: 12, ask: 48, ba: 0.25, aa: 0.85 },
        { bid: 28, ask: 55, ba: 0.4, aa: 0.9 },
        { bid: 40, ask: 35, ba: 0.55, aa: 0.5 },
        { bid: 62, ask: 18, ba: 0.85, aa: 0.3 },
        { bid: 30, ask: 10, ba: 0.45, aa: 0.2 },
      ].map((row, i) => {
        const y = 36 + i * 26;
        return (
          <g key={i}>
            <rect x="70" y={y} width="70" height="20" rx="3" fill={`rgba(251,113,133,${row.ba})`} />
            <rect x="142" y={y} width="70" height="20" rx="3" fill={`rgba(52,211,153,${row.aa})`} />
            <text x="100" y={y + 14} textAnchor="middle" fill="#fecdd3" fontSize="10" fontFamily="ui-monospace, monospace">
              {row.bid}
            </text>
            <text x="177" y={y + 14} textAnchor="middle" fill="#a7f3d0" fontSize="10" fontFamily="ui-monospace, monospace">
              {row.ask}
            </text>
          </g>
        );
      })}

      <text x="70" y="180" fill="#fb7185" fontSize="10" fontFamily="system-ui">
        Bid / sell ←
      </text>
      <text x="155" y="180" fill="#34d399" fontSize="10" fontFamily="system-ui">
        → Ask / buy
      </text>
      <text x="230" y="52" fill="#a1a1aa" fontSize="10" fontFamily="system-ui">
        Brighter = more vol
      </text>
      <text x="230" y="78" fill="#a1a1aa" fontSize="10" fontFamily="system-ui">
        Top row: buys win
      </text>
      <text x="230" y="100" fill="#a1a1aa" fontSize="10" fontFamily="system-ui">
        (ask 48 &gt; bid 12)
      </text>
    </svg>
  );
}

function HeatTrailDiagram() {
  return (
    <svg viewBox="0 0 340 170" className="h-auto w-full max-w-md" aria-hidden>
      <rect width="340" height="170" fill="#0a0f18" rx="12" />
      <text x="16" y="22" fill="#71717a" fontSize="11" fontFamily="system-ui">
        Time → · residual heat at price
      </text>

      {/* horizontal trails that fade */}
      {[
        { y: 50, color: "#34d399", label: "Buy heat" },
        { y: 85, color: "#fb7185", label: "Sell heat" },
        { y: 120, color: "#2dd4bf", label: "Mixed / both" },
      ].map((row) => (
        <g key={row.y}>
          <defs>
            <linearGradient id={`heat-${row.y}`} x1="0" x2="1" y1="0" y2="0">
              <stop offset="0%" stopColor={row.color} stopOpacity="0.95" />
              <stop offset="55%" stopColor={row.color} stopOpacity="0.45" />
              <stop offset="100%" stopColor={row.color} stopOpacity="0.05" />
            </linearGradient>
          </defs>
          <rect x="40" y={row.y - 8} width="220" height="16" rx="6" fill={`url(#heat-${row.y})`} />
          <circle cx="48" cy={row.y} r="7" fill={row.color} opacity="0.9" />
          <text x="270" y={row.y + 4} fill="#a1a1aa" fontSize="10" fontFamily="system-ui">
            {row.label}
          </text>
        </g>
      ))}

      <text x="40" y="155" fill="#71717a" fontSize="10" fontFamily="system-ui">
        Bright core = fresh print · trail fades as heat decays forward
      </text>
    </svg>
  );
}

function AggressionBubbleDiagram() {
  return (
    <svg viewBox="0 0 340 180" className="h-auto w-full max-w-md" aria-hidden>
      <rect width="340" height="180" fill="#0a0f18" rx="12" />
      <text x="16" y="22" fill="#71717a" fontSize="11" fontFamily="system-ui">
        Aggression bubbles (size ∝ volume)
      </text>

      {/* normal buy */}
      <circle cx="55" cy="80" r="10" fill="rgba(52,211,153,0.65)" stroke="#a7f3d0" strokeWidth="1" />
      <text x="55" y="115" textAnchor="middle" fill="#a1a1aa" fontSize="10" fontFamily="system-ui">
        Normal
      </text>
      <text x="55" y="128" textAnchor="middle" fill="#71717a" fontSize="9" fontFamily="system-ui">
        buy
      </text>

      {/* large sell */}
      <circle cx="130" cy="80" r="16" fill="rgba(251,113,133,0.6)" stroke="rgba(255,255,255,0.55)" strokeWidth="2" />
      <text x="130" y="115" textAnchor="middle" fill="#a1a1aa" fontSize="10" fontFamily="system-ui">
        Large
      </text>
      <text x="130" y="128" textAnchor="middle" fill="#71717a" fontSize="9" fontFamily="system-ui">
        sell · white ring
      </text>

      {/* whale buy */}
      <circle cx="220" cy="80" r="22" fill="rgba(52,211,153,0.55)" />
      <circle cx="220" cy="80" r="25" fill="none" stroke="#facc15" strokeWidth="2.5" />
      <circle cx="220" cy="80" r="30" fill="none" stroke="rgba(250,204,21,0.35)" strokeWidth="1" />
      <text x="220" y="115" textAnchor="middle" fill="#fde68a" fontSize="10" fontFamily="system-ui">
        Whale
      </text>
      <text x="220" y="128" textAnchor="middle" fill="#71717a" fontSize="9" fontFamily="system-ui">
        gold double ring
      </text>

      {/* tiny mixed */}
      <circle cx="300" cy="80" r="6" fill="rgba(148,163,184,0.5)" stroke="#e2e8f0" strokeWidth="1" />
      <text x="300" y="115" textAnchor="middle" fill="#a1a1aa" fontSize="10" fontFamily="system-ui">
        Mixed
      </text>

      <text x="16" y="160" fill="#71717a" fontSize="10" fontFamily="system-ui">
        Bigger circle = more volume · gold ring = top aggression tier
      </text>
    </svg>
  );
}

function TrapDiagram() {
  return (
    <svg viewBox="0 0 340 200" className="h-auto w-full max-w-md" aria-hidden>
      <rect width="340" height="200" fill="#0a0f18" rx="12" />
      <text x="16" y="20" fill="#71717a" fontSize="11" fontFamily="system-ui">
        Trapped liquidity (not green/red alone)
      </text>

      {/* price path: push up then fail */}
      <polyline
        points="30,140 70,100 110,70 150,55 190,90 230,120 270,135 310,145"
        fill="none"
        stroke="#71717a"
        strokeWidth="1.5"
      />
      <text x="100" y="48" fill="#a1a1aa" fontSize="9" fontFamily="system-ui">
        Buy push
      </text>
      <text x="220" y="155" fill="#a1a1aa" fontSize="9" fontFamily="system-ui">
        Reversal
      </text>

      {/* TB diamond at high */}
      <polygon points="150,55 160,65 150,75 140,65" fill="#fbbf24" stroke="#fde68a" strokeWidth="1.5" />
      <text x="165" y="60" fill="#fde68a" fontSize="11" fontFamily="ui-monospace, monospace" fontWeight="700">
        TB
      </text>
      <text x="165" y="74" fill="#a1a1aa" fontSize="9" fontFamily="system-ui">
        Trapped buyside
      </text>

      {/* sell push then reverse up */}
      <polyline
        points="30,50 80,80 120,110 160,130 200,100 250,70 300,55"
        fill="none"
        stroke="rgba(113,113,122,0.35)"
        strokeWidth="1"
        strokeDasharray="3 3"
      />

      {/* TS diamond */}
      <polygon points="160,130 170,140 160,150 150,140" fill="#a78bfa" stroke="#ddd6fe" strokeWidth="1.5" />
      <text x="178" y="138" fill="#ddd6fe" fontSize="11" fontFamily="ui-monospace, monospace" fontWeight="700">
        TS
      </text>
      <text x="178" y="152" fill="#a1a1aa" fontSize="9" fontFamily="system-ui">
        Trapped sellside
      </text>

      <text x="16" y="185" fill="#71717a" fontSize="10" fontFamily="system-ui">
        Amber diamond + TB · Violet diamond + TS · chevron inside marker
      </text>
    </svg>
  );
}

function FootprintOverviewDiagram() {
  return (
    <svg viewBox="0 0 360 210" className="h-auto w-full max-w-md" aria-hidden>
      <rect width="360" height="210" fill="#0a0f18" rx="12" />
      <text x="14" y="20" fill="#71717a" fontSize="11" fontFamily="system-ui">
        Footprint tab layers (bottom → top)
      </text>

      {/* heat layer */}
      <rect x="24" y="40" width="200" height="14" rx="4" fill="url(#ov-heat)" opacity="0.85" />
      <defs>
        <linearGradient id="ov-heat" x1="0" x2="1">
          <stop offset="0%" stopColor="#fb7185" stopOpacity="0.7" />
          <stop offset="100%" stopColor="#34d399" stopOpacity="0.5" />
        </linearGradient>
      </defs>
      <text x="236" y="51" fill="#a1a1aa" fontSize="10" fontFamily="system-ui">
        1. Heat trails
      </text>

      {/* footprint cells */}
      <rect x="50" y="70" width="28" height="12" fill="rgba(251,113,133,0.55)" />
      <rect x="80" y="70" width="28" height="12" fill="rgba(52,211,153,0.55)" />
      <rect x="50" y="86" width="28" height="12" fill="rgba(251,113,133,0.35)" />
      <rect x="80" y="86" width="28" height="12" fill="rgba(52,211,153,0.7)" />
      <text x="236" y="88" fill="#a1a1aa" fontSize="10" fontFamily="system-ui">
        2. Footprint cells
      </text>

      {/* bubbles */}
      <circle cx="90" cy="130" r="14" fill="rgba(52,211,153,0.55)" />
      <circle cx="90" cy="130" r="17" fill="none" stroke="#facc15" strokeWidth="2" />
      <circle cx="140" cy="135" r="9" fill="rgba(251,113,133,0.55)" />
      <text x="236" y="135" fill="#a1a1aa" fontSize="10" fontFamily="system-ui">
        3. Aggression bubbles
      </text>

      {/* traps */}
      <polygon points="110,168 120,178 110,188 100,178" fill="#fbbf24" />
      <text x="125" y="182" fill="#fde68a" fontSize="10" fontFamily="ui-monospace, monospace">
        TB
      </text>
      <polygon points="165,168 175,178 165,188 155,178" fill="#a78bfa" />
      <text x="180" y="182" fill="#ddd6fe" fontSize="10" fontFamily="ui-monospace, monospace">
        TS
      </text>
      <text x="236" y="182" fill="#a1a1aa" fontSize="10" fontFamily="system-ui">
        4. Trap markers
      </text>
    </svg>
  );
}

const sections: FaqSection[] = [
  {
    id: "cvd",
    title: "Bar delta and CVD — units and meaning",
    paragraphs: [
      "Trade Road Strategy Lab estimates bar delta from OHLCV (not a true bid/ask footprint). Direction comes from close vs previous close (or midpoint); size scales with that bar’s volume and body strength. CVD is the running sum of those bar deltas.",
      "Units: price is in dollars ($). Bar delta and CVD are in proxy volume units (same scale as the feed’s volume — shares, contracts, or coins — not dollars and not true aggressive buy/sell size).",
      "How to read the numbers: positive bar delta ≈ that bar closed with more “buying conviction” than selling under our proxy. Negative bar delta ≈ selling conviction. Rising CVD over time means cumulative proxy buying pressure is building; falling CVD means selling pressure is building. Absolute CVD level is less important than slope and new highs/lows relative to price.",
      "Implications: if price makes a new high while CVD does not (bearish divergence), the advance may be weak — fewer buyers confirming. If price makes a new low while CVD holds up (bullish divergence), selling may be exhausting. This is research-grade, not a tick-level order-flow guarantee.",
    ],
    examples: [
      {
        title: "Example — rising CVD with rising price",
        body: "Price climbs from $100 → $102 while CVD keeps making higher highs. Proxy reading: buyers are confirming the move. Less likely to be a thin, unconfirmed spike.",
      },
      {
        title: "Example — bearish CVD divergence",
        body: "Price prints a new high at $105 but CVD stays flat or lower than the previous high. Proxy reading: less “buy volume conviction” under the new high — watch for stall or reversal (not a trade signal by itself).",
      },
    ],
    diagram: <CvdDiagram />,
    diagramTitle: "Price ($) vs proxy CVD (vol units)",
  },
  {
    id: "signals",
    title: "Green and red circles (Price + Delta)",
    paragraphs: [
      "On the Price + Delta chart, circles mark strategy entry signals from the bounce / exhaustion engine — not random price prints.",
      "Green circle = long entry. The model saw a support bounce (and optional CVD / delta confirmation) and would open a long at that bar’s entry price. Red circle = short entry on a resistance rejection with optional bearish confirmation.",
      "Only recent signals are drawn (last ~50) so the chart stays readable. Hover tooltips show price in $ and bar delta / CVD in volume units with compact formatting (e.g. 1.2K). Full signal details live in the Recent Signals table below.",
      "Implication: green at support with rising or diverging CVD is the classic “exhaustion bounce” long idea; red at resistance with weak CVD is the short idea. Circles do not guarantee a fill or win — they are backtest candidates under your parameters.",
    ],
    legend: [
      {
        swatch: <SwatchCircle fill="#22c55e" />,
        label: "Green circle",
        meaning: "Long strategy entry at that bar",
      },
      {
        swatch: <SwatchCircle fill="#fb7185" />,
        label: "Red circle",
        meaning: "Short strategy entry at that bar",
      },
    ],
    examples: [
      {
        title: "Example — green at support",
        body: "Price tags a multi-touch low, bounces, and a green circle appears. Table shows long entry, SL below the low, TP from risk-reward. That is a candidate setup under current parameters — not a broker order.",
      },
    ],
    diagram: <SignalMarkersDiagram />,
    diagramTitle: "Entry markers on Price + Delta",
  },
  {
    id: "fp-overview",
    title: "Footprint tab — what you are looking at",
    paragraphs: [
      "The Footprint tab is a DeepChart / Bookmap-style view built only from OHLCV (no exchange footprint tape or MBO). It stacks four layers so you can see where volume clustered, who looked aggressive, and where that aggression may have failed.",
      "Layers from back to front: (1) residual heat trails, (2) bid/ask footprint cells, (3) volume bubbles with aggression tiers, (4) trapped-liquidity diamonds. Use view modes and toggles to isolate any layer.",
    ],
    legend: [
      {
        swatch: <SwatchHeat />,
        label: "Heat trail",
        meaning: "Residual buy/sell volume fading through time at a price",
      },
      {
        swatch: <SwatchCell left="rgba(251,113,133,0.7)" right="rgba(52,211,153,0.7)" />,
        label: "Footprint cell",
        meaning: "Left = bid/sell vol · Right = ask/buy vol at that price",
      },
      {
        swatch: <SwatchCircle fill="rgba(52,211,153,0.8)" ring="#facc15" />,
        label: "Bubble",
        meaning: "Local volume print; ring = large/whale aggression",
      },
      {
        swatch: <SwatchDiamond fill="#fbbf24" />,
        label: "Trap diamond",
        meaning: "Failed aggression (TB buyside / TS sellside)",
      },
    ],
    examples: [
      {
        title: "Example — how to scan a window",
        body: "Zoom to the last 1 hour. Look for a dense teal heat trail under price (buy residue), a gold-ringed green bubble at a swing high, then an amber TB diamond if price rejected. That sequence is “aggressive buyers → failed at highs → trapped buyside” under our proxy.",
      },
    ],
    diagram: <FootprintOverviewDiagram />,
    diagramTitle: "Layer stack on the Footprint chart",
  },
  {
    id: "fp-cells",
    title: "Footprint cells — bid vs ask at each price",
    paragraphs: [
      "Each candle is sliced into price rows (tick size). Volume for that bar is distributed across rows that fall between the bar’s low and high.",
      "Left half of a cell = bid / sell aggression (proxy). Right half = ask / buy aggression (proxy). Brighter fill means more volume at that level. Numbers appear when you zoom in enough (enable Numbers).",
      "Imbalance: if the right side is much larger, that level looks buy-dominant for that bar; if the left is larger, sell-dominant. Cell delta (ask − bid) is shown on hover.",
    ],
    legend: [
      {
        swatch: <SwatchCell left="rgba(251,113,133,0.85)" right="rgba(52,211,153,0.2)" />,
        label: "Sell-heavy cell",
        meaning: "Bright rose left · weak green right",
      },
      {
        swatch: <SwatchCell left="rgba(251,113,133,0.2)" right="rgba(52,211,153,0.85)" />,
        label: "Buy-heavy cell",
        meaning: "Weak rose left · bright green right",
      },
      {
        swatch: <SwatchCell left="rgba(251,113,133,0.5)" right="rgba(52,211,153,0.5)" />,
        label: "Balanced cell",
        meaning: "Similar volume both sides",
      },
    ],
    examples: [
      {
        title: "Example — reading one bar",
        body: "At 100.75 the cell shows Bid 12 · Ask 48. Proxy: about 4× more buy-side volume at that price than sell-side on that bar. At 100.25 Bid 62 · Ask 18 means sellers dominated the lower half of the same bar.",
      },
      {
        title: "Example — what it is not",
        body: "These numbers are not exchange “bid × ask” footprint prints from the tape. They are reconstructed from OHLCV (direction, body, range, volume). Treat them as a research sketch of where volume sat.",
      },
    ],
    diagram: <FootprintCellDiagram />,
    diagramTitle: "Bid (left) × Ask (right) cells inside one bar",
  },
  {
    id: "fp-heat",
    title: "Heat trails — denser Bookmap-style memory",
    paragraphs: [
      "Heat trails remember volume at each price after the bar prints. That residual decays slowly as time moves right, so busy prices leave a horizontal glow — similar in spirit to Bookmap heatmap history (but from OHLCV, not full depth).",
      "Color lean: teal / emerald residue ≈ buy aggression memory; rose residue ≈ sell aggression memory. Mixed levels blend both. Bright cores are recent heavy prints; long soft tails are older heat still fading.",
      "Use the Heat intensity slider if trails look too faint or too loud. “Heat + Bubbles” mode emphasizes trails over cell grids.",
    ],
    legend: [
      {
        swatch: <span className="inline-block h-2.5 w-7 rounded-sm bg-emerald-400/70" />,
        label: "Teal trail",
        meaning: "Residual buy-side heat at that price",
      },
      {
        swatch: <span className="inline-block h-2.5 w-7 rounded-sm bg-rose-400/70" />,
        label: "Rose trail",
        meaning: "Residual sell-side heat at that price",
      },
      {
        swatch: <SwatchHeat />,
        label: "Gradient trail",
        meaning: "Both sides left heat; blend shows balance",
      },
    ],
    examples: [
      {
        title: "Example — support shelf",
        body: "A horizontal teal band sits at $100.50 across many bars while price keeps bouncing there. Proxy: repeated buy-side volume “remembered” at that level — a visual shelf, not a guaranteed bid.",
      },
      {
        title: "Example — faded trail",
        body: "A bright rose print at 10:15 fades to a thin pink line by 11:00. Heat decay is working: old aggression still visible as context, but new prints dominate brightness.",
      },
    ],
    diagram: <HeatTrailDiagram />,
    diagramTitle: "Residual heat fades to the right of a print",
  },
  {
    id: "fp-bubbles",
    title: "Aggression bubbles — big buyers and sellers",
    paragraphs: [
      "Circles mark high-volume price nodes inside a bar. Size scales with volume so large prints jump out more than candles alone.",
      "Color of the fill: green-ish = buy-side dominant print; rose = sell-side; slate = mixed. Aggression tier uses volume percentile plus imbalance: normal, large (white ring), whale (gold double ring).",
      "Whales are the loudest proxy aggression — top volume ranks with meaningful imbalance. They are not institutional labels from the exchange.",
    ],
    legend: [
      {
        swatch: <SwatchCircle fill="rgba(52,211,153,0.75)" />,
        label: "Normal buy bubble",
        meaning: "Local volume, buy lean, no special ring",
      },
      {
        swatch: <SwatchCircle fill="rgba(251,113,133,0.75)" ring="rgba(255,255,255,0.7)" />,
        label: "Large sell bubble",
        meaning: "Top ~25% volume · white ring",
      },
      {
        swatch: <SwatchCircle fill="rgba(52,211,153,0.75)" ring="#facc15" />,
        label: "Whale buy bubble",
        meaning: "Top ~8% volume + imbalance · gold ring",
      },
      {
        swatch: <SwatchCircle fill="rgba(148,163,184,0.6)" />,
        label: "Mixed bubble",
        meaning: "Volume without clear buy/sell lean",
      },
    ],
    examples: [
      {
        title: "Example — whale at the high",
        body: "A large gold-ringed green circle sits at the bar high while cells show Ask ≫ Bid. Proxy: aggressive buying into the top of the range. If the next bars reverse down and a TB appears, that whale may have been trapped.",
      },
      {
        title: "Example — small mixed dots",
        body: "Several small slate circles inside a quiet bar. Proxy: volume was present but not one-sided. Less useful as “big player” tells; heat trails matter more for structure.",
      },
    ],
    diagram: <AggressionBubbleDiagram />,
    diagramTitle: "Normal · Large (white ring) · Whale (gold ring)",
  },
  {
    id: "fp-traps",
    title: "Trapped buyside / sellside — diamonds + labels",
    paragraphs: [
      "Traps mark failed aggression: a large volume print looked like it controlled the auction, then price moved against that side by a meaningful amount. Sellers who sold and then watched price lift are trapped sellside (TS); buyers who bought and then watched price fall are trapped buyside (TB).",
      "We deliberately do not reuse plain green/red for traps. Green/red already mean buy/sell aggression. Traps use three encodings together: diamond shape, distinct color, and text label (TB / TS) so color alone is never the only cue.",
      "Strict mode (default) is intentionally picky so a TSLA-style stepwise downtrend does not paint a TS on every few-tick bounce after yellow sell stacks. Mid-trend micro-reversals can be “technically” adverse for a moment and still be noise. High-value TS cluster near real lows with large sell prints, buy response, and structure/CVD confirmation — the kind of inflection a CVD-bounce idea cares about.",
      "Strict filters: (1) minimum adverse move ≈ max(0.18% of price, 4 ticks), (2) large or whale aggression only, (3) range reverse + higher-high after sells / lower-low after buys and/or CVD flip in the look-ahead window, (4) residual heat at the level boosts strength. Turn Strict traps off for the older, noisier “sensitive” view.",
    ],
    legend: [
      {
        swatch: <SwatchDiamond fill="#fbbf24" />,
        label: "TB · amber diamond",
        meaning: "Trapped buyside — buy aggression failed / reversed",
      },
      {
        swatch: <SwatchDiamond fill="#a78bfa" />,
        label: "TS · violet diamond",
        meaning: "Trapped sellside — sell aggression failed / reversed",
      },
      {
        swatch: (
          <span className="font-mono text-[10px] font-bold text-amber-200">TB</span>
        ),
        label: "Label TB",
        meaning: "Text tag so the marker is readable without color vision",
      },
      {
        swatch: (
          <span className="font-mono text-[10px] font-bold text-violet-200">TS</span>
        ),
        label: "Label TS",
        meaning: "Text tag for trapped sellside",
      },
    ],
    examples: [
      {
        title: "Example — high-quality TS at a low (keep)",
        body: "TSLA dumps into ~326 on large yellow/rose sell bubbles, green buy bubbles appear, price lifts and makes a higher high, CVD turns up. A violet TS near 326–327 is the real trap: aggressive sellers are underwater at an inflection.",
      },
      {
        title: "Example — mid-trend noise TS (filtered in Strict)",
        body: "In a clean downtrend 331 → 326, each sell leg is followed by a 2–4 tick bounce before the next lower low. Sensitive mode can mark many TS on those bounces. Strict mode drops them because adverse move is tiny vs 0.18% of price and structure never breaks higher — sellers were right on the larger picture.",
      },
      {
        title: "Example — TB after a failed breakout",
        body: "Bar spikes on a whale buy bubble, then price loses the bar low and travels more than the min adverse distance. Amber TB near the high: trapped buyside. Hover shows adverse move, confirm type (structure / cvd / rejection), and strength.",
      },
      {
        title: "Example — what not to do",
        body: "Do not treat every TB as an automatic short or every TS as an automatic long. Prefer Strict mode, heat context, and your CVD-bounce rules. All values are reconstructed from OHLCV.",
      },
    ],
    diagram: <TrapDiagram />,
    diagramTitle: "TB at failed highs · TS at failed lows",
  },
  {
    id: "fp-controls",
    title: "Footprint controls cheat sheet",
    paragraphs: [
      "View modes: Footprint + Bubbles (default stack), Heat + Bubbles (trails first), Footprint only, Bubbles only.",
      "Toggles: Heat trails, Traps, OHLC wick overlay, Numbers on cells. Sliders: Heat intensity, Bubble size. Auto tick suggests bin size from price; turn off to set tick manually.",
      "Navigate: drag to pan, mouse wheel to zoom, Reset to jump back to a recent window. Hover any cell, bubble, or trap for exact bid/ask/delta or trap reason and strength.",
    ],
    examples: [
      {
        title: "Example — isolate traps",
        body: "Turn off Numbers and Footprint-only mode; leave Bubbles + Traps + Heat on. You get a cleaner Bookmap-like scan of large prints and TB/TS without cell clutter.",
      },
    ],
  },
  {
    id: "vp-modes",
    title: "Developing vs fixed range profile",
    paragraphs: [
      "Developing profile uses the current session from the open through the latest bar and grows as new bars arrive. Fixed range profile uses only the bar indexes you select (for a swing, opening drive, or custom window).",
    ],
    examples: [
      {
        title: "Example — fixed range for a morning drive",
        body: "Set start/end indexes to the first 30 one-minute bars after the open. The profile then shows only that drive’s volume distribution — useful when the full session profile is too wide.",
      },
    ],
  },
  {
    id: "va",
    title: "POC, VAH, VAL, and value area %",
    paragraphs: [
      "POC is the price bin with the most volume. Value area expands from the POC until it covers a configurable share of total volume (default 70%). VAL is the low edge of that zone; VAH is the high edge. Auction Market Theory treats value area as where price spent most accepted volume.",
    ],
    legend: [
      {
        swatch: <span className="inline-block h-0.5 w-6 bg-amber-400" />,
        label: "POC",
        meaning: "Highest-volume price bin (point of control)",
      },
      {
        swatch: <span className="inline-block h-3 w-2 rounded-sm bg-emerald-400/40" />,
        label: "Value area",
        meaning: "VAH (top) to VAL (bottom) covering ~70% volume",
      },
    ],
    examples: [
      {
        title: "Example — price outside value",
        body: "POC $100, VAL $99.20, VAH $100.80. Price trades $101.50 above VAH. AMT-style reading: short-term unbalanced high — either acceptance higher (profile rebuilds up) or a rotation back toward value.",
      },
    ],
    diagram: <ProfileDiagram />,
    diagramTitle: "Histogram with POC and value area",
  },
  {
    id: "nodes",
    title: "HVN and LVN",
    paragraphs: [
      "High Volume Nodes are local peaks in the profile (acceptance / balance). Low Volume Nodes are local troughs (faster travel / less acceptance). We flag them with simple local extrema and volume thresholds on the OHLCV histogram.",
    ],
    legend: [
      {
        swatch: <SwatchCircle fill="#34d399" />,
        label: "HVN",
        meaning: "Local volume peak — balance / acceptance",
      },
      {
        swatch: <SwatchCircle fill="#fb7185" />,
        label: "LVN",
        meaning: "Local volume trough — faster travel zone",
      },
    ],
    examples: [
      {
        title: "Example — LVN as a path of least resistance",
        body: "Profile is thick at $100 and $102 (HVNs) with a thin gap at $101 (LVN). If price leaves $100, it often travels quickly through $101 toward the next HVN — a classic LVN “air pocket” idea.",
      },
    ],
    diagram: <HvnLvnDiagram />,
    diagramTitle: "HVN peaks and LVN troughs",
  },
  {
    id: "ib",
    title: "Initial Balance",
    paragraphs: [
      "Initial Balance is the high/low range of the first part of the session (default first 60 minutes). Later session extensions above IB high or below IB low are classic AMT reference points.",
    ],
    examples: [
      {
        title: "Example — IB extension",
        body: "First hour high/low is $100–$101. Later price trades $101.40. That is an extension above IB high — often watched for trend day continuation vs failed extension back into the IB box.",
      },
    ],
    diagram: <IbDiagram />,
    diagramTitle: "IB box then session continuation",
  },
  {
    id: "session",
    title: "Session vs composite",
    paragraphs: [
      "Session profile isolates one session key (calendar day in a timezone, or US RTH day). Composite merges volume across multiple sessions at the same prices so multi-day value and nodes stand out.",
    ],
    examples: [
      {
        title: "Example — composite for a multi-day balance",
        body: "Three quiet days all trade heavily between $48–$50. Composite POC sits near $49 while any single session looks noisy. Multi-day value is clearer on composite than on one RTH profile alone.",
      },
    ],
  },
  {
    id: "ohlcv",
    title: "How volume is painted from OHLCV",
    paragraphs: [
      "Without trade prints, each bar’s volume is distributed across price bins that cover that bar’s high–low range (uniform by default, or close-weighted). Tick size controls bin height. Footprint bid/ask split uses candle direction, body conviction, and position in the range.",
      "Results approximate professional volume tools for research; tick / MBO data would refine every layer (cells, heat, traps).",
    ],
    examples: [
      {
        title: "Example — close-weighted vs uniform",
        body: "A bar trades $100–$101 and closes $100.95. Uniform paint spreads volume evenly across bins. Close-weighted puts extra volume near $100.95 — closer to “price finished here” intuition, still not true prints.",
      },
    ],
  },
];

export function OrderflowFaqModal({ open, onClose }: OrderflowFaqModalProps) {
  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Order flow, footprint & volume profile FAQ"
      wide
      className="max-w-3xl"
    >
      <div className="space-y-8">
        <p className="text-sm leading-relaxed text-zinc-400">
          Short reference for Strategy Lab. Each topic has a plain explanation, a legend where
          useful, worked examples, and a simple diagram. Diagrams are schematic (not live market
          data). Price is in $; delta / CVD / volumes are proxy units from OHLCV — not exchange tape.
        </p>

        <nav
          aria-label="FAQ topics"
          className="flex flex-wrap gap-2 rounded-2xl border border-white/10 bg-black/30 p-3"
        >
          {sections.map((section) => (
            <a
              key={section.id}
              href={`#faq-${section.id}`}
              className="rounded-full border border-white/10 bg-white/[0.04] px-2.5 py-1 text-[11px] font-medium text-zinc-400 transition-colors hover:border-cyan-300/40 hover:text-cyan-100"
            >
              {section.title.length > 36 ? `${section.title.slice(0, 34)}…` : section.title}
            </a>
          ))}
        </nav>

        {sections.map((section) => (
          <section
            key={section.id}
            id={`faq-${section.id}`}
            className="scroll-mt-4 space-y-3 border-t border-white/10 pt-6 first:border-t-0 first:pt-0"
          >
            <h3 className="text-base font-semibold text-white">{section.title}</h3>
            <div className="max-w-[65ch] space-y-2">
              {section.paragraphs.map((paragraph) => (
                <p key={paragraph.slice(0, 48)} className="text-sm leading-relaxed text-zinc-400">
                  {paragraph}
                </p>
              ))}
            </div>
            {section.legend?.length ? <LegendList items={section.legend} /> : null}
            {section.examples?.length ? <ExampleList items={section.examples} /> : null}
            {section.diagram ? (
              <DiagramFrame title={section.diagramTitle ?? section.title}>{section.diagram}</DiagramFrame>
            ) : null}
          </section>
        ))}
      </div>
    </Modal>
  );
}
