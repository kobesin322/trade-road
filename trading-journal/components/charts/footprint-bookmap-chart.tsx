"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type PointerEvent as ReactPointerEvent,
} from "react";
import { CircleDot, HelpCircle, Layers, ZoomIn, ZoomOut } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  buildFootprintModel,
  footprintVolumeExtents,
  suggestTickSize,
  type FootprintBar,
  type FootprintBubble,
  type FootprintCell,
  type FootprintParams,
  type HeatmapPoint,
  type TrappedLiquidity,
  DEFAULT_FOOTPRINT_PARAMS,
  SENSITIVE_TRAP_PARAMS,
} from "@/lib/orderflow/footprint";
import type { OHLCVBar } from "@/lib/orderflow/types";
import { cn } from "@/lib/utils";

type FootprintBookmapChartProps = {
  bars: OHLCVBar[];
  tickerLabel: string;
  className?: string;
  onOpenFaq?: () => void;
};

type ViewMode = "both" | "footprint" | "bubbles" | "heat";

type HoverInfo = {
  bar: FootprintBar;
  cell: FootprintCell | null;
  trap: TrappedLiquidity | null;
  bubble: FootprintBubble | null;
  canvasX: number;
  canvasY: number;
};

const PAD = { top: 16, right: 72, bottom: 36, left: 12 };
const DEFAULT_VISIBLE = 56;
const MIN_VISIBLE = 8;
const MAX_VISIBLE = 180;

const COLORS = {
  bg: "#09090b",
  grid: "rgba(255,255,255,0.045)",
  axis: "rgba(255,255,255,0.55)",
  wickUp: "rgba(52,211,153,0.45)",
  wickDown: "rgba(251,113,133,0.45)",
  bid: { r: 251, g: 113, b: 133 },
  ask: { r: 52, g: 211, b: 153 },
  heatBuy: { r: 16, g: 185, b: 129 },
  heatSell: { r: 244, g: 63, b: 94 },
  bubbleBuy: "rgba(52, 211, 153, 0.58)",
  bubbleSell: "rgba(251, 113, 133, 0.58)",
  bubbleMixed: "rgba(148, 163, 184, 0.45)",
  whaleRing: "rgba(250, 204, 21, 0.95)",
  largeRing: "rgba(255, 255, 255, 0.55)",
  /** Trapped buyside — amber diamond (not green; failed buys) */
  trapBuy: { fill: "rgba(251, 191, 36, 0.88)", stroke: "rgba(253, 230, 138, 1)", label: "#fef3c7" },
  /** Trapped sellside — violet diamond (not red alone; failed sells) */
  trapSell: { fill: "rgba(167, 139, 250, 0.88)", stroke: "rgba(221, 214, 254, 1)", label: "#ede9fe" },
  crosshair: "rgba(34, 211, 238, 0.4)",
  text: "#a1a1aa",
};

function formatPrice(n: number, tickSize: number) {
  if (!Number.isFinite(n)) {
    return "—";
  }
  const decimals = Math.min(8, Math.max(0, Math.ceil(-Math.log10(tickSize || 1)) + 1));
  return n.toLocaleString(undefined, {
    maximumFractionDigits: decimals,
    minimumFractionDigits: Math.min(2, decimals),
  });
}

function formatVol(n: number) {
  if (!Number.isFinite(n)) {
    return "—";
  }
  const abs = Math.abs(n);
  if (abs >= 1_000_000) {
    return `${(n / 1_000_000).toFixed(2)}M`;
  }
  if (abs >= 10_000) {
    return `${(n / 1_000).toFixed(1)}K`;
  }
  if (abs >= 1_000) {
    return `${(n / 1_000).toFixed(2)}K`;
  }
  return n.toFixed(abs < 10 ? 1 : 0);
}

