"use client";

import type { ReactNode } from "react";

import { Modal } from "@/components/ui/modal";

type OrderflowFaqModalProps = {
  open: boolean;
  onClose: () => void;
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
      {/* bar delta bars */}
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
      {/* histogram bars horizontal */}
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

const sections: Array<{
  id: string;
  title: string;
  paragraphs: string[];
  diagram?: ReactNode;
  diagramTitle?: string;
}> = [
  {
    id: "cvd",
    title: "Bar delta and CVD — units and meaning",
    paragraphs: [
      "Trade Road Strategy Lab estimates bar delta from OHLCV (not a true bid/ask footprint). Direction comes from close vs previous close (or midpoint); size scales with that bar’s volume and body strength. CVD is the running sum of those bar deltas.",
      "Units: price is in dollars ($). Bar delta and CVD are in proxy volume units (same scale as the feed’s volume — shares, contracts, or coins — not dollars and not true aggressive buy/sell size).",
      "How to read the numbers: positive bar delta ≈ that bar closed with more “buying conviction” than selling under our proxy. Negative bar delta ≈ selling conviction. Rising CVD over time means cumulative proxy buying pressure is building; falling CVD means selling pressure is building. Absolute CVD level is less important than slope and new highs/lows relative to price.",
      "Implications: if price makes a new high while CVD does not (bearish divergence), the advance may be weak — fewer buyers confirming. If price makes a new low while CVD holds up (bullish divergence), selling may be exhausting. This is research-grade, not a tick-level order-flow guarantee.",
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
    diagram: <SignalMarkersDiagram />,
    diagramTitle: "Entry markers on Price + Delta",
  },
  {
    id: "vp-modes",
    title: "Developing vs fixed range profile",
    paragraphs: [
      "Developing profile uses the current session from the open through the latest bar and grows as new bars arrive. Fixed range profile uses only the bar indexes you select (for a swing, opening drive, or custom window).",
    ],
  },
  {
    id: "va",
    title: "POC, VAH, VAL, and value area %",
    paragraphs: [
      "POC is the price bin with the most volume. Value area expands from the POC until it covers a configurable share of total volume (default 70%). VAL is the low edge of that zone; VAH is the high edge. Auction Market Theory treats value area as where price spent most accepted volume.",
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
    diagram: <HvnLvnDiagram />,
    diagramTitle: "HVN peaks and LVN troughs",
  },
  {
    id: "ib",
    title: "Initial Balance",
    paragraphs: [
      "Initial Balance is the high/low range of the first part of the session (default first 60 minutes). Later session extensions above IB high or below IB low are classic AMT reference points.",
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
  },
  {
    id: "ohlcv",
    title: "How volume is painted from OHLCV",
    paragraphs: [
      "Without trade prints, each bar’s volume is distributed across price bins that cover that bar’s high–low range (uniform by default, or close-weighted). Tick size controls bin height. Results approximate a professional VP; tick data would refine it further.",
    ],
  },
];

export function OrderflowFaqModal({ open, onClose }: OrderflowFaqModalProps) {
  return (
    <Modal open={open} onClose={onClose} title="Order flow and volume profile FAQ" wide className="max-w-3xl">
      <div className="space-y-8">
        <p className="text-sm leading-relaxed text-zinc-400">
          Short reference for Strategy Lab concepts. Diagrams are schematic (not live market data). Chart
          axes: price in $, delta/CVD in proxy volume units.
        </p>
        {sections.map((section) => (
          <section key={section.id} className="space-y-3 border-t border-white/10 pt-6 first:border-t-0 first:pt-0">
            <h3 className="text-base font-semibold text-white">{section.title}</h3>
            <div className="max-w-[65ch] space-y-2">
              {section.paragraphs.map((paragraph) => (
                <p key={paragraph.slice(0, 48)} className="text-sm leading-relaxed text-zinc-400">
                  {paragraph}
                </p>
              ))}
            </div>
            {section.diagram ? (
              <DiagramFrame title={section.diagramTitle ?? section.title}>{section.diagram}</DiagramFrame>
            ) : null}
          </section>
        ))}
      </div>
    </Modal>
  );
}
