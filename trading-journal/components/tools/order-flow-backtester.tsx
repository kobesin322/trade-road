"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
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
import { Download, FileUp, Gauge, Loader2, RefreshCcw, RotateCcw, Sigma } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { TradingViewMultiTimeframe } from "@/components/charts/trading-view-multi-timeframe";
import { BouncyBallStrategyChart } from "@/components/charts/bouncy-ball-strategy-chart";
import type { MarketOHLCVPayload } from "@/lib/market-data/yahoo-chart";
import {
  CRYPTO_WATCHLIST,
  STOCK_WATCHLIST,
  type WatchlistItem,
} from "@/lib/market-data/symbols";
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

type ChartTab = "price" | "cvd" | "bouncyball" | "tradingview" | "equity";

const chartTabs: Array<{ id: ChartTab; label: string }> = [
  { id: "price", label: "Price + Delta" },
  { id: "cvd", label: "CVD" },
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
  tickerLabel,
}: {
  chartData: ChartRow[];
  signals: StrategySignal[];
  tickerLabel: string;
}) {
  return (
    <ResponsiveContainer width="100%" height={560}>
      <ComposedChart data={chartData}>
        <CartesianGrid stroke="rgba(255,255,255,0.05)" vertical={false} />
        <XAxis dataKey="time" tick={{ fill: "#71717a", fontSize: 11 }} minTickGap={28} />
        <YAxis yAxisId="price" tick={{ fill: "#a1a1aa", fontSize: 11 }} domain={["dataMin", "dataMax"]} />
        <YAxis yAxisId="delta" orientation="right" tick={{ fill: "#71717a", fontSize: 11 }} />
        <Tooltip content={<StrategyTooltip />} />
        <Bar yAxisId="delta" dataKey="barDelta" name={`${tickerLabel} bar delta`} fill="rgba(34,211,238,0.28)" />
        <Line yAxisId="price" type="monotone" dataKey="close" name={`${tickerLabel} close`} stroke="#f8fafc" strokeWidth={2} dot={false} />
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

function CvdChart({ chartData, tickerLabel }: { chartData: ChartRow[]; tickerLabel: string }) {
  return (
    <ResponsiveContainer width="100%" height={560}>
      <LineChart data={chartData}>
        <CartesianGrid stroke="rgba(255,255,255,0.05)" vertical={false} />
        <XAxis dataKey="time" tick={{ fill: "#71717a", fontSize: 11 }} minTickGap={28} />
        <YAxis tick={{ fill: "#a1a1aa", fontSize: 11 }} />
        <Tooltip content={<StrategyTooltip />} />
        <Line type="monotone" dataKey="cumulativeDelta" name={`${tickerLabel} CVD`} stroke="#22d3ee" strokeWidth={2.5} dot={false} />
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
    <ResponsiveContainer width="100%" height={560}>
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
  onChange,
}: {
  selectedTickerId: string;
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
  const [selectedTickerId, setSelectedTickerId] = useState(DEFAULT_TICKER_ID);
  const [bars, setBars] = useState<OHLCVBar[]>([]);
  const [params, setParams] = useState<StrategyParams>(DEFAULT_STRATEGY_PARAMS);
  const [activeTab, setActiveTab] = useState<ChartTab>("price");
  const [dataSource, setDataSource] = useState<"market" | "csv">("market");
  const [marketPayload, setMarketPayload] = useState<MarketOHLCVPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);

  const selectedTicker = useMemo(
    () => [...CRYPTO_WATCHLIST, ...STOCK_WATCHLIST].find((item) => item.id === selectedTickerId) ?? CRYPTO_WATCHLIST[0],
    [selectedTickerId],
  );

  const loadTicker = useCallback(async (tickerId: string) => {
    setLoading(true);
    setLoadError(null);

    try {
      const response = await fetch(`/api/market-data/ohlcv?id=${encodeURIComponent(tickerId)}&range=5d&interval=15m`, {
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
  }, []);

  useEffect(() => {
    if (dataSource === "csv") {
      return;
    }
    void loadTicker(selectedTickerId);
  }, [dataSource, loadTicker, selectedTickerId]);

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

  const divergenceBars = useMemo(
    () => enhancedBars.filter((bar: OrderFlowBar) => bar.deltaDivergence),
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
      <Card className="overflow-hidden border-fuchsia-300/20 bg-gradient-to-br from-fuchsia-400/10 via-cyan-400/10 to-slate-950">
        <CardHeader>
          <div className="flex flex-col gap-5 xl:flex-row xl:items-start xl:justify-between">
            <div>
              <Badge tone="gold">Strategy lab</Badge>
              <CardTitle className="mt-4 text-3xl font-black sm:text-4xl">
                Bounce Momentum Exhaustion Backtester
              </CardTitle>
              <p className="mt-2 max-w-3xl text-sm text-zinc-400 sm:text-base">
                Pick a ticker, load Yahoo Finance OHLCV, approximate bar delta and CVD, detect
                support/resistance bounces with delta confirmation, then simulate SL/TP trades.
              </p>
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
                  <TickerSelector selectedTickerId={selectedTickerId} onChange={handleTickerChange} />
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
                          : activeTab === "bouncyball"
                            ? `${tickerLabel} · Bouncy Ball Strategy`
                            : activeTab === "tradingview"
                              ? `${tickerLabel} · Multi-Timeframe TradingView`
                              : "Backtest Equity"}
                    </CardTitle>
                    <p className="mt-2 text-sm leading-relaxed text-zinc-400">
                      {activeTab === "bouncyball" ? (
                        <>
                          Candlestick overlay for <span className="font-black text-white">{tickerLabel}</span> with
                          bounce touches, CVD divergences, entries, and SL/TP from your strategy engine.
                        </>
                      ) : activeTab === "tradingview" ? (
                        <>
                          Compare <span className="font-black text-white">{tickerLabel}</span> across 5m, 15m,
                          1H, 4H, and daily. Strategy markers live on the{" "}
                          <span className="font-black text-white">Bouncy Ball</span> tab — the free TradingView
                          embed cannot draw custom signals.
                        </>
                      ) : (
                        <>
                          CVD divergence on <span className="font-black text-white">{tickerLabel}</span> means
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
                    <BouncyBallStrategyChart bars={enhancedBars} signals={signals} tickerLabel={tickerLabel} />
                  ) : loading && !bars.length ? (
                    <div className="flex min-h-[560px] items-center justify-center gap-3 text-sm text-zinc-400">
                      <Loader2 className="h-5 w-5 animate-spin text-cyan-200" />
                      Loading {selectedTicker.yahooSymbol} OHLCV...
                    </div>
                  ) : activeTab === "price" ? (
                    <PriceDeltaChart chartData={chartData} signals={signals} tickerLabel={tickerLabel} />
                  ) : activeTab === "cvd" ? (
                    <CvdChart chartData={chartData} tickerLabel={tickerLabel} />
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
                  <CardTitle>Recent Signals</CardTitle>
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
                      {signals.slice(-8).reverse().map((signal) => (
                        <tr key={signal.id}>
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
                      ))}
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