function formatTime(ts: number) {
  return new Date(ts).toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function rgba(c: { r: number; g: number; b: number }, a: number) {
  return `rgba(${c.r},${c.g},${c.b},${a})`;
}

function drawDiamond(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  size: number,
  fill: string,
  stroke: string,
) {
  ctx.beginPath();
  ctx.moveTo(x, y - size);
  ctx.lineTo(x + size, y);
  ctx.lineTo(x, y + size);
  ctx.lineTo(x - size, y);
  ctx.closePath();
  ctx.fillStyle = fill;
  ctx.fill();
  ctx.strokeStyle = stroke;
  ctx.lineWidth = 1.5;
  ctx.stroke();
}

export function FootprintBookmapChart({
  bars,
  tickerLabel,
  className,
  onOpenFaq,
}: FootprintBookmapChartProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const dragRef = useRef<{ startX: number; startEnd: number } | null>(null);

  const [autoTick, setAutoTick] = useState(true);
  const [tickInput, setTickInput] = useState("");
  const [viewMode, setViewMode] = useState<ViewMode>("both");
  const [showCandles, setShowCandles] = useState(true);
  const [showNumbers, setShowNumbers] = useState(true);
  const [showHeatmap, setShowHeatmap] = useState(true);
  const [showTraps, setShowTraps] = useState(true);
  /** Strict = quality traps (min adverse %, large/whale, structure/CVD). Sensitive = more noise. */
  const [strictTraps, setStrictTraps] = useState(true);
  const [heatIntensity, setHeatIntensity] = useState(1);
  const [bubbleScale, setBubbleScale] = useState(1.15);
  const [visibleCount, setVisibleCount] = useState(DEFAULT_VISIBLE);
  const [endIndex, setEndIndex] = useState(0);
  const [hover, setHover] = useState<HoverInfo | null>(null);
  const [size, setSize] = useState({ w: 800, h: 560 });

  const suggestedTick = useMemo(() => suggestTickSize(bars), [bars]);
  const tickSize = useMemo(() => {
    if (autoTick) {
      return suggestedTick;
    }
    const parsed = Number(tickInput);
    return Number.isFinite(parsed) && parsed > 0 ? parsed : suggestedTick;
  }, [autoTick, suggestedTick, tickInput]);

  const params: Partial<FootprintParams> = useMemo(
    () => ({
      tickSize,
      deltaMethod: DEFAULT_FOOTPRINT_PARAMS.deltaMethod,
      bubbleMinShare: 0.07,
      maxBubblesPerBar: 14,
      heatDecay: 0.92,
      heatMinShare: 0.035,
      ...(strictTraps
        ? {
            trapLookahead: DEFAULT_FOOTPRINT_PARAMS.trapLookahead,
            trapMinVolumeRatio: DEFAULT_FOOTPRINT_PARAMS.trapMinVolumeRatio,
            trapMinAdversePercent: DEFAULT_FOOTPRINT_PARAMS.trapMinAdversePercent,
            trapMinAdverseTicks: DEFAULT_FOOTPRINT_PARAMS.trapMinAdverseTicks,
            trapRequireLargePrint: DEFAULT_FOOTPRINT_PARAMS.trapRequireLargePrint,
            trapMinRangeReverse: DEFAULT_FOOTPRINT_PARAMS.trapMinRangeReverse,
            trapRequireStructureOrCvd: DEFAULT_FOOTPRINT_PARAMS.trapRequireStructureOrCvd,
            trapPreferHeatContext: DEFAULT_FOOTPRINT_PARAMS.trapPreferHeatContext,
            trapMinStrength: DEFAULT_FOOTPRINT_PARAMS.trapMinStrength,
            trapMaxCount: DEFAULT_FOOTPRINT_PARAMS.trapMaxCount,
          }
        : SENSITIVE_TRAP_PARAMS),
    }),
    [strictTraps, tickSize],
  );

  const model = useMemo(() => buildFootprintModel(bars, params), [bars, params]);
  const series = model.series;
  const extents = useMemo(() => footprintVolumeExtents(series), [series]);

  useEffect(() => {
    if (!series.length) {
      setEndIndex(0);
      return;
    }
    setEndIndex((prev) => {
      if (prev <= 0 || prev >= series.length - 1) {
        return series.length - 1;
      }
      return Math.min(prev, series.length - 1);
    });
  }, [series.length]);

  const startIndex = useMemo(() => {
    if (!series.length) {
      return 0;
    }
    const end = Math.min(Math.max(endIndex, 0), series.length - 1);
    const count = Math.min(visibleCount, series.length);
    return Math.max(0, end - count + 1);
  }, [endIndex, series.length, visibleCount]);

  const visibleBars = useMemo(
    () => series.slice(startIndex, Math.min(series.length, startIndex + visibleCount)),
    [series, startIndex, visibleCount],
  );

  const visibleHeat = useMemo(() => {
    if (!showHeatmap && viewMode !== "heat") {
      return [] as HeatmapPoint[];
    }
    const end = startIndex + visibleBars.length - 1;
    return model.heatmap.filter((p) => p.barIndex >= startIndex && p.barIndex <= end);
  }, [model.heatmap, showHeatmap, startIndex, viewMode, visibleBars.length]);

  const visibleTraps = useMemo(() => {
    if (!showTraps) {
      return [] as TrappedLiquidity[];
    }
    const end = startIndex + visibleBars.length - 1;
    return model.traps.filter((t) => t.barIndex >= startIndex && t.barIndex <= end);
  }, [model.traps, showTraps, startIndex, visibleBars.length]);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) {
      return;
    }
    const ro = new ResizeObserver((entries) => {
      const entry = entries[0];
      if (!entry) {
        return;
      }
      const { width, height } = entry.contentRect;
      setSize({
        w: Math.max(320, Math.floor(width)),
        h: Math.max(360, Math.floor(height)),
      });
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const layout = useMemo(() => {
    const plotW = size.w - PAD.left - PAD.right;
    const plotH = size.h - PAD.top - PAD.bottom;
    const n = Math.max(visibleBars.length, 1);
    const colW = plotW / n;

    let priceMin = Infinity;
    let priceMax = -Infinity;
    for (const bar of visibleBars) {
      priceMin = Math.min(priceMin, bar.low);
      priceMax = Math.max(priceMax, bar.high);
    }
    if (!Number.isFinite(priceMin) || !Number.isFinite(priceMax)) {
      priceMin = 0;
      priceMax = 1;
    }
    const pad = Math.max((priceMax - priceMin) * 0.06, tickSize * 2);
    priceMin -= pad;
    priceMax += pad;
    const priceSpan = Math.max(priceMax - priceMin, tickSize);

    const yForPrice = (price: number) =>
      PAD.top + ((priceMax - price) / priceSpan) * plotH;
    const xForIndex = (localIndex: number) => PAD.left + localIndex * colW + colW / 2;
    const xForGlobal = (globalIndex: number) => xForIndex(globalIndex - startIndex);

    return {
      plotW,
      plotH,
      colW,
      priceMin,
      priceMax,
      priceSpan,
      yForPrice,
      xForIndex,
      xForGlobal,
    };
  }, [size, startIndex, tickSize, visibleBars]);

  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) {
      return;
    }
    const dpr = typeof window !== "undefined" ? window.devicePixelRatio || 1 : 1;
    canvas.width = Math.floor(size.w * dpr);
    canvas.height = Math.floor(size.h * dpr);
    canvas.style.width = `${size.w}px`;
    canvas.style.height = `${size.h}px`;

    const ctx = canvas.getContext("2d");
    if (!ctx) {
      return;
    }
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, size.w, size.h);

    ctx.fillStyle = COLORS.bg;
    ctx.fillRect(0, 0, size.w, size.h);

    if (!visibleBars.length) {
      ctx.fillStyle = COLORS.text;
      ctx.font = "13px ui-sans-serif, system-ui, sans-serif";
      ctx.textAlign = "center";
      ctx.fillText("No OHLCV bars to render footprint", size.w / 2, size.h / 2);
      return;
    }

    const { colW, priceMin, priceMax, priceSpan, yForPrice, xForIndex, xForGlobal, plotH } =
      layout;
    const showFp = viewMode === "both" || viewMode === "footprint";
    const showBubbles =
      viewMode === "both" || viewMode === "bubbles" || viewMode === "heat";
    const drawHeat = showHeatmap || viewMode === "heat";
    const maxCell = extents.maxCellVolume;
    const maxBubble = extents.maxBubbleVolume;
    const maxHeat = model.maxHeat;

    // --- Dense heatmap trails (behind everything) ---
    if (drawHeat && visibleHeat.length) {
      const cellH = Math.max(2.5, (tickSize / priceSpan) * plotH);
      const trailW = Math.max(colW * 1.05, 3);

      for (const point of visibleHeat) {
        const local = point.barIndex - startIndex;
        if (local < 0 || local >= visibleBars.length) {
          continue;
        }
        const x = xForGlobal(point.barIndex);
        const y = yForPrice(point.mid);
        const intensity = Math.pow(point.heatTotal / maxHeat, 0.55) * heatIntensity;
        if (intensity < 0.03) {
          continue;
        }

        const buyShare = point.heatTotal > 0 ? point.heatBuy / point.heatTotal : 0.5;
        // Blend buy (teal) / sell (rose) residual heat
        const r = Math.round(
          COLORS.heatSell.r * (1 - buyShare) + COLORS.heatBuy.r * buyShare,
        );
        const g = Math.round(
          COLORS.heatSell.g * (1 - buyShare) + COLORS.heatBuy.g * buyShare,
        );
        const b = Math.round(
          COLORS.heatSell.b * (1 - buyShare) + COLORS.heatBuy.b * buyShare,
        );
        const alpha = Math.min(0.72, 0.06 + intensity * 0.62);

        // Soft horizontal trail segment
        const grad = ctx.createLinearGradient(x - trailW / 2, y, x + trailW / 2, y);
        grad.addColorStop(0, `rgba(${r},${g},${b},0)`);
        grad.addColorStop(0.35, `rgba(${r},${g},${b},${alpha * 0.85})`);
        grad.addColorStop(0.65, `rgba(${r},${g},${b},${alpha})`);
        grad.addColorStop(1, `rgba(${r},${g},${b},0)`);
        ctx.fillStyle = grad;
        ctx.fillRect(x - trailW / 2, y - cellH * 0.55, trailW, cellH * 1.1);

        // Hot core for whale residual
        if (intensity > 0.55) {
          ctx.fillStyle = `rgba(${r},${g},${b},${Math.min(0.55, alpha * 0.9)})`;
          ctx.beginPath();
          ctx.ellipse(x, y, trailW * 0.28, cellH * 0.45, 0, 0, Math.PI * 2);
          ctx.fill();
        }
      }
    }

    // Horizontal grid + price labels
    const approxTicks = Math.max(4, Math.floor(plotH / 48));
    const rawStep = priceSpan / approxTicks;
    const tickStep = Math.max(tickSize, niceStep(rawStep));
    ctx.strokeStyle = COLORS.grid;
    ctx.lineWidth = 1;
    ctx.fillStyle = COLORS.axis;
    ctx.font = "10px ui-monospace, SFMono-Regular, Menlo, monospace";
    ctx.textAlign = "left";
    ctx.textBaseline = "middle";

    const firstPrice = Math.ceil(priceMin / tickStep) * tickStep;
    for (let p = firstPrice; p <= priceMax + tickStep * 0.01; p += tickStep) {
      const y = yForPrice(p);
      ctx.beginPath();
      ctx.moveTo(PAD.left, y);
      ctx.lineTo(size.w - PAD.right, y);
      ctx.stroke();
      ctx.fillText(formatPrice(p, tickSize), size.w - PAD.right + 8, y);
    }

    for (let i = 0; i < visibleBars.length; i += 1) {
      if (i % 5 === 0) {
        const x = PAD.left + i * colW;
        ctx.strokeStyle = "rgba(255,255,255,0.03)";
        ctx.beginPath();
        ctx.moveTo(x, PAD.top);
        ctx.lineTo(x, size.h - PAD.bottom);
        ctx.stroke();
      }
    }

    ctx.fillStyle = COLORS.text;
    ctx.textAlign = "center";
    ctx.textBaseline = "top";
    const labelEvery = Math.max(1, Math.ceil(visibleBars.length / 8));
    for (let i = 0; i < visibleBars.length; i += labelEvery) {
      const bar = visibleBars[i];
      ctx.fillText(formatTime(bar.timestamp), xForIndex(i), size.h - PAD.bottom + 10);
    }

    // Footprint cells + candles
    for (let i = 0; i < visibleBars.length; i += 1) {
      const bar = visibleBars[i];
      const centerX = PAD.left + i * colW + colW / 2;
      const cellH = Math.max(2, (tickSize / priceSpan) * plotH);

      if (showFp) {
        for (const cell of bar.cells) {
          const y = yForPrice(cell.mid);
          const halfW = Math.max(4, colW * 0.4);
          const bidAlpha = 0.1 + 0.7 * (cell.bidVolume / maxCell);
          const askAlpha = 0.1 + 0.7 * (cell.askVolume / maxCell);

          ctx.fillStyle = rgba(COLORS.bid, bidAlpha);
          ctx.fillRect(centerX - halfW, y - cellH / 2, halfW - 0.5, cellH - 0.5);
          ctx.fillStyle = rgba(COLORS.ask, askAlpha);
          ctx.fillRect(centerX + 0.5, y - cellH / 2, halfW - 0.5, cellH - 0.5);

          if (Math.abs(cell.delta) / maxCell > 0.32) {
            ctx.strokeStyle =
              cell.delta > 0 ? "rgba(52,211,153,0.8)" : "rgba(251,113,133,0.8)";
            ctx.lineWidth = 1.25;
            ctx.strokeRect(centerX - halfW, y - cellH / 2, halfW * 2, cellH - 0.5);
          }

          if (showNumbers && colW >= 52 && cellH >= 11) {
            ctx.font = "9px ui-monospace, SFMono-Regular, Menlo, monospace";
            ctx.textBaseline = "middle";
            ctx.fillStyle = "rgba(255,255,255,0.72)";
            ctx.textAlign = "right";
            ctx.fillText(formatVol(cell.bidVolume), centerX - 3, y);
            ctx.textAlign = "left";
            ctx.fillText(formatVol(cell.askVolume), centerX + 3, y);
          }
        }
      }

      if (showCandles) {
        const yOpen = yForPrice(bar.open);
        const yClose = yForPrice(bar.close);
        const yHigh = yForPrice(bar.high);
        const yLow = yForPrice(bar.low);
        const up = bar.close >= bar.open;
        ctx.strokeStyle = up ? COLORS.wickUp : COLORS.wickDown;
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(centerX, yHigh);
        ctx.lineTo(centerX, yLow);
        ctx.stroke();
        const bodyTop = Math.min(yOpen, yClose);
        const bodyH = Math.max(2, Math.abs(yClose - yOpen));
        const bodyW = Math.min(colW * 0.16, 5);
        ctx.fillStyle = up ? "rgba(52,211,153,0.28)" : "rgba(251,113,133,0.28)";
        ctx.fillRect(centerX - bodyW / 2, bodyTop, bodyW, bodyH);
      }
    }

    // Aggression bubbles — size ∝ volume, rings mark large/whale prints
    if (showBubbles) {
      for (let i = 0; i < visibleBars.length; i += 1) {
        const bar = visibleBars[i];
        const centerX = xForIndex(i);
        // Draw normal first, whales on top
        const ordered = [...bar.bubbles].sort((a, b) => a.aggression - b.aggression);
        for (const bubble of ordered) {
          const y = yForPrice(bubble.price);
          const t = Math.sqrt(bubble.volume / maxBubble);
          const tierBoost = bubble.tier === "whale" ? 1.35 : bubble.tier === "large" ? 1.15 : 1;
          const r = Math.max(
            2.5,
            Math.min(colW * 0.52, (3.5 + t * 20 * bubbleScale) * tierBoost),
          );
          const fill =
            bubble.side === "buy"
              ? COLORS.bubbleBuy
              : bubble.side === "sell"
                ? COLORS.bubbleSell
                : COLORS.bubbleMixed;

          const glowR = r * (bubble.tier === "whale" ? 2.1 : bubble.tier === "large" ? 1.7 : 1.35);
          const grad = ctx.createRadialGradient(centerX, y, 0, centerX, y, glowR);
          grad.addColorStop(0, fill);
          grad.addColorStop(1, "rgba(0,0,0,0)");
          ctx.fillStyle = grad;
          ctx.beginPath();
          ctx.arc(centerX, y, glowR, 0, Math.PI * 2);
          ctx.fill();

          ctx.fillStyle = fill;
          ctx.beginPath();
          ctx.arc(centerX, y, r, 0, Math.PI * 2);
          ctx.fill();

          if (bubble.tier === "whale") {
            ctx.strokeStyle = COLORS.whaleRing;
            ctx.lineWidth = 2;
            ctx.setLineDash([]);
            ctx.beginPath();
            ctx.arc(centerX, y, r + 2.5, 0, Math.PI * 2);
            ctx.stroke();
            // Double ring for max aggression
            ctx.strokeStyle = "rgba(250, 204, 21, 0.35)";
            ctx.lineWidth = 1;
            ctx.beginPath();
            ctx.arc(centerX, y, r + 5, 0, Math.PI * 2);
            ctx.stroke();
          } else if (bubble.tier === "large") {
            ctx.strokeStyle = COLORS.largeRing;
            ctx.lineWidth = 1.5;
            ctx.beginPath();
            ctx.arc(centerX, y, r + 1.5, 0, Math.PI * 2);
            ctx.stroke();
          } else {
            ctx.strokeStyle =
              bubble.side === "buy"
                ? "rgba(167,243,208,0.75)"
                : bubble.side === "sell"
                  ? "rgba(254,205,211,0.75)"
                  : "rgba(226,232,240,0.6)";
            ctx.lineWidth = 1;
            ctx.stroke();
          }
        }
      }
    }

    // Trapped liquidity — diamonds + TB/TS labels (shape + color + text)
    if (showTraps && visibleTraps.length) {
      for (const trap of visibleTraps) {
        const local = trap.barIndex - startIndex;
        if (local < 0 || local >= visibleBars.length) {
          continue;
        }
        const x = xForGlobal(trap.barIndex);
        const y = yForPrice(trap.price);
        const palette = trap.side === "buy" ? COLORS.trapBuy : COLORS.trapSell;
        const dSize = 5 + trap.strength * 7;

        // Soft halo
        ctx.fillStyle =
          trap.side === "buy" ? "rgba(251, 191, 36, 0.18)" : "rgba(167, 139, 250, 0.18)";
        ctx.beginPath();
        ctx.arc(x, y, dSize * 1.8, 0, Math.PI * 2);
        ctx.fill();

        drawDiamond(ctx, x, y, dSize, palette.fill, palette.stroke);

        // Cross hatch inside diamond to avoid color-only encoding
        ctx.strokeStyle = palette.stroke;
        ctx.lineWidth = 1;
        ctx.beginPath();
        if (trap.side === "buy") {
          // downward chevron = buyers trapped from above
          ctx.moveTo(x - dSize * 0.35, y - dSize * 0.15);
          ctx.lineTo(x, y + dSize * 0.35);
          ctx.lineTo(x + dSize * 0.35, y - dSize * 0.15);
        } else {
          // upward chevron = sellers trapped from below
          ctx.moveTo(x - dSize * 0.35, y + dSize * 0.15);
          ctx.lineTo(x, y - dSize * 0.35);
          ctx.lineTo(x + dSize * 0.35, y + dSize * 0.15);
        }
        ctx.stroke();

        if (colW >= 28) {
          ctx.font = "bold 9px ui-monospace, SFMono-Regular, Menlo, monospace";
          ctx.fillStyle = palette.label;
          ctx.textAlign = "center";
          ctx.textBaseline = "bottom";
          ctx.fillText(trap.side === "buy" ? "TB" : "TS", x, y - dSize - 3);
        }
      }
    }

    // Hover crosshair
    if (hover) {
      ctx.strokeStyle = COLORS.crosshair;
      ctx.setLineDash([4, 4]);
      ctx.beginPath();
      ctx.moveTo(hover.canvasX, PAD.top);
      ctx.lineTo(hover.canvasX, size.h - PAD.bottom);
      ctx.moveTo(PAD.left, hover.canvasY);
      ctx.lineTo(size.w - PAD.right, hover.canvasY);
      ctx.stroke();
      ctx.setLineDash([]);
    }
  }, [
    bubbleScale,
    extents.maxBubbleVolume,
    extents.maxCellVolume,
    heatIntensity,
    hover,
    layout,
    model.maxHeat,
    showCandles,
    showHeatmap,
    showNumbers,
    showTraps,
    size.h,
    size.w,
    startIndex,
    tickSize,
    viewMode,
    visibleBars,
    visibleHeat,
    visibleTraps,
  ]);

  useEffect(() => {
    draw();
  }, [draw]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) {
      return;
    }
    const onWheelNative = (event: WheelEvent) => {
      event.preventDefault();
      const delta = event.deltaY > 0 ? 1 : -1;
      const rect = canvas.getBoundingClientRect();
      const x = event.clientX - rect.left;
      const colW = Math.max(layout.colW, 1);
      const localIndex = Math.min(
        visibleBars.length - 1,
        Math.max(0, Math.floor((x - PAD.left) / colW)),
      );
      const anchorGlobal = startIndex + localIndex;

      setVisibleCount((v) => {
        const next = Math.min(
          MAX_VISIBLE,
          Math.max(MIN_VISIBLE, v + delta * Math.max(2, Math.floor(v * 0.12))),
        );
        const newStart = Math.max(
          0,
          Math.min(
            series.length - next,
            anchorGlobal - Math.floor(localIndex * (next / Math.max(v, 1))),
          ),
        );
        setEndIndex(Math.min(series.length - 1, newStart + next - 1));
        return next;
      });
    };
    canvas.addEventListener("wheel", onWheelNative, { passive: false });
    return () => canvas.removeEventListener("wheel", onWheelNative);
  }, [layout.colW, series.length, startIndex, visibleBars.length]);

  const hitTest = useCallback(
    (clientX: number, clientY: number): HoverInfo | null => {
      const canvas = canvasRef.current;
      if (!canvas || !visibleBars.length) {
        return null;
      }
      const rect = canvas.getBoundingClientRect();
      const x = clientX - rect.left;
      const y = clientY - rect.top;
      if (
        x < PAD.left ||
        x > size.w - PAD.right ||
        y < PAD.top ||
        y > size.h - PAD.bottom
      ) {
        return null;
      }

      const { colW, yForPrice, priceMin, priceSpan, plotH, xForGlobal } = layout;
      const localIndex = Math.min(
        visibleBars.length - 1,
        Math.max(0, Math.floor((x - PAD.left) / colW)),
      );
      const bar = visibleBars[localIndex];
      if (!bar) {
        return null;
      }

      const price = priceMin + ((PAD.top + plotH - y) / plotH) * priceSpan;

      // Prefer trap hit (distinct markers)
      let trap: TrappedLiquidity | null = null;
      let trapDist = Infinity;
      for (const t of bar.traps) {
        const d = Math.abs(t.price - price);
        if (d < trapDist) {
          trapDist = d;
          trap = t;
        }
      }
      if (trap && trapDist > tickSize * 3) {
        trap = null;
      }

      let bubble: FootprintBubble | null = null;
      let bubbleDist = Infinity;
      for (const b of bar.bubbles) {
        const d = Math.abs(b.price - price);
        if (d < bubbleDist) {
          bubbleDist = d;
          bubble = b;
        }
      }
      if (bubble && bubbleDist > tickSize * 2.5) {
        bubble = null;
      }

      let best: FootprintCell | null = null;
      let bestDist = Infinity;
      for (const cell of bar.cells) {
        const d = Math.abs(cell.mid - price);
        if (d < bestDist) {
          bestDist = d;
          best = cell;
        }
      }
      if (best && bestDist > tickSize * 2.5) {
        best = null;
      }

      const focusPrice = trap?.price ?? bubble?.price ?? best?.mid ?? bar.close;

      return {
        bar,
        cell: best,
        trap,
        bubble,
        canvasX: xForGlobal(bar.index),
        canvasY: yForPrice(focusPrice),
      };
    },
    [layout, size.h, size.w, tickSize, visibleBars],
  );

  const onPointerMove = (event: ReactPointerEvent<HTMLCanvasElement>) => {
    if (dragRef.current) {
      const dx = event.clientX - dragRef.current.startX;
      const cols = Math.round(-dx / Math.max(layout.colW, 1));
      if (cols !== 0) {
        const next = Math.min(
          series.length - 1,
          Math.max(visibleCount - 1, dragRef.current.startEnd + cols),
        );
        setEndIndex(next);
        dragRef.current = { startX: event.clientX, startEnd: next };
      }
      return;
    }
    setHover(hitTest(event.clientX, event.clientY));
  };

  const onPointerLeave = () => {
    setHover(null);
    dragRef.current = null;
  };

  const onPointerDown = (event: ReactPointerEvent<HTMLCanvasElement>) => {
    dragRef.current = { startX: event.clientX, startEnd: endIndex };
    event.currentTarget.setPointerCapture?.(event.pointerId);
  };

  const onPointerUp = () => {
    dragRef.current = null;
  };

  const zoomIn = () => {
    setVisibleCount((v) => {
      const next = Math.max(MIN_VISIBLE, Math.floor(v * 0.7));
      setEndIndex((e) => Math.min(series.length - 1, Math.max(next - 1, e)));
      return next;
    });
  };

  const zoomOut = () => {
    setVisibleCount((v) => {
      const next = Math.min(MAX_VISIBLE, Math.ceil(v * 1.4), series.length || MAX_VISIBLE);
      setEndIndex((e) => Math.min(series.length - 1, Math.max(next - 1, e)));
      return next;
    });
  };

  const resetView = () => {
    setVisibleCount(DEFAULT_VISIBLE);
    setEndIndex(Math.max(0, series.length - 1));
  };

  const tooltipStyle = useMemo(() => {
    if (!hover || !containerRef.current) {
      return null;
    }
    const left = Math.min(
      containerRef.current.clientWidth - 240,
      Math.max(8, hover.canvasX + 16),
    );
    const top = Math.min(
      containerRef.current.clientHeight - 180,
      Math.max(8, hover.canvasY - 20),
    );
    return { left, top };
  }, [hover]);

  const trapCount = model.traps.length;
  const whaleCount = useMemo(
    () => series.reduce((n, b) => n + b.bubbles.filter((x) => x.tier === "whale").length, 0),
    [series],
  );

  return (
    <div className={cn("flex w-full flex-col gap-3", className)}>
      <div className="flex flex-wrap items-center gap-2">
        <Badge tone="blue">DeepChart + Bookmap heat</Badge>
        <span className="text-xs text-zinc-500">
          {tickerLabel} · {whaleCount} whale prints · {trapCount} traps · drag / wheel
        </span>
        {onOpenFaq ? (
          <Button
            type="button"
            onClick={onOpenFaq}
            className="ml-auto px-3 py-1.5 text-xs sm:ml-0"
          >
            <HelpCircle className="h-3.5 w-3.5" />
            Legend & FAQ
          </Button>
        ) : null}
      </div>

      <div className="flex flex-wrap items-center gap-2">
        {(
          [
            { id: "both" as const, label: "Footprint + Bubbles" },
            { id: "heat" as const, label: "Heat + Bubbles" },
            { id: "footprint" as const, label: "Footprint only" },
            { id: "bubbles" as const, label: "Bubbles only" },
          ] as const
        ).map((mode) => (
          <Button
            key={mode.id}
            type="button"
            onClick={() => setViewMode(mode.id)}
            className={cn(
              "px-3 py-1.5 text-xs",
              viewMode === mode.id && "border-cyan-300/60 bg-cyan-300/15",
            )}
          >
            {mode.id === "bubbles" ? (
              <CircleDot className="h-3.5 w-3.5" />
            ) : (
              <Layers className="h-3.5 w-3.5" />
            )}
            {mode.label}
          </Button>
        ))}

        <label className="inline-flex cursor-pointer items-center gap-2 rounded-xl border border-white/10 bg-black/25 px-2.5 py-1.5 text-xs text-zinc-300">
          <input
            type="checkbox"
            checked={showHeatmap}
            onChange={(e) => setShowHeatmap(e.target.checked)}
            className="h-3.5 w-3.5 accent-cyan-300"
          />
          Heat trails
        </label>
        <label className="inline-flex cursor-pointer items-center gap-2 rounded-xl border border-white/10 bg-black/25 px-2.5 py-1.5 text-xs text-zinc-300">
          <input
            type="checkbox"
            checked={showTraps}
            onChange={(e) => setShowTraps(e.target.checked)}
            className="h-3.5 w-3.5 accent-cyan-300"
          />
          Traps
        </label>
        <label
          className={cn(
            "inline-flex cursor-pointer items-center gap-2 rounded-xl border px-2.5 py-1.5 text-xs",
            strictTraps
              ? "border-violet-300/40 bg-violet-400/10 text-violet-100"
              : "border-white/10 bg-black/25 text-zinc-300",
          )}
          title="Strict filters mid-trend micro-bounces; Sensitive shows more TS/TB noise"
        >
          <input
            type="checkbox"
            checked={strictTraps}
            onChange={(e) => setStrictTraps(e.target.checked)}
            className="h-3.5 w-3.5 accent-violet-300"
          />
          Strict traps
        </label>
        <label className="inline-flex cursor-pointer items-center gap-2 rounded-xl border border-white/10 bg-black/25 px-2.5 py-1.5 text-xs text-zinc-300">
          <input
            type="checkbox"
            checked={showCandles}
            onChange={(e) => setShowCandles(e.target.checked)}
            className="h-3.5 w-3.5 accent-cyan-300"
          />
          OHLC
        </label>
        <label className="inline-flex cursor-pointer items-center gap-2 rounded-xl border border-white/10 bg-black/25 px-2.5 py-1.5 text-xs text-zinc-300">
          <input
            type="checkbox"
            checked={showNumbers}
            onChange={(e) => setShowNumbers(e.target.checked)}
            className="h-3.5 w-3.5 accent-cyan-300"
          />
          Numbers
        </label>

        <div className="inline-flex items-center gap-2 rounded-xl border border-white/10 bg-black/25 px-2.5 py-1 text-xs text-zinc-300">
          <span className="text-zinc-500">Heat</span>
          <input
            type="range"
            min={0.4}
            max={1.8}
            step={0.1}
            value={heatIntensity}
            onChange={(e) => setHeatIntensity(Number(e.target.value))}
            className="w-16 accent-cyan-300"
            aria-label="Heat trail intensity"
          />
        </div>
        <div className="inline-flex items-center gap-2 rounded-xl border border-white/10 bg-black/25 px-2.5 py-1 text-xs text-zinc-300">
          <span className="text-zinc-500">Bubble</span>
          <input
            type="range"
            min={0.5}
            max={2}
            step={0.1}
            value={bubbleScale}
            onChange={(e) => setBubbleScale(Number(e.target.value))}
            className="w-16 accent-cyan-300"
            aria-label="Bubble size scale"
          />
        </div>

        <label className="inline-flex cursor-pointer items-center gap-2 rounded-xl border border-white/10 bg-black/25 px-2.5 py-1.5 text-xs text-zinc-300">
          <input
            type="checkbox"
            checked={autoTick}
            onChange={(e) => {
              setAutoTick(e.target.checked);
              if (!e.target.checked) {
                setTickInput(String(suggestedTick));
              }
            }}
            className="h-3.5 w-3.5 accent-cyan-300"
          />
          Auto tick
        </label>
        {!autoTick ? (
          <div className="flex items-center gap-1.5">
            <span className="text-[10px] uppercase tracking-wider text-zinc-500">Tick</span>
            <Input
              value={tickInput}
              onChange={(e) => setTickInput(e.target.value)}
              className="h-8 w-24 px-2 text-xs"
              inputMode="decimal"
            />
          </div>
        ) : (
          <span className="font-mono text-[11px] text-zinc-500">
            tick {formatPrice(tickSize, tickSize)}
          </span>
        )}

        <div className="ml-auto flex flex-wrap items-center gap-1.5">
          <Button type="button" onClick={zoomIn} className="px-2 py-1.5 text-xs" aria-label="Zoom in">
            <ZoomIn className="h-3.5 w-3.5" />
          </Button>
          <Button type="button" onClick={zoomOut} className="px-2 py-1.5 text-xs" aria-label="Zoom out">
            <ZoomOut className="h-3.5 w-3.5" />
          </Button>
          <Button type="button" onClick={resetView} className="px-3 py-1.5 text-xs">
            Reset
          </Button>
        </div>
      </div>

      <div className="flex flex-wrap gap-x-4 gap-y-2 text-[11px] text-zinc-500">
        <span className="inline-flex items-center gap-1.5">
          <span className="h-2.5 w-4 rounded-sm bg-gradient-to-r from-rose-500/50 to-emerald-500/50" />
          Heat trail (buy→teal / sell→rose)
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span className="h-2.5 w-2.5 rounded-full bg-emerald-400/80 ring-2 ring-yellow-300/90" />
          Whale buy (gold ring)
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span className="h-2.5 w-2.5 rounded-full bg-rose-400/80 ring-2 ring-yellow-300/90" />
          Whale sell
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span
            className="inline-block h-2.5 w-2.5 rotate-45 bg-amber-400"
            aria-hidden
          />
          <span className="font-mono text-amber-200">TB</span> Trapped buyside
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span
            className="inline-block h-2.5 w-2.5 rotate-45 bg-violet-400"
            aria-hidden
          />
          <span className="font-mono text-violet-200">TS</span> Trapped sellside
        </span>
      </div>

      <div
        ref={containerRef}
        className="relative min-h-[560px] w-full overflow-hidden rounded-2xl border border-white/10 bg-zinc-950"
      >
        <canvas
          ref={canvasRef}
          className="block h-full min-h-[560px] w-full cursor-crosshair touch-none"
          onPointerMove={onPointerMove}
          onPointerLeave={onPointerLeave}
          onPointerDown={onPointerDown}
          onPointerUp={onPointerUp}
          role="img"
          aria-label={`Footprint, heatmap trails, and trapped liquidity chart for ${tickerLabel}`}
        />

        {hover && tooltipStyle ? (
          <div
            className="pointer-events-none absolute z-10 w-56 rounded-xl border border-white/15 bg-zinc-950/95 p-3 text-xs shadow-xl backdrop-blur-sm"
            style={{ left: tooltipStyle.left, top: tooltipStyle.top }}
          >
            <div className="font-mono text-[10px] text-zinc-500">
              {formatTime(hover.bar.timestamp)}
            </div>
            <div className="mt-1 font-semibold text-white">
              {formatPrice(
                hover.trap?.price ?? hover.bubble?.price ?? hover.cell?.mid ?? hover.bar.close,
                tickSize,
              )}
            </div>

            {hover.trap ? (
              <div className="mt-2 space-y-1.5">
                <div
                  className={cn(
                    "inline-flex items-center gap-1.5 rounded-md border px-1.5 py-0.5 font-mono text-[10px] font-bold",
                    hover.trap.side === "buy"
                      ? "border-amber-300/40 bg-amber-400/15 text-amber-100"
                      : "border-violet-300/40 bg-violet-400/15 text-violet-100",
                  )}
                >
                  <span className="inline-block h-2 w-2 rotate-45 bg-current opacity-80" />
                  {hover.trap.side === "buy" ? "TB · Trapped buyside" : "TS · Trapped sellside"}
                </div>
                <p className="text-[11px] leading-snug text-zinc-400">{hover.trap.reason}</p>
                <div className="grid grid-cols-2 gap-x-2 font-mono text-[11px]">
                  <span className="text-zinc-500">Strength</span>
                  <span className="text-right text-zinc-200">
                    {(hover.trap.strength * 100).toFixed(0)}%
                  </span>
                  <span className="text-zinc-500">Adverse</span>
                  <span className="text-right text-zinc-200">
                    {hover.trap.adverseMove.toFixed(2)}
                  </span>
                  <span className="text-zinc-500">Confirm</span>
                  <span className="text-right text-zinc-200">{hover.trap.confirm}</span>
                  <span className="text-zinc-500">Vol</span>
                  <span className="text-right text-zinc-200">{formatVol(hover.trap.volume)}</span>
                </div>
              </div>
            ) : null}

            {hover.bubble && !hover.trap ? (
              <div className="mt-2 grid grid-cols-2 gap-x-2 gap-y-1 font-mono text-[11px]">
                <span className="text-zinc-500">Print</span>
                <span
                  className={cn(
                    "text-right font-semibold",
                    hover.bubble.side === "buy"
                      ? "text-emerald-300"
                      : hover.bubble.side === "sell"
                        ? "text-rose-300"
                        : "text-zinc-300",
                  )}
                >
                  {hover.bubble.side} · {hover.bubble.tier}
                </span>
                <span className="text-zinc-500">Vol</span>
                <span className="text-right text-zinc-200">{formatVol(hover.bubble.volume)}</span>
                <span className="text-zinc-500">Imb</span>
                <span className="text-right text-zinc-200">
                  {(hover.bubble.imbalance * 100).toFixed(0)}%
                </span>
                <span className="text-zinc-500">Aggr</span>
                <span className="text-right text-yellow-200">
                  {(hover.bubble.aggression * 100).toFixed(0)}%
                </span>
              </div>
            ) : null}

            {hover.cell && !hover.trap ? (
              <div className="mt-2 grid grid-cols-2 gap-x-2 gap-y-1 border-t border-white/10 pt-2 font-mono text-[11px]">
                <span className="text-zinc-500">Bid</span>
                <span className="text-right text-rose-300">{formatVol(hover.cell.bidVolume)}</span>
                <span className="text-zinc-500">Ask</span>
                <span className="text-right text-emerald-300">{formatVol(hover.cell.askVolume)}</span>
                <span className="text-zinc-500">Δ</span>
                <span
                  className={cn(
                    "text-right font-semibold",
                    hover.cell.delta >= 0 ? "text-emerald-300" : "text-rose-300",
                  )}
                >
                  {formatVol(hover.cell.delta)}
                </span>
              </div>
            ) : null}

            {!hover.cell && !hover.bubble && !hover.trap ? (
              <div className="mt-2 font-mono text-[11px] text-zinc-400">
                Vol {formatVol(hover.bar.volume)} · Δ {formatVol(hover.bar.barDelta)}
              </div>
            ) : null}
          </div>
        ) : null}
      </div>

      <div className="rounded-2xl border border-white/10 bg-black/30 px-3 py-2.5 text-[11px] leading-relaxed text-zinc-500">
        <p>
          <span className="font-semibold text-zinc-300">Heat trails</span> — residual volume at each
          price decays forward (Bookmap-style density). Teal lean = buy aggression residue; rose =
          sell.
        </p>
        <p className="mt-1.5">
          <span className="font-semibold text-zinc-300">Big aggression</span> — circle size ∝ volume;
          white ring = large; gold double-ring = whale (top volume + imbalance).
        </p>
        <p className="mt-1.5">
          <span className="font-semibold text-amber-200/90">TB diamonds (amber)</span> = trapped
          buyside (buy aggression failed / reversed).{" "}
          <span className="font-semibold text-violet-200/90">TS diamonds (violet)</span> = trapped
          sellside. Shape + label + color so traps are not green/red alone.
        </p>
        <p className="mt-1.5">
          <span className="font-semibold text-violet-100">Strict traps</span> (default) require a
          meaningful adverse move (% / ticks), large or whale prints, and structure or CVD
          confirmation — so mid-trend micro-bounces are not marked as TS/TB. Turn Strict off only
          if you want the noisier “every local reverse” view.
        </p>
        <p className="mt-1.5 text-zinc-600">
          Proxy from OHLCV only — not true Bookmap MBO or exchange footprint. Use for research
          visualization, not execution.
        </p>
      </div>
    </div>
  );
}

function niceStep(raw: number): number {
  if (!Number.isFinite(raw) || raw <= 0) {
    return 1;
  }
  const exp = Math.floor(Math.log10(raw));
  const base = 10 ** exp;
  const m = raw / base;
  const nice = m <= 1 ? 1 : m <= 2 ? 2 : m <= 5 ? 5 : 10;
  return nice * base;
}
