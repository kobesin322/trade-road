"use client";

import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react";
import {
  Area,
  Bar,
  Brush,
  CartesianGrid,
  Cell,
  ComposedChart,
  Line,
  LineChart,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { Download, FileUp, Gauge, Loader2, RefreshCcw, RotateCcw, Sigma } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { TradingViewMultiTimeframe } from "@/components/charts/trading-view-multi-timeframe";
import { BouncyBallStrategyChart } from "@/components/charts/bouncy-ball-strategy-chart";
import { FootprintBookmapChart } from "@/components/charts/footprint-bookmap-chart";
import { TickerSearchPanel } from "@/components/charts/ticker-search-panel";
import { OrderflowFaqModal } from "@/components/tools/orderflow-faq-modal";
import { VolumeProfilePanel } from "@/components/tools/volume-profile-panel";
import type { MarketOHLCVPayload } from "@/lib/market-data/yahoo-chart";
import {
  CRYPTO_WATCHLIST,
  STOCK_WATCHLIST,
  type WatchlistItem,
} from "@/lib/market-data/symbols";
import { useCustomWatchlist } from "@/lib/hooks/use-custom-watchlist";
import {
  enhanceOrderFlowBars,
  generateEnhancedSignals,
  parseOHLCVCSV,
} from "@/lib/orderflow/computations";
import { runBacktest } from "@/lib/orderflow/backtester";
import {
  DEFAULT_STRATEGY_PARAMS,
  type BacktestResult,
  type OHLCVBar,
  type OrderFlowBar,
  type StrategyParams,
  type StrategySignal,
} from "@/lib/orderflow/types";
import { cn } from "@/lib/utils";

const DEFAULT_TICKER_ID = CRYPTO_WATCHLIST[0].id;
const STRATEGY_LAB_CHART_RANGE = "5d";
const STRATEGY_LAB_CHART_INTERVAL = "1m";

type ChartTab =
  | "price"
  | "cvd"
  | "profile"
  | "footprint"
  | "bouncyball"
  | "tradingview"
  | "equity";

const chartTabs: Array<{ id: ChartTab; label: string }> = [
  { id: "price", label: "Price + Delta" },
  { id: "cvd", label: "CVD" },
  { id: "profile", label: "Volume Profile" },
  { id: "footprint", label: "Footprint" },
  { id: "bouncyball", label: "Bouncy Ball" },
  { id: "tradingview", label: "TradingView MTF" },
  { id: "equity", label: "Equity" },
];

type ChartRow = {
  time: string;
  timestamp: number;
  close: number;
  barDelta: number;
  cumulativeDelta: number;
  equity?: number;
  drawdown?: number;
  /** Entry signal on this bar, if any. */
  signalDirection?: "long" | "short" | null;
};

type TooltipPayload = {
  name?: string;
  value?: number;
  dataKey?: string | number;
  payload?: ChartRow;
};

/** 1m bars: how many points each zoom preset shows (null = full series). */
type ZoomPreset = "30m" | "1h" | "4h" | "1d" | "all";
type ZoomSelection = ZoomPreset | "custom";

const ZOOM_PRESETS: Array<{ id: ZoomPreset; label: string; bars: number | null }> = [
  { id: "30m", label: "30m", bars: 30 },
  { id: "1h", label: "1H", bars: 60 },
  { id: "4h", label: "4H", bars: 240 },
  { id: "1d", label: "1D", bars: 390 },
  { id: "all", label: "All", bars: null },
];

const DEFAULT_ZOOM_PRESET: ZoomPreset = "1h";

type BrushRange = {
  startIndex: number;
  endIndex: number;
};

function rangeForPreset(dataLength: number, preset: ZoomPreset): BrushRange {
  if (dataLength <= 0) {
    return { startIndex: 0, endIndex: 0 };
  }
  const endIndex = dataLength - 1;
  const bars = ZOOM_PRESETS.find((item) => item.id === preset)?.bars ?? null;
  if (bars === null || bars >= dataLength) {
    return { startIndex: 0, endIndex };
  }
  return { startIndex: Math.max(0, endIndex - bars + 1), endIndex };
}

/**
 * Prefer a tight recent window, but expand (up to 1D) so the latest entry signal is still visible.
 */
function rangeIncludingLatestSignal(chartData: ChartRow[], preferredBars = 60, maxBars = 390): BrushRange {
  const dataLength = chartData.length;
  if (dataLength <= 0) {
    return { startIndex: 0, endIndex: 0 };
  }
  const endIndex = dataLength - 1;
  let lastSignalIndex = -1;
  for (let i = endIndex; i >= 0; i -= 1) {
    if (chartData[i]?.signalDirection) {
      lastSignalIndex = i;
      break;
    }
  }
  const needBars =
    lastSignalIndex >= 0 ? endIndex - lastSignalIndex + 1 + Math.min(20, preferredBars) : preferredBars;
  const bars = Math.min(maxBars, Math.max(preferredBars, needBars));
  return { startIndex: Math.max(0, endIndex - bars + 1), endIndex };
}

function clampBrushRange(range: BrushRange, dataLength: number): BrushRange {
  if (dataLength <= 0) {
    return { startIndex: 0, endIndex: 0 };
  }
  const maxIndex = dataLength - 1;
  const startIndex = Math.max(0, Math.min(range.startIndex, maxIndex));
  const endIndex = Math.max(startIndex, Math.min(range.endIndex, maxIndex));
  return { startIndex, endIndex };
}

function useChartBrushRange(chartData: ChartRow[]) {
  const dataLength = chartData.length;
  const [preset, setPreset] = useState<ZoomSelection>(DEFAULT_ZOOM_PRESET);
  const [range, setRange] = useState<BrushRange>(() => rangeIncludingLatestSignal(chartData));
  const [seededForLength, setSeededForLength] = useState(dataLength);

  // When a new series loads, re-seed so the latest signal is in view (not stuck on full 5d).
  useEffect(() => {
    if (dataLength === seededForLength) {
      return;
    }
    setSeededForLength(dataLength);
    setPreset(DEFAULT_ZOOM_PRESET);
    setRange(rangeIncludingLatestSignal(chartData));
  }, [chartData, dataLength, seededForLength]);

  useEffect(() => {
    if (preset === "custom" || preset === DEFAULT_ZOOM_PRESET) {
      // DEFAULT is managed by seed + applyPreset; avoid fighting the signal-aware initial window.
      if (preset === "custom") {
        setRange((current) => clampBrushRange(current, dataLength));
      }
      return;
    }
    setRange(rangeForPreset(dataLength, preset));
  }, [dataLength, preset]);

  const applyPreset = useCallback(
    (next: ZoomPreset) => {
      setPreset(next);
      if (next === DEFAULT_ZOOM_PRESET) {
        setRange(rangeIncludingLatestSignal(chartData));
        return;
      }
      setRange(rangeForPreset(dataLength, next));
    },
    [chartData, dataLength],
  );

  const onBrushChange = useCallback(
    (next: { startIndex?: number; endIndex?: number }) => {
      if (next.startIndex === undefined || next.endIndex === undefined) {
        return;
      }
      setPreset("custom");
      setRange(clampBrushRange({ startIndex: next.startIndex, endIndex: next.endIndex }, dataLength));
    },
    [dataLength],
  );

  return { preset, range, applyPreset, onBrushChange };
}

function ChartZoomControls({
  preset,
  onPreset,
  signalCount,
}: {
  preset: ZoomSelection;
  onPreset: (preset: ZoomPreset) => void;
  signalCount?: number;
}) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-2 px-1">
      <div className="flex flex-wrap items-center gap-1.5">
        <span className="mr-1 text-[10px] font-black uppercase tracking-[0.14em] text-zinc-500">Zoom</span>
        {ZOOM_PRESETS.map((item) => (
          <button
            key={item.id}
            type="button"
            onClick={() => onPreset(item.id)}
            className={cn(
              "rounded-full border px-2.5 py-1 text-[11px] font-semibold transition",
              preset === item.id
                ? "border-cyan-300/50 bg-cyan-300/15 text-cyan-100"
                : "border-white/10 bg-white/[0.03] text-zinc-400 hover:border-white/20 hover:text-zinc-200",
            )}
          >
            {item.label}
          </button>
        ))}
        {preset === "custom" ? (
          <span className="rounded-full border border-white/10 px-2.5 py-1 text-[11px] font-semibold text-zinc-300">
            Custom
          </span>
        ) : null}
      </div>
      {signalCount !== undefined ? (
        <span className="text-[11px] text-zinc-500">
          {signalCount} signal{signalCount === 1 ? "" : "s"} on chart · drag the brush below to pan/zoom
        </span>
      ) : (
        <span className="text-[11px] text-zinc-500">Drag the brush below to pan/zoom</span>
      )}
    </div>
  );
}

