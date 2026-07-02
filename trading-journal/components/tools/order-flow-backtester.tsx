"use client";

import { useMemo, useState } from "react";
import {
  Area,
  Bar,
  CartesianGrid,
  ComposedChart,
  Line,
  LineChart,
  ReferenceDot,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { Download, FileUp, Gauge, RotateCcw, Sigma } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  createSampleBars,
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

type ChartTab = "price" | "cvd" | "equity";

type ChartRow = {
  time: string;
  timestamp: number;
  close: number;
  barDelta: number;
  cumulativeDelta: number;
  equity?: number;
  drawdown?: number;
};

type TooltipPayload = {
  name?: string;
  value?: number;
  dataKey?: string | number;
  payload?: ChartRow;
};

const numberFormatter = new Intl.NumberFormat("en-US", {
  maximumFractionDigits: 2,
});

const currencyFormatter = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  maximumFractionDigits: 2,
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
            <span className="font-mono text-cyan-100">{formatValue(Number(item.value ?? 0))}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function PriceDeltaChart({
  chartData,
  signals,
}: {
  chartData: ChartRow[];
  signals: StrategySignal[];
}) {
  return (
    <ResponsiveContainer width="100%" height={430}>
      <ComposedChart data={chartData}>
        <CartesianGrid stroke="rgba(255,255,255,0.05)" vertical={false} />
        <XAxis dataKey="time" tick={{ fill: "#71717a", fontSize: 11 }} minTickGap={28} />
        <YAxis yAxisId="price" tick={{ fill: "#a1a1aa", fontSize: 11 }} domain={["dataMin", "dataMax"]} />
        <YAxis yAxisId="delta" orientation="right" tick={{ fill: "#71717a", fontSize: 11 }} />
        <Tooltip content={<StrategyTooltip />} />
        <Bar yAxisId="delta" dataKey="barDelta" name="Bar delta" fill="rgba(34,211,238,0.28)" />
        <Line yAxisId="price" type="monotone" dataKey="close" name="Close" stroke="#f8fafc" strokeWidth={2} dot={false} />
        {signals.slice(-50).map((signal) => (
          <ReferenceDot
            key={signal.id}
            yAxisId="price"
            x={formatDate(signal.timestamp)}
            y={signal.entry}
            r={5}
            fill={signal.direction === "long" ? "#22c55e" : "#fb7185"}
            stroke="rgba(255,255,255,0.9)"
          />
        ))}
      </ComposedChart>
    </ResponsiveContainer>
  );
}

function CvdChart({ chartData }: { chartData: ChartRow[] }) {
  return (
    <ResponsiveContainer width="100%" height={430}>
      <LineChart data={chartData}>
        <CartesianGrid stroke="rgba(255,255,255,0.05)" vertical={false} />
        <XAxis dataKey="time" tick={{ fill: "#71717a", fontSize: 11 }} minTickGap={28} />
        <YAxis tick={{ fill: "#a1a1aa", fontSize: 11 }} />
        <Tooltip content={<StrategyTooltip />} />
        <Line type="monotone" dataKey="cumulativeDelta" name="CVD" stroke="#22d3ee" strokeWidth={2.5} dot={false} />
      </LineChart>
    </ResponsiveContainer>
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
    <ResponsiveContainer width="100%" height={430}>
      <ComposedChart data={equityData}>
        <CartesianGrid stroke="rgba(255,255,255,0.05)" vertical={false} />
        <XAxis dataKey="time" tick={{ fill: "#71717a", fontSize: 11 }} minTickGap={28} />
        <YAxis yAxisId="equity" tick={{ fill: "#a1a1aa", fontSize: 11 }} />
        <YAxis yAxisId="drawdown" orientation="right" tick={{ fill: "#fb7185", fontSize: 11 }} />
        <Tooltip content={<StrategyTooltip />} />
        <Area yAxisId="drawdown" type="monotone" dataKey="drawdown" name="Drawdown %" fill="rgba(244,63,94,0.18)" stroke="#fb7185" />
        <Line yAxisId="equity" type="monotone" dataKey="equity" name="Equity" stroke="#22c55e" strokeWidth={2.5} dot={false} />
      </ComposedChart>
    </ResponsiveContainer>
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

function exportSignals(signals: StrategySignal[]) {
  const header = [
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
  link.download = "order-flow-signals.csv";
  link.click();
  URL.revokeObjectURL(url);
}

export function OrderFlowBacktester() {
  const [bars, setBars] = useState<OHLCVBar[]>(() => createSampleBars());
  const [params, setParams] = useState<StrategyParams>(DEFAULT_STRATEGY_PARAMS);
  const [activeTab, setActiveTab] = useState<ChartTab>("price");
  const [dataLabel, setDataLabel] = useState("Sample 15m OHLCV");
  const [uploadError, setUploadError] = useState<string | null>(null);

  const enhancedBars = useMemo(() => enhanceOrderFlowBars(bars, params), [bars, params]);
  const signals = useMemo(() => generateEnhancedSignals(enhancedBars, params), [enhancedBars, params]);
  const result = useMemo(() => runBacktest(bars, signals, params), [bars, params, signals]);
  const chartData = useMemo(
    () =>
      enhancedBars.map((bar) => ({
        time: formatDate(bar.timestamp),
        timestamp: bar.timestamp,
        close: bar.close,
        barDelta: bar.barDelta,
        cumulativeDelta: bar.cumulativeDelta,
      })),
    [enhancedBars],
  );

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
    setDataLabel(file.name);
    setUploadError(null);
  };

  const divergenceCount = enhancedBars.filter((bar: OrderFlowBar) => bar.deltaDivergence).length;

  return (
    <section className="grid gap-6">
      <Card className="overflow-hidden border-fuchsia-300/20 bg-gradient-to-br from-fuchsia-400/10 via-cyan-400/10 to-slate-950">
        <CardHeader>
          <div className="flex flex-col gap-5 xl:flex-row xl:items-start xl:justify-between">
            <div>
              <Badge tone="gold">Strategy lab</Badge>
              <CardTitle className="mt-4 text-3xl font-black sm:text-4xl">
                Bounce Momentum Exhaustion Backtester
              </CardTitle>
              <p className="mt-2 max-w-3xl text-sm text-zinc-400 sm:text-base">
                Upload OHLCV data, approximate bar delta and CVD, detect support/resistance
                bounces with delta confirmation, then simulate SL/TP trades in the browser.
              </p>
            </div>
            <div className="grid gap-3 rounded-3xl border border-white/10 bg-black/30 p-3 sm:grid-cols-2">
              <MetricCard label="Bars loaded" value={String(bars.length)} />
              <MetricCard label="Signals" value={String(signals.length)} tone="text-cyan-100" />
            </div>
          </div>
        </CardHeader>
        <CardContent className="grid gap-4">
          <div className="grid gap-4 xl:grid-cols-[0.78fr_1.5fr]">
            <div className="grid gap-4">
              <Card className="border-white/10 bg-black/35">
                <CardHeader>
                  <CardTitle>Data Input</CardTitle>
                </CardHeader>
                <CardContent className="grid gap-3">
                  <label className="grid cursor-pointer gap-3 rounded-3xl border border-dashed border-cyan-300/25 bg-cyan-300/10 p-5 text-center transition hover:border-cyan-300/50">
                    <FileUp className="mx-auto h-8 w-8 text-cyan-100" />
                    <span className="text-sm font-black text-white">Upload OHLCV CSV</span>
                    <span className="text-xs text-zinc-400">Headers: timestamp, open, high, low, close, volume</span>
                    <Input
                      type="file"
                      accept=".csv,text/csv"
                      className="hidden"
                      onChange={(event) => void handleFile(event.target.files?.[0])}
                    />
                  </label>
                  <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-3 text-sm text-zinc-300">
                    Active dataset: <span className="font-black text-cyan-100">{dataLabel}</span>
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

            <div className="grid gap-4">
              <BacktestMetrics result={result} />

              <Card className="overflow-hidden border-white/10 bg-black/35">
                <CardHeader>
                  <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                    <div>
                      <CardTitle>Visualization</CardTitle>
                      <p className="mt-1 text-sm text-zinc-400">
                        CVD divergence means price makes a fresh extreme while cumulative delta fails
                        to confirm the move.
                      </p>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {(["price", "cvd", "equity"] as const).map((tab) => (
                        <Button
                          key={tab}
                          type="button"
                          onClick={() => setActiveTab(tab)}
                          className={cn("px-3 py-2 text-xs", activeTab === tab && "border-cyan-300/60 bg-cyan-300/15")}
                        >
                          {tab === "price" ? "Price + Delta" : tab === "cvd" ? "CVD" : "Equity"}
                        </Button>
                      ))}
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="rounded-3xl border border-white/10 bg-zinc-950/70 p-3">
                    {activeTab === "price" ? (
                      <PriceDeltaChart chartData={chartData} signals={signals} />
                    ) : activeTab === "cvd" ? (
                      <CvdChart chartData={chartData} />
                    ) : (
                      <EquityChart result={result} />
                    )}
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>

          <div className="grid gap-4 xl:grid-cols-[1fr_0.72fr]">
            <Card className="border-white/10 bg-black/35">
              <CardHeader>
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <CardTitle>Recent Signals</CardTitle>
                  <Button
                    type="button"
                    disabled={!signals.length}
                    onClick={() => exportSignals(signals)}
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
                      {signals.slice(-8).reverse().map((signal) => (
                        <tr key={signal.id}>
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
                      ))}
                      {!signals.length ? (
                        <tr>
                          <td colSpan={7} className="px-4 py-10 text-center text-zinc-500">
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
                  <MetricCard label="CVD divergences" value={String(divergenceCount)} tone="text-fuchsia-200" />
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