function SignalEntryDot(props: {
  cx?: number;
  cy?: number;
  payload?: ChartRow;
}) {
  const { cx, cy, payload } = props;
  if (cx == null || cy == null || !payload?.signalDirection) {
    return null;
  }
  const fill = payload.signalDirection === "long" ? "#22c55e" : "#fb7185";
  return (
    <g>
      <circle cx={cx} cy={cy} r={7} fill={fill} stroke="rgba(255,255,255,0.95)" strokeWidth={1.5} />
      <circle cx={cx} cy={cy} r={2.5} fill="rgba(255,255,255,0.9)" />
    </g>
  );
}

const numberFormatter = new Intl.NumberFormat("en-US", {
  maximumFractionDigits: 2,
});

const currencyFormatter = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  maximumFractionDigits: 2,
});

const compactNumberFormatter = new Intl.NumberFormat("en-US", {
  notation: "compact",
  maximumFractionDigits: 1,
});

function formatPercent(value: number) {
  return `${(value * 100).toFixed(1)}%`;
}

function formatDate(timestamp: number) {
  return new Date(timestamp).toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function formatValue(value: number | undefined, kind: "currency" | "number" | "percent" = "number") {
  if (value === undefined || !Number.isFinite(value)) {
    return "--";
  }

  if (kind === "currency") {
    return currencyFormatter.format(value);
  }

  if (kind === "percent") {
    return formatPercent(value);
  }

  return numberFormatter.format(value);
}

/** Axis ticks for price — limited decimals, no scientific noise. */
function formatPriceAxisTick(value: number) {
  if (!Number.isFinite(value)) return "";
  const abs = Math.abs(value);
  if (abs >= 10_000) return compactNumberFormatter.format(value);
  if (abs >= 1_000) return value.toFixed(0);
  if (abs >= 100) return value.toFixed(1);
  if (abs >= 1) return value.toFixed(2);
  if (abs >= 0.01) return value.toFixed(4);
  return value.toFixed(6);
}

/** Axis ticks for volume / bar delta / CVD — compact K/M when large; keep minus sign. */
function formatVolumeAxisTick(value: number) {
  if (!Number.isFinite(value)) return "";
  if (value === 0) return "0";
  const sign = value < 0 ? "−" : "";
  const abs = Math.abs(value);
  if (abs >= 1_000) return `${sign}${compactNumberFormatter.format(abs)}`;
  if (abs >= 100) return `${sign}${abs.toFixed(0)}`;
  if (abs >= 1) return `${sign}${abs.toFixed(1)}`;
  return `${sign}${abs.toFixed(2)}`;
}

function formatTooltipByKey(dataKey: string | number | undefined, value: number) {
  if (!Number.isFinite(value)) return "--";

  switch (dataKey) {
    case "close":
      return `$${formatPriceAxisTick(value)}`;
    case "barDelta":
      return `${formatVolumeAxisTick(value)} vol`;
    case "cumulativeDelta":
      return `${formatVolumeAxisTick(value)} vol`;
    case "equity":
      return currencyFormatter.format(value);
    case "drawdown":
      return `${value.toFixed(1)}%`;
    default:
      return formatVolumeAxisTick(value);
  }
}

function axisLabelStyle(fill: string) {
  return { fill, fontSize: 11, fontWeight: 600 };
}

function ChartLegendDot({ color, label }: { color: string; label: string }) {
  return (
    <span className="inline-flex items-center gap-1.5 text-[11px] text-zinc-400">
      <span className="inline-block h-2.5 w-2.5 rounded-full ring-1 ring-white/80" style={{ backgroundColor: color }} />
      {label}
    </span>
  );
}

function FormulaNote({ children }: { children: ReactNode }) {
  return (
    <div className="mt-3 max-w-3xl space-y-2 rounded-2xl border border-white/10 bg-black/30 px-3.5 py-3 text-xs leading-relaxed text-zinc-400">
      {children}
    </div>
  );
}

function FormulaCode({ children }: { children: ReactNode }) {
  return (
    <code className="block whitespace-pre-wrap rounded-xl border border-cyan-300/15 bg-cyan-300/5 px-3 py-2 font-mono text-[11px] leading-relaxed text-cyan-100/95">
      {children}
    </code>
  );
}

function MetricCard({
  label,
  tone = "text-white",
  value,
}: {
  label: string;
  tone?: string;
  value: string;
}) {
  return (
    <div className="rounded-3xl border border-white/10 bg-white/[0.04] p-4">
      <div className="text-[10px] font-black uppercase tracking-[0.18em] text-zinc-500">{label}</div>
      <div className={cn("mt-2 font-mono text-xl font-black", tone)}>{value}</div>
    </div>
  );
}

function StrategySlider({
  label,
  max,
  min,
  step,
  value,
  onChange,
}: {
  label: string;
  max: number;
  min: number;
  step: number;
  value: number;
  onChange: (value: number) => void;
}) {
  return (
    <label className="grid gap-2 rounded-2xl border border-white/10 bg-black/25 p-3">
      <div className="flex items-center justify-between gap-3">
        <span className="text-xs font-black uppercase tracking-[0.14em] text-zinc-500">{label}</span>
        <span className="font-mono text-sm font-black text-cyan-100">{value}</span>
      </div>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(event) => onChange(Number(event.target.value))}
        className="accent-cyan-300"
      />
    </label>
  );
}

function StrategyControls({
  params,
  onChange,
  onReset,
}: {
  params: StrategyParams;
  onChange: (params: StrategyParams) => void;
  onReset: () => void;
}) {
  const setParam = (key: keyof StrategyParams, value: number | boolean) => {
    onChange({
      ...params,
      [key]: value,
    });
  };

  return (
    <Card className="border-white/10 bg-black/35">
      <CardHeader>
        <div className="flex items-center justify-between gap-3">
          <CardTitle>Strategy Parameters</CardTitle>
          <Button type="button" onClick={onReset} className="px-3 py-2 text-xs">
            <RotateCcw className="h-3.5 w-3.5" />
            Reset
          </Button>
        </div>
      </CardHeader>
      <CardContent className="grid gap-3">
        <StrategySlider
          label="Min touches"
          min={1}
          max={5}
          step={1}
          value={params.minTouches}
          onChange={(value) => setParam("minTouches", value)}
        />
        <StrategySlider
          label="Level lookback"
          min={8}
          max={80}
          step={1}
          value={params.levelLookback}
          onChange={(value) => setParam("levelLookback", value)}
        />
        <StrategySlider
          label="Volatility factor"
          min={0.1}
          max={1.5}
          step={0.05}
          value={params.volatilityFactor}
          onChange={(value) => setParam("volatilityFactor", value)}
        />
        <StrategySlider
          label="Delta threshold"
          min={0}
          max={0.8}
          step={0.01}
          value={params.deltaThreshold}
          onChange={(value) => setParam("deltaThreshold", value)}
        />
        <StrategySlider
          label="Risk reward"
          min={0.5}
          max={5}
          step={0.1}
          value={params.riskReward}
          onChange={(value) => setParam("riskReward", value)}
        />
        <StrategySlider
          label="Risk per trade %"
          min={0.1}
          max={5}
          step={0.1}
          value={params.riskPerTradePercent}
          onChange={(value) => setParam("riskPerTradePercent", value)}
        />
        <StrategySlider
          label="Slippage bps"
          min={0}
          max={25}
          step={1}
          value={params.slippageBps}
          onChange={(value) => setParam("slippageBps", value)}
        />
        <label className="flex items-center gap-3 rounded-2xl border border-white/10 bg-black/25 p-3 text-sm font-semibold text-zinc-200">
          <input
            type="checkbox"
            checked={params.useDeltaDivergence}
            onChange={(event) => setParam("useDeltaDivergence", event.target.checked)}
            className="h-4 w-4 accent-cyan-300"
          />
          Require/allow CVD divergence confirmation
        </label>
      </CardContent>
    </Card>
  );
}

function StrategyTooltip({ active, payload, label }: { active?: boolean; payload?: TooltipPayload[]; label?: string }) {
  if (!active || !payload?.length) {
    return null;
  }

  return (
    <div className="rounded-2xl border border-white/10 bg-zinc-950/95 px-3 py-2 text-xs shadow-2xl">
      <div className="font-semibold text-white">{label}</div>
      <div className="mt-2 grid gap-1">
        {payload.map((item) => (
          <div key={String(item.dataKey)} className="flex justify-between gap-5 text-zinc-300">
            <span>{item.name ?? item.dataKey}</span>
            <span className="font-mono text-cyan-100">
              {formatTooltipByKey(item.dataKey, Number(item.value ?? 0))}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

function PriceDeltaChart({
  chartData,
  tickerLabel,
}: {
  chartData: ChartRow[];
  signals?: StrategySignal[];
  tickerLabel: string;
}) {
  const { preset, range, applyPreset, onBrushChange } = useChartBrushRange(chartData);
  const signalCount = useMemo(
    () => chartData.filter((row) => row.signalDirection === "long" || row.signalDirection === "short").length,
    [chartData],
  );

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 px-1">
        <ChartLegendDot color="#f8fafc" label="Close price ($)" />
        <ChartLegendDot color="rgba(52,211,153,0.75)" label="+ bar delta (up close)" />
        <ChartLegendDot color="rgba(251,113,133,0.75)" label="− bar delta (down close)" />
        <ChartLegendDot color="#22c55e" label="Long entry" />
        <ChartLegendDot color="#fb7185" label="Short entry" />
      </div>
      <ChartZoomControls preset={preset} onPreset={applyPreset} signalCount={signalCount} />
      <ResponsiveContainer width="100%" height={560}>
        <ComposedChart data={chartData} margin={{ top: 8, right: 12, left: 4, bottom: 8 }}>
          <CartesianGrid stroke="rgba(255,255,255,0.05)" vertical={false} />
          <XAxis dataKey="time" tick={{ fill: "#71717a", fontSize: 11 }} minTickGap={28} />
          <YAxis
            yAxisId="price"
            tick={{ fill: "#a1a1aa", fontSize: 11 }}
            domain={["auto", "auto"]}
            allowDataOverflow
            width={64}
            tickFormatter={formatPriceAxisTick}
            tickCount={6}
            label={{
              value: "Price ($)",
              angle: -90,
              position: "insideLeft",
              offset: 8,
              style: axisLabelStyle("#a1a1aa"),
            }}
          />
          <YAxis
            yAxisId="delta"
            orientation="right"
            tick={{ fill: "#71717a", fontSize: 11 }}
            domain={["auto", "auto"]}
            allowDataOverflow
            width={56}
            tickFormatter={formatVolumeAxisTick}
            tickCount={6}
            label={{
              value: "Bar delta (vol)",
              angle: 90,
              position: "insideRight",
              offset: 4,
              style: axisLabelStyle("#71717a"),
            }}
          />
          <Tooltip content={<StrategyTooltip />} />
          <ReferenceLine yAxisId="delta" y={0} stroke="rgba(255,255,255,0.2)" strokeDasharray="3 3" />
          <Bar yAxisId="delta" dataKey="barDelta" name="Bar delta (proxy vol)" isAnimationActive={false}>
            {chartData.map((row, index) => (
              <Cell
                key={`delta-${row.timestamp}-${index}`}
                fill={row.barDelta >= 0 ? "rgba(52,211,153,0.55)" : "rgba(251,113,133,0.55)"}
              />
            ))}
          </Bar>
          <Line
            yAxisId="price"
            type="monotone"
            dataKey="close"
            name={`${tickerLabel} close ($)`}
            stroke="#f8fafc"
            strokeWidth={2}
            dot={<SignalEntryDot />}
            activeDot={{ r: 4, strokeWidth: 1 }}
            isAnimationActive={false}
          />
          <Brush
            dataKey="time"
            height={32}
            stroke="#22d3ee"
            fill="rgba(34,211,238,0.06)"
            travellerWidth={10}
            startIndex={range.startIndex}
            endIndex={range.endIndex}
            onChange={onBrushChange}
            tickFormatter={(value) => String(value).replace(/,\s*\d{4}/, "")}
          />
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  );
}

function CvdChart({ chartData, tickerLabel }: { chartData: ChartRow[]; tickerLabel: string }) {
  const { preset, range, applyPreset, onBrushChange } = useChartBrushRange(chartData);

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 px-1">
        <ChartLegendDot color="#22d3ee" label="Proxy CVD (sum of bar delta, vol units)" />
        <ChartLegendDot color="#22c55e" label="Long entry (on CVD level)" />
        <ChartLegendDot color="#fb7185" label="Short entry (on CVD level)" />
      </div>
      <ChartZoomControls preset={preset} onPreset={applyPreset} signalCount={chartData.filter((r) => r.signalDirection).length} />
      <ResponsiveContainer width="100%" height={560}>
        <LineChart data={chartData} margin={{ top: 8, right: 12, left: 4, bottom: 8 }}>
          <CartesianGrid stroke="rgba(255,255,255,0.05)" vertical={false} />
          <XAxis dataKey="time" tick={{ fill: "#71717a", fontSize: 11 }} minTickGap={28} />
          <YAxis
            tick={{ fill: "#a1a1aa", fontSize: 11 }}
            domain={["auto", "auto"]}
            allowDataOverflow
            width={64}
            tickFormatter={formatVolumeAxisTick}
            tickCount={6}
            label={{
              value: "CVD (proxy vol)",
              angle: -90,
              position: "insideLeft",
              offset: 8,
              style: axisLabelStyle("#a1a1aa"),
            }}
          />
          <Tooltip content={<StrategyTooltip />} />
          <Line
            type="monotone"
            dataKey="cumulativeDelta"
            name={`${tickerLabel} CVD (proxy vol)`}
            stroke="#22d3ee"
            strokeWidth={2.5}
            dot={<SignalEntryDot />}
            activeDot={{ r: 4, strokeWidth: 1 }}
            isAnimationActive={false}
          />
          <Brush
            dataKey="time"
            height={32}
            stroke="#22d3ee"
            fill="rgba(34,211,238,0.06)"
            travellerWidth={10}
            startIndex={range.startIndex}
            endIndex={range.endIndex}
            onChange={onBrushChange}
            tickFormatter={(value) => String(value).replace(/,\s*\d{4}/, "")}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}

function EquityChart({ result }: { result: BacktestResult }) {
  const equityData = result.equityCurve.map((point) => ({
    time: formatDate(point.timestamp),
    timestamp: point.timestamp,
    close: 0,
    barDelta: 0,
    cumulativeDelta: 0,
    equity: point.equity,
    drawdown: point.drawdown * 100,
  }));

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 px-1">
        <ChartLegendDot color="#22c55e" label="Equity ($)" />
        <ChartLegendDot color="#fb7185" label="Drawdown (%)" />
      </div>
      <ResponsiveContainer width="100%" height={540}>
        <ComposedChart data={equityData} margin={{ top: 8, right: 12, left: 4, bottom: 4 }}>
          <CartesianGrid stroke="rgba(255,255,255,0.05)" vertical={false} />
          <XAxis dataKey="time" tick={{ fill: "#71717a", fontSize: 11 }} minTickGap={28} />
          <YAxis
            yAxisId="equity"
            tick={{ fill: "#a1a1aa", fontSize: 11 }}
            width={64}
            tickFormatter={(v) => {
              const n = Number(v);
              if (!Number.isFinite(n)) return "";
              return Math.abs(n) >= 1_000 ? `$${compactNumberFormatter.format(n)}` : `$${n.toFixed(0)}`;
            }}
            tickCount={6}
            label={{
              value: "Equity ($)",
              angle: -90,
              position: "insideLeft",
              offset: 8,
              style: axisLabelStyle("#a1a1aa"),
            }}
          />
          <YAxis
            yAxisId="drawdown"
            orientation="right"
            tick={{ fill: "#fb7185", fontSize: 11 }}
            width={48}
            tickFormatter={(v) => `${Number(v).toFixed(0)}%`}
            tickCount={6}
            label={{
              value: "DD (%)",
              angle: 90,
              position: "insideRight",
              offset: 4,
              style: axisLabelStyle("#fb7185"),
            }}
          />
          <Tooltip content={<StrategyTooltip />} />
          <Area yAxisId="drawdown" type="monotone" dataKey="drawdown" name="Drawdown (%)" fill="rgba(244,63,94,0.18)" stroke="#fb7185" />
          <Line yAxisId="equity" type="monotone" dataKey="equity" name="Equity ($)" stroke="#22c55e" strokeWidth={2.5} dot={false} />
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  );
}

function BacktestMetrics({ result }: { result: BacktestResult }) {
  const { metrics } = result;

  return (
    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
      <MetricCard label="Trades" value={String(metrics.totalTrades)} />
      <MetricCard label="Win rate" value={formatPercent(metrics.winRate)} tone="text-emerald-300" />
      <MetricCard
        label="Profit factor"
        value={Number.isFinite(metrics.profitFactor) ? metrics.profitFactor.toFixed(2) : "∞"}
        tone="text-cyan-100"
      />
      <MetricCard label="Max drawdown" value={formatPercent(metrics.maxDrawdown)} tone="text-rose-300" />
      <MetricCard label="Net P&L" value={formatValue(metrics.netPnl, "currency")} tone={metrics.netPnl >= 0 ? "text-emerald-300" : "text-rose-300"} />
      <MetricCard label="Return" value={formatPercent(metrics.returnPercent)} tone={metrics.returnPercent >= 0 ? "text-emerald-300" : "text-rose-300"} />
      <MetricCard label="Expectancy" value={formatValue(metrics.expectancy, "currency")} />
      <MetricCard label="Gross loss" value={formatValue(metrics.grossLoss, "currency")} tone="text-rose-200" />
    </div>
  );
}

function exportSignals(signals: StrategySignal[], tickerSymbol: string) {
  const header = [
    "ticker",
    "timestamp",
    "direction",
    "entry",
    "stop_loss",
    "take_profit",
    "level",
    "delta_confirmation",
    "bounce_strength",
    "reason",
  ];
  const rows = signals.map((signal) => [
    tickerSymbol,
    new Date(signal.timestamp).toISOString(),
    signal.direction,
    signal.entry,
    signal.stopLoss,
    signal.takeProfit,
    signal.level,
    signal.deltaConfirmation,
    signal.bounceStrength,
    signal.reason,
  ]);
  const csv = [header, ...rows].map((row) => row.map((cell) => `"${String(cell).replaceAll("\"", "\"\"")}"`).join(",")).join("\n");
  const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
  const link = document.createElement("a");
  link.href = url;
  link.download = `${tickerSymbol.replace(/[^a-z0-9.-]+/gi, "-").toLowerCase()}-order-flow-signals.csv`;
  link.click();
  URL.revokeObjectURL(url);
}

function TickerSelector({
  selectedTickerId,
  customWatchlist,
  onChange,
}: {
  selectedTickerId: string;
  customWatchlist: WatchlistItem[];
  onChange: (tickerId: string) => void;
}) {
  return (
    <label className="grid gap-2 rounded-2xl border border-white/10 bg-black/25 p-3">
      <span className="text-xs font-black uppercase tracking-[0.14em] text-zinc-500">Ticker</span>
      <select
        value={selectedTickerId}
        onChange={(event) => onChange(event.target.value)}
        className="h-11 rounded-2xl border border-white/10 bg-zinc-950 px-3 text-sm font-black text-white outline-none transition focus:border-cyan-300/60"
      >
        {customWatchlist.length ? (
          <optgroup label="Your Watchlist">
            {customWatchlist.map((item) => (
              <option key={item.id} value={item.id}>
                {item.label} ({item.yahooSymbol})
              </option>
            ))}
          </optgroup>
        ) : null}
        <optgroup label="Crypto">
          {CRYPTO_WATCHLIST.map((item) => (
            <option key={item.id} value={item.id}>
              {item.label} ({item.yahooSymbol})
            </option>
          ))}
        </optgroup>
        <optgroup label="US Stocks">
          {STOCK_WATCHLIST.map((item) => (
            <option key={item.id} value={item.id}>
              {item.label} ({item.yahooSymbol})
            </option>
          ))}
        </optgroup>
      </select>
    </label>
  );
}

function ActiveTickerBanner({
  item,
  marketPayload,
  dataSource,
}: {
  item: WatchlistItem;
  marketPayload: MarketOHLCVPayload | null;
  dataSource: "market" | "csv";
}) {
  return (
    <div className="rounded-3xl border border-cyan-300/20 bg-cyan-300/10 p-4">
      <div className="flex flex-wrap items-center gap-2">
        <Badge tone={item.assetClass === "crypto" ? "blue" : "neutral"}>
          {item.assetClass === "crypto" ? "Crypto" : "US Stock"}
        </Badge>
        <Badge tone="gold">{dataSource === "csv" ? "Custom CSV" : "Yahoo Finance"}</Badge>
      </div>
      <div className="mt-3 flex flex-wrap items-end gap-4">
        <div>
          <div className="text-xs font-bold uppercase tracking-[0.18em] text-zinc-500">Active ticker</div>
          <div className="mt-1 text-2xl font-black text-white">{item.label}</div>
        </div>
        <div>
          <div className="text-xs font-bold uppercase tracking-[0.18em] text-zinc-500">Symbol</div>
          <div className="mt-1 font-mono text-lg font-black text-cyan-100">{item.yahooSymbol}</div>
        </div>
        {marketPayload ? (
          <div>
            <div className="text-xs font-bold uppercase tracking-[0.18em] text-zinc-500">Last price</div>
            <div className="mt-1 font-mono text-lg font-black text-white">
              {formatValue(marketPayload.price, item.assetClass === "crypto" ? "number" : "currency")}
            </div>
          </div>
        ) : null}
      </div>
      <p className="mt-3 text-sm text-cyan-50/75">
        Bar delta, CVD, and divergence markers below are computed for{" "}
        <span className="font-black text-white">{item.yahooSymbol}</span>
        {marketPayload
          ? ` · ${marketPayload.interval} bars · ${marketPayload.range} lookback`
          : ""}
        .
      </p>
    </div>
  );
}

export function OrderFlowBacktester() {
  const { items: customWatchlist } = useCustomWatchlist();
  const [selectedTickerId, setSelectedTickerId] = useState(DEFAULT_TICKER_ID);
  const [bars, setBars] = useState<OHLCVBar[]>([]);
  const [params, setParams] = useState<StrategyParams>(DEFAULT_STRATEGY_PARAMS);
  const [activeTab, setActiveTab] = useState<ChartTab>("price");
  const [dataSource, setDataSource] = useState<"market" | "csv">("market");
  const [marketPayload, setMarketPayload] = useState<MarketOHLCVPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [showAllSignalsOnChart, setShowAllSignalsOnChart] = useState(false);
  const [selectedSignalIds, setSelectedSignalIds] = useState<string[]>([]);
  const [faqOpen, setFaqOpen] = useState(false);

  const allTickers = useMemo(
    () => [...customWatchlist, ...CRYPTO_WATCHLIST, ...STOCK_WATCHLIST],
    [customWatchlist],
  );

  const selectedTicker = useMemo(
    () => allTickers.find((item) => item.id === selectedTickerId) ?? CRYPTO_WATCHLIST[0],
    [allTickers, selectedTickerId],
  );

  const loadTicker = useCallback(async (tickerId: string) => {
    setLoading(true);
    setLoadError(null);

    try {
      const item = allTickers.find((entry) => entry.id === tickerId);
      const query = new URLSearchParams({
        range: STRATEGY_LAB_CHART_RANGE,
        interval: STRATEGY_LAB_CHART_INTERVAL,
      });

      if (item) {
        query.set("symbol", item.yahooSymbol);
      } else {
        query.set("id", tickerId);
      }

      const response = await fetch(`/api/market-data/ohlcv?${query.toString()}`, {
        cache: "no-store",
      });
      const payload: unknown = await response.json();

      if (!response.ok) {
        const message =
          payload && typeof payload === "object" && "error" in payload
            ? String((payload as { error: unknown }).error)
            : "Unable to load ticker OHLCV.";
        throw new Error(message);
      }

      const nextPayload = payload as MarketOHLCVPayload;
      setMarketPayload(nextPayload);
      setBars(nextPayload.bars);
      setDataSource("market");
      setUploadError(null);
    } catch (error) {
      setLoadError(error instanceof Error ? error.message : "Unable to load ticker OHLCV.");
    } finally {
      setLoading(false);
    }
  }, [allTickers]);

  useEffect(() => {
    if (dataSource === "csv") {
      return;
    }
    void loadTicker(selectedTickerId);
  }, [dataSource, loadTicker, selectedTickerId]);

  const enhancedBars = useMemo(() => enhanceOrderFlowBars(bars, params), [bars, params]);
  const signals = useMemo(() => generateEnhancedSignals(enhancedBars, params), [enhancedBars, params]);
  const visibleChartSignals = useMemo(() => {
    if (showAllSignalsOnChart) {
      return signals;
    }

    if (selectedSignalIds.length) {
      const selected = new Set(selectedSignalIds);
      return signals.filter((signal) => selected.has(signal.id));
    }

    return [];
  }, [selectedSignalIds, showAllSignalsOnChart, signals]);
  const result = useMemo(() => runBacktest(bars, signals, params), [bars, params, signals]);
  const chartData = useMemo(() => {
    // Map every signal onto its bar so green/red markers render across the full history
    // (not only the last 50 ReferenceDots on a fully zoomed-out 5d series).
    const signalByTimestamp = new Map<number, StrategySignal["direction"]>();
    for (const signal of signals) {
      signalByTimestamp.set(signal.timestamp, signal.direction);
    }

    return enhancedBars.map((bar) => ({
      time: formatDate(bar.timestamp),
      timestamp: bar.timestamp,
      close: bar.close,
      barDelta: bar.barDelta,
      cumulativeDelta: bar.cumulativeDelta,
      signalDirection: signalByTimestamp.get(bar.timestamp) ?? null,
    }));
  }, [enhancedBars, signals]);

  const divergenceBars = useMemo(
    () => enhancedBars.filter((bar: OrderFlowBar) => bar.deltaDivergence),
    [enhancedBars],
  );

  function toggleSignalSelection(signalId: string) {
    if (showAllSignalsOnChart) {
      setShowAllSignalsOnChart(false);
    }

    setSelectedSignalIds((current) =>
      current.includes(signalId) ? current.filter((id) => id !== signalId) : [...current, signalId],
    );
  }

  function handleShowAllSignalsChange(nextValue: boolean) {
    setShowAllSignalsOnChart(nextValue);
    if (nextValue) {
      setSelectedSignalIds([]);
    }
  }

  const handleFile = async (file: File | undefined) => {
    if (!file) {
      return;
    }

    const parsed = parseOHLCVCSV(await file.text());
    if (parsed.length < 20) {
      setUploadError("CSV must include at least 20 rows with timestamp/open/high/low/close/volume columns.");
      return;
    }

    setBars(parsed);
    setMarketPayload(null);
    setDataSource("csv");
    setUploadError(null);
  };

  const handleTickerChange = (tickerId: string) => {
    setSelectedTickerId(tickerId);
    setDataSource("market");
  };

  const tickerLabel = selectedTicker.yahooSymbol;

  return (
    <section className="grid gap-6">
      <OrderflowFaqModal open={faqOpen} onClose={() => setFaqOpen(false)} />
      <Card className="overflow-hidden border-fuchsia-300/20 bg-gradient-to-br from-fuchsia-400/10 via-cyan-400/10 to-slate-950">
        <CardHeader>
          <div className="flex flex-col gap-5 xl:flex-row xl:items-start xl:justify-between">
            <div>
              <Badge tone="gold">Strategy lab</Badge>
              <CardTitle className="mt-4 text-3xl font-bold sm:text-4xl">
                Bounce Momentum Exhaustion Backtester
              </CardTitle>
              <p className="mt-2 max-w-3xl text-sm text-zinc-400 sm:text-base">
                Pick a ticker, load Yahoo Finance OHLCV, approximate bar delta and CVD, build volume
                profiles (POC / VA / HVN / LVN / IB), detect support/resistance bounces, then simulate
                SL/TP trades.
              </p>
              <Button
                type="button"
                onClick={() => setFaqOpen(true)}
                className="mt-3 bg-white/5 text-xs text-zinc-100"
              >
                FAQ and diagrams
              </Button>
            </div>
            <div className="grid gap-3 rounded-3xl border border-white/10 bg-black/30 p-3 sm:grid-cols-2">
              <MetricCard label="Active ticker" value={tickerLabel} tone="text-cyan-100" />
              <MetricCard label="Signals" value={String(signals.length)} tone="text-emerald-200" />
            </div>
          </div>
        </CardHeader>
        <CardContent className="grid gap-4">
          <ActiveTickerBanner item={selectedTicker} marketPayload={marketPayload} dataSource={dataSource} />

          {loadError ? <div className="text-sm text-rose-200">{loadError}</div> : null}

          <div className="grid gap-8">
            <div className="grid gap-4 lg:grid-cols-2">
              <Card className="border-white/10 bg-black/35">
                <CardHeader>
                  <div className="flex items-center justify-between gap-3">
                    <CardTitle>Data Input</CardTitle>
                    <Button
                      type="button"
                      disabled={loading || dataSource === "csv"}
                      onClick={() => void loadTicker(selectedTickerId)}
                      className="px-3 py-2 text-xs"
                    >
                      {loading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCcw className="h-3.5 w-3.5" />}
                      Refresh
                    </Button>
                  </div>
                </CardHeader>
                <CardContent className="grid gap-3">
                  <TickerSearchPanel
                    selectedId={selectedTickerId}
                    onSelect={(id) => handleTickerChange(id)}
                  />
                  <TickerSelector
                    selectedTickerId={selectedTickerId}
                    customWatchlist={customWatchlist}
                    onChange={handleTickerChange}
                  />
                  <label className="grid cursor-pointer gap-3 rounded-3xl border border-dashed border-cyan-300/25 bg-cyan-300/10 p-5 text-center transition hover:border-cyan-300/50">
                    <FileUp className="mx-auto h-8 w-8 text-cyan-100" />
                    <span className="text-sm font-black text-white">Upload OHLCV CSV</span>
                    <span className="text-xs text-zinc-400">Overrides ticker feed · timestamp, open, high, low, close, volume</span>
                    <Input
                      type="file"
                      accept=".csv,text/csv"
                      className="hidden"
                      onChange={(event) => void handleFile(event.target.files?.[0])}
                    />
                  </label>
                  <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-3 text-sm text-zinc-300">
                    Bars loaded: <span className="font-black text-cyan-100">{bars.length}</span>
                    {dataSource === "csv" ? " from uploaded CSV" : ` for ${selectedTicker.yahooSymbol}`}
                  </div>
                  {uploadError ? <div className="text-sm text-rose-200">{uploadError}</div> : null}
                </CardContent>
              </Card>
              <StrategyControls
                params={params}
                onChange={setParams}
                onReset={() => setParams(DEFAULT_STRATEGY_PARAMS)}
              />
            </div>

            <BacktestMetrics result={result} />

            <Card className="w-full overflow-hidden border-white/10 bg-black/35">
              <CardHeader>
                <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                  <div>
                    <CardTitle>
                      {activeTab === "price"
                        ? `${tickerLabel} · Price + Delta`
                        : activeTab === "cvd"
                          ? `${tickerLabel} · CVD`
                          : activeTab === "profile"
                            ? `${tickerLabel} · Volume Profile`
                            : activeTab === "footprint"
                              ? `${tickerLabel} · Footprint / Bookmap`
                              : activeTab === "bouncyball"
                                ? `${tickerLabel} · Bouncy Ball Strategy`
                                : activeTab === "tradingview"
                                  ? `${tickerLabel} · Multi-Timeframe TradingView`
                                  : "Backtest Equity"}
                    </CardTitle>
                    <p className="mt-2 text-sm leading-relaxed text-zinc-400">
                      {activeTab === "bouncyball" ? (
                        <>
                          1-minute candlestick overlay for <span className="font-semibold text-white">{tickerLabel}</span> with
                          bounce touches, CVD divergences, entries, and SL/TP from your strategy engine.
                        </>
                      ) : activeTab === "tradingview" ? (
                        <>
                          Compare <span className="font-semibold text-white">{tickerLabel}</span> across 5m, 15m,
                          1H, 4H, and daily. Strategy markers live on the{" "}
                          <span className="font-semibold text-white">Bouncy Ball</span> tab. The free TradingView
                          embed cannot draw custom signals.
                        </>
                      ) : activeTab === "profile" ? (
                        <>
                          Auction Market Theory levels from OHLCV volume distribution: developing or fixed
                          range profiles, value area, nodes, and initial balance. Open the FAQ for diagrams.
                        </>
                      ) : activeTab === "footprint" ? (
                        <>
                          <span className="font-semibold text-white">Dense heat trails</span> + footprint +{" "}
                          <span className="font-semibold text-white">aggression bubbles</span> for{" "}
                          <span className="font-semibold text-white">{tickerLabel}</span>. Gold rings = whale
                          prints.{" "}
                          <span className="font-semibold text-amber-200">TB diamonds</span> = trapped buyside;{" "}
                          <span className="font-semibold text-violet-200">TS diamonds</span> = trapped
                          sellside (failed aggression / reverse). Open{" "}
                          <span className="font-semibold text-white">Legend & FAQ</span> for diagrams and
                          worked examples. Proxy from OHLCV — not exchange tape.
                        </>
                      ) : activeTab === "price" ? (
                        <>
                          <span className="font-semibold text-white">Price + Delta</span> overlays two series:
                          the white line is <span className="font-semibold text-white">close price ($)</span>;
                          the bars are <span className="font-semibold text-white">bar delta</span> (proxy volume
                          units on the right axis). It answers: “did this bar close like buyers or sellers won,
                          and how hard?” — not true bid/ask tape.
                          <span className="font-semibold text-emerald-300"> Green</span> /{" "}
                          <span className="font-semibold text-rose-300">red</span> dots = long/short strategy
                          entries. Zoom 30m–All or drag the brush to pan.
                          <FormulaNote>
                            <p className="font-semibold text-zinc-200">What bar delta means</p>
                            <p>
                              Each bar gets a signed volume estimate.{" "}
                              <span className="text-emerald-300">Positive</span> (bars above the zero line) ≈
                              up-close / bullish conviction that bar.{" "}
                              <span className="text-rose-300">Negative</span> (bars below zero) ≈ down-close /
                              bearish conviction. Zero line is drawn on the right axis — hover a bar for the signed
                              number (e.g. −1.2K vol).
                            </p>
                            <p className="font-semibold text-zinc-200">Formula (proxy, from OHLCV)</p>
                            <FormulaCode>
                              {`direction = sign(close − prevClose)   // or close − midpoint
// fallback: sign(close − open) if direction is 0
conviction = clamp(|close − open| / (high − low), 0.15, 1)
barDelta   = volume × conviction × direction`}
                            </FormulaCode>
                            <p>
                              Implication: large +delta on an up bar = volume “supporting” the push up under this
                              proxy. Large −delta on a down bar = volume supporting the selloff. Delta is{" "}
                              <span className="text-white">not dollars</span> and{" "}
                              <span className="text-white">not true aggressive buy/sell size</span> — only an
                              OHLCV estimate.
                            </p>
                          </FormulaNote>
                        </>
                      ) : activeTab === "cvd" ? (
                        <>
                          <span className="font-semibold text-white">CVD</span> (Cumulative Volume Delta) for{" "}
                          <span className="font-semibold text-white">{tickerLabel}</span> is the running sum of
                          every bar’s proxy delta. Units = volume (not $). Same zoom/brush; green/red dots are
                          strategy entries plotted at that bar’s CVD level.
                          <FormulaNote>
                            <p className="font-semibold text-zinc-200">Formulas</p>
                            <FormulaCode>
                              {`// same barDelta as Price + Delta tab
barDelta_t = volume_t × conviction_t × direction_t

CVD_0 = barDelta_0
CVD_t = CVD_(t−1) + barDelta_t
      = Σ barDelta_i   for i = 0…t`}
                            </FormulaCode>
                            <p className="font-semibold text-zinc-200">How to read the slope</p>
                            <p>
                              <span className="text-white">Rising CVD</span> ≈ net{" "}
                              <span className="text-emerald-300">buying pressure building</span> over the window
                              (more proxy “buy” volume than “sell” volume in the cumulative sum).{" "}
                              <span className="text-white">Falling CVD</span> ≈ net selling pressure. That is{" "}
                              <span className="text-white">not</span> a live count of people in the market — it is
                              our OHLCV stand-in for whether closes have been more buy-like or sell-like weighted
                              by volume.
                            </p>
                            <p>
                              Absolute CVD level can stay positive for a long time after early buying; what
                              matters more is <span className="text-white">direction of the line</span> and
                              whether it confirms or diverges from price highs/lows.
                            </p>
                          </FormulaNote>
                        </>
                      ) : activeTab === "equity" ? (
                        <>
                          Simulated equity curve in <span className="font-semibold text-white">USD</span> with
                          drawdown on the right axis (% of peak).
                        </>
                      ) : (
                        <>
                          CVD divergence on <span className="font-semibold text-white">{tickerLabel}</span> means
                          price makes a fresh extreme while cumulative delta fails to confirm the move.
                        </>
                      )}
                    </p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {chartTabs.map((tab) => (
                      <Button
                        key={tab.id}
                        type="button"
                        onClick={() => setActiveTab(tab.id)}
                        className={cn("px-3 py-2 text-xs", activeTab === tab.id && "border-cyan-300/60 bg-cyan-300/15")}
                      >
                        {tab.label}
                      </Button>
                    ))}
                  </div>
                </div>
              </CardHeader>
              <CardContent className="px-4 pb-6 sm:px-6">
                <div className="w-full rounded-3xl border border-white/10 bg-zinc-950/70 p-2 sm:p-3">
                  {activeTab === "tradingview" ? (
                    <TradingViewMultiTimeframe
                      symbol={selectedTicker.tradingViewSymbol}
                      tickerLabel={tickerLabel}
                    />
                  ) : activeTab === "bouncyball" ? (
                    <BouncyBallStrategyChart
                      bars={enhancedBars}
                      signals={signals}
                      visibleSignals={visibleChartSignals}
                      showAllSignals={showAllSignalsOnChart}
                      onShowAllSignalsChange={handleShowAllSignalsChange}
                      tickerLabel={tickerLabel}
                    />
                  ) : loading && !bars.length ? (
                    <div className="flex min-h-[560px] items-center justify-center gap-3 text-sm text-zinc-400">
                      <Loader2 className="h-5 w-5 animate-spin text-cyan-200" />
                      Loading {selectedTicker.yahooSymbol} OHLCV...
                    </div>
                  ) : activeTab === "price" ? (
                    <PriceDeltaChart chartData={chartData} signals={signals} tickerLabel={tickerLabel} />
                  ) : activeTab === "cvd" ? (
                    <CvdChart chartData={chartData} tickerLabel={tickerLabel} />
                  ) : activeTab === "profile" ? (
                    <VolumeProfilePanel bars={bars} onOpenFaq={() => setFaqOpen(true)} />
                  ) : activeTab === "footprint" ? (
                    <FootprintBookmapChart
                      bars={bars}
                      tickerLabel={tickerLabel}
                      onOpenFaq={() => setFaqOpen(true)}
                    />
                  ) : (
                    <EquityChart result={result} />
                  )}
                </div>
              </CardContent>
            </Card>
          </div>

          <div className="grid gap-4 xl:grid-cols-[1fr_0.72fr]">
            <Card className="border-white/10 bg-black/35">
              <CardHeader>
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <CardTitle>Recent Signals</CardTitle>
                    {activeTab === "bouncyball" && !showAllSignalsOnChart ? (
                      <p className="mt-1 text-xs text-zinc-500">
                        Click rows to show selected entry, SL, and TP on the Bouncy Ball chart.
                      </p>
                    ) : null}
                  </div>
                  <Button
                    type="button"
                    disabled={!signals.length}
                    onClick={() => exportSignals(signals, tickerLabel)}
                    className="bg-emerald-400/15 text-emerald-100 hover:bg-emerald-400/25"
                  >
                    <Download className="h-4 w-4" />
                    Export Signals
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                <div className="overflow-x-auto rounded-3xl border border-white/10">
                  <table className="w-full min-w-[780px] text-left text-sm">
                    <thead className="bg-white/[0.05] text-[10px] font-black uppercase tracking-[0.16em] text-zinc-500">
                      <tr>
                        <th className="px-4 py-3">Ticker</th>
                        <th className="px-4 py-3">Time</th>
                        <th className="px-4 py-3">Side</th>
                        <th className="px-4 py-3">Entry</th>
                        <th className="px-4 py-3">SL</th>
                        <th className="px-4 py-3">TP</th>
                        <th className="px-4 py-3">Delta</th>
                        <th className="px-4 py-3">Reason</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-white/[0.05]">
                      {signals.slice(-8).reverse().map((signal) => {
                        const isSelected = selectedSignalIds.includes(signal.id);

                        return (
                          <tr
                            key={signal.id}
                            onClick={() => toggleSignalSelection(signal.id)}
                            className={
                              activeTab === "bouncyball"
                                ? `cursor-pointer transition-colors hover:bg-white/[0.04] ${
                                    isSelected ? "bg-cyan-400/10 ring-1 ring-inset ring-cyan-300/30" : ""
                                  }`
                                : undefined
                            }
                          >
                          <td className="px-4 py-3 font-mono text-xs font-black text-cyan-100">{tickerLabel}</td>
                          <td className="px-4 py-3 font-mono text-xs text-zinc-400">{formatDate(signal.timestamp)}</td>
                          <td className="px-4 py-3">
                            <Badge tone={signal.direction === "long" ? "win" : "loss"}>{signal.direction}</Badge>
                          </td>
                          <td className="px-4 py-3 font-mono text-zinc-200">{formatValue(signal.entry)}</td>
                          <td className="px-4 py-3 font-mono text-rose-200">{formatValue(signal.stopLoss)}</td>
                          <td className="px-4 py-3 font-mono text-emerald-200">{formatValue(signal.takeProfit)}</td>
                          <td className="px-4 py-3 font-mono text-cyan-100">{signal.deltaConfirmation.toFixed(2)}</td>
                          <td className="px-4 py-3 text-zinc-400">{signal.reason}</td>
                        </tr>
                        );
                      })}
                      {!signals.length ? (
                        <tr>
                          <td colSpan={8} className="px-4 py-10 text-center text-zinc-500">
                            No setups with the current parameters.
                          </td>
                        </tr>
                      ) : null}
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>

            <div className="grid gap-4">
              <Card className="border-cyan-300/20 bg-cyan-300/10">
                <CardContent className="flex gap-3 text-sm text-cyan-50">
                  <Sigma className="mt-0.5 h-5 w-5 shrink-0" />
                  <div>
                    <div className="font-black">Order-flow approximation</div>
                    <p className="mt-1 text-cyan-50/75">
                      Without true bid/ask tape, bar delta is estimated from candle direction,
                      range conviction, and volume. Use this for research scaffolding, not execution.
                    </p>
                  </div>
                </CardContent>
              </Card>
              <Card className="border-white/10 bg-black/35">
                <CardHeader>
                  <CardTitle>Detection Stats</CardTitle>
                </CardHeader>
                <CardContent className="grid gap-3">
                  <MetricCard
                    label={`CVD divergences (${tickerLabel})`}
                    value={String(divergenceBars.length)}
                    tone="text-fuchsia-200"
                  />
                  {divergenceBars.slice(-4).reverse().map((bar) => (
                    <div key={`${bar.timestamp}-${bar.deltaDivergence}`} className="rounded-2xl border border-white/10 bg-white/[0.04] px-3 py-2 text-xs">
                      <div className="flex items-center justify-between gap-3">
                        <span className="font-black text-white">{tickerLabel}</span>
                        <Badge tone={bar.deltaDivergence === "bullish" ? "win" : "loss"}>
                          {bar.deltaDivergence}
                        </Badge>
                      </div>
                      <div className="mt-1 font-mono text-zinc-400">{formatDate(bar.timestamp)}</div>
                    </div>
                  ))}
                  {!divergenceBars.length ? (
                    <div className="text-sm text-zinc-500">No CVD divergences detected for {tickerLabel}.</div>
                  ) : null}
                  <MetricCard
                    label="Avg bounce strength"
                    value={formatValue(enhancedBars.reduce((sum, bar) => sum + bar.bounceStrength, 0) / Math.max(enhancedBars.length, 1))}
                  />
                  <MetricCard label="Starting equity" value={formatValue(params.startingEquity, "currency")} />
                </CardContent>
              </Card>
              <Card className="border-yellow-300/20 bg-yellow-300/10">
                <CardContent className="flex gap-3 text-sm text-yellow-50">
                  <Gauge className="mt-0.5 h-5 w-5 shrink-0" />
                  Runs entirely client-side and is intended as a fast visual lab. Add exchange-specific
                  fees, session filters, and real bid/ask delta before treating results as production research.
                </CardContent>
              </Card>
            </div>
          </div>
        </CardContent>
      </Card>
    </section>
  );
}
