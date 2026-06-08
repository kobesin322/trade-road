"use client";

import { format } from "date-fns";
import { LineChart, Loader2, RefreshCcw, TrendingDown, TrendingUp } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  CartesianGrid,
  Line,
  LineChart as RechartsLineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import { TradingViewEmbed } from "@/components/charts/trading-view-embed";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  CRYPTO_WATCHLIST,
  STOCK_WATCHLIST,
  type WatchlistItem,
} from "@/lib/market-data/symbols";
import type { MarketChartPayload } from "@/lib/market-data/yahoo-chart";
import { cn } from "@/lib/utils";

type MarketChartsViewProps = {
  chartsReady: boolean;
};

function formatMarketPrice(value: number, assetClass: WatchlistItem["assetClass"]) {
  const fractionDigits =
    assetClass === "crypto" && value < 100 ? 4 : value >= 1000 ? 2 : 2;

  return value.toLocaleString("en-US", {
    minimumFractionDigits: fractionDigits,
    maximumFractionDigits: fractionDigits,
  });
}

function formatSignedChange(value: number | null) {
  if (value === null || !Number.isFinite(value)) {
    return "--";
  }

  const sign = value >= 0 ? "+" : "";
  return `${sign}${value.toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

function formatSignedPercent(value: number | null) {
  if (value === null || !Number.isFinite(value)) {
    return "--";
  }

  const sign = value >= 0 ? "+" : "";
  return `${sign}${value.toFixed(2)}%`;
}

function MarketTooltip({
  active,
  payload,
  label,
  assetClass,
}: {
  active?: boolean;
  payload?: { value?: number }[];
  label?: string;
  assetClass: WatchlistItem["assetClass"];
}) {
  if (!active || !payload?.length) {
    return null;
  }

  const value = Number(payload[0]?.value ?? 0);
  const timeLabel = label ? format(new Date(label), "MMM d, HH:mm") : "";

  return (
    <div className="rounded-2xl border border-white/10 bg-zinc-950/95 px-3 py-2 text-xs text-zinc-200 shadow-2xl">
      <div className="font-semibold text-white">{timeLabel}</div>
      <div className="mt-1 font-mono text-cyan-100">${formatMarketPrice(value, assetClass)}</div>
    </div>
  );
}

function MarketChartCard({
  chartsReady,
  item,
  payload,
  selected,
  onSelect,
}: {
  chartsReady: boolean;
  item: WatchlistItem;
  payload?: MarketChartPayload;
  selected: boolean;
  onSelect: () => void;
}) {
  const positive = (payload?.change ?? 0) >= 0;
  const chartData = useMemo(
    () =>
      payload?.points.map((point) => ({
        time: point.time,
        price: point.price,
      })) ?? [],
    [payload?.points],
  );

  return (
    <button
      type="button"
      onClick={onSelect}
      className={cn(
        "group rounded-[1.75rem] border border-white/10 bg-white/[0.04] p-4 text-left shadow-2xl shadow-black/20 transition hover:-translate-y-1 hover:border-cyan-300/50",
        selected && "border-cyan-300/60 bg-cyan-300/10",
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="text-xl font-black text-white">{item.yahooSymbol}</div>
          <div className="text-sm text-zinc-500">{item.label}</div>
        </div>
        <Badge tone={item.assetClass === "crypto" ? "blue" : "neutral"}>
          {item.assetClass === "crypto" ? "Crypto" : "US Stock"}
        </Badge>
      </div>

      <div className="mt-4 h-32 rounded-3xl border border-white/10 bg-black/30 p-3">
        {payload && chartsReady && chartData.length ? (
          <ResponsiveContainer width="100%" height="100%">
            <RechartsLineChart data={chartData}>
              <CartesianGrid stroke="rgba(255,255,255,0.04)" vertical={false} />
              <XAxis dataKey="time" hide />
              <YAxis hide domain={["dataMin", "dataMax"]} />
              <Tooltip
                content={<MarketTooltip assetClass={item.assetClass} />}
                labelFormatter={(value) => String(value)}
              />
              <Line
                type="monotone"
                dataKey="price"
                stroke={positive ? "#22c55e" : "#fb7185"}
                strokeWidth={2.5}
                dot={false}
              />
            </RechartsLineChart>
          </ResponsiveContainer>
        ) : (
          <div className="flex h-full items-center justify-center text-xs text-zinc-500">
            {payload ? "Loading chart..." : "Fetching market data..."}
          </div>
        )}
      </div>

      <div className="mt-4 flex items-end justify-between gap-3">
        <div>
          <div className="font-mono text-2xl font-black text-white">
            {payload ? `$${formatMarketPrice(payload.price, item.assetClass)}` : "--"}
          </div>
          <div
            className={cn(
              "mt-1 flex items-center gap-1 text-sm font-bold",
              positive ? "text-emerald-300" : "text-rose-300",
            )}
          >
            {positive ? <TrendingUp className="h-4 w-4" /> : <TrendingDown className="h-4 w-4" />}
            {formatSignedChange(payload?.change ?? null)} ({formatSignedPercent(payload?.changePercent ?? null)})
          </div>
        </div>
        <LineChart className="h-8 w-8 text-cyan-200 opacity-70 transition group-hover:scale-110" />
      </div>
    </button>
  );
}

function WatchlistSection({
  chartsReady,
  items,
  payloads,
  selectedId,
  title,
  onSelect,
}: {
  chartsReady: boolean;
  items: WatchlistItem[];
  payloads: Record<string, MarketChartPayload>;
  selectedId: string;
  title: string;
  onSelect: (id: string) => void;
}) {
  return (
    <div className="grid gap-4">
      <div className="flex items-center gap-2">
        <h3 className="text-sm font-black uppercase tracking-[0.24em] text-zinc-400">{title}</h3>
        <Badge tone="neutral">{items.length} pairs</Badge>
      </div>
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-5">
        {items.map((item) => (
          <MarketChartCard
            key={item.id}
            chartsReady={chartsReady}
            item={item}
            payload={payloads[item.id]}
            selected={selectedId === item.id}
            onSelect={() => onSelect(item.id)}
          />
        ))}
      </div>
    </div>
  );
}

export function MarketChartsView({ chartsReady }: MarketChartsViewProps) {
  const [payloads, setPayloads] = useState<Record<string, MarketChartPayload>>({});
  const [selectedId, setSelectedId] = useState<string>(CRYPTO_WATCHLIST[0].id);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState<string | null>(null);

  const selectedItem = useMemo(() => {
    return [...CRYPTO_WATCHLIST, ...STOCK_WATCHLIST].find((item) => item.id === selectedId);
  }, [selectedId]);

  const selectedPayload = payloads[selectedId];

  const loadWatchlist = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const response = await fetch("/api/market-data/watchlist?range=5d&interval=15m", {
        cache: "no-store",
      });
      const body: unknown = await response.json();

      if (!response.ok) {
        const message =
          body && typeof body === "object" && "error" in body
            ? String((body as { error: unknown }).error)
            : "Unable to load market charts.";
        throw new Error(message);
      }

      const items = (body as { items: MarketChartPayload[] }).items;
      const nextPayloads = Object.fromEntries(items.map((item) => [item.id, item]));
      setPayloads(nextPayloads);
      setLastUpdated(new Date().toISOString());
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Unable to load market charts.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadWatchlist();
    const interval = window.setInterval(() => {
      void loadWatchlist();
    }, 60_000);

    return () => {
      window.clearInterval(interval);
    };
  }, [loadWatchlist]);

  return (
    <section className="grid gap-6">
      <Card className="overflow-hidden bg-gradient-to-br from-cyan-400/10 to-fuchsia-500/10">
        <CardHeader>
          <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
            <div>
              <CardTitle>Live Market Charts</CardTitle>
              <p className="mt-1 max-w-3xl text-sm text-zinc-400">
                Sparklines from Yahoo Finance (free). Select any symbol for a full TradingView chart —
                Curated crypto pairs and US stock / ETF tickers.
              </p>
              {lastUpdated ? (
                <p className="mt-2 text-xs text-zinc-500">
                  Last updated {format(new Date(lastUpdated), "MMM d, yyyy HH:mm:ss")}
                </p>
              ) : null}
            </div>
            <Button
              type="button"
              disabled={loading}
              onClick={() => void loadWatchlist()}
              className="bg-white/5 text-zinc-100"
            >
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCcw className="h-4 w-4" />}
              Refresh markets
            </Button>
          </div>
        </CardHeader>
      </Card>

      {error ? (
        <Card className="border-rose-400/30 bg-rose-500/10 p-4 text-sm text-rose-100">{error}</Card>
      ) : null}

      <WatchlistSection
        chartsReady={chartsReady}
        items={CRYPTO_WATCHLIST}
        payloads={payloads}
        selectedId={selectedId}
        title="Crypto"
        onSelect={setSelectedId}
      />

      <WatchlistSection
        chartsReady={chartsReady}
        items={STOCK_WATCHLIST}
        payloads={payloads}
        selectedId={selectedId}
        title="US Stocks"
        onSelect={setSelectedId}
      />

      {selectedItem ? (
        <Card className="overflow-hidden border-white/10 bg-black/35">
          <CardHeader>
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <CardTitle>TradingView — {selectedItem.label}</CardTitle>
                <p className="mt-1 text-sm text-zinc-400">
                  {selectedItem.tradingViewSymbol} · 15m interval · delayed/free data
                </p>
              </div>
              {selectedPayload ? (
                <Badge tone={(selectedPayload.change ?? 0) >= 0 ? "win" : "loss"}>
                  ${formatMarketPrice(selectedPayload.price, selectedItem.assetClass)}
                </Badge>
              ) : null}
            </div>
          </CardHeader>
          <CardContent>
            <div className="overflow-hidden rounded-3xl border border-white/10 bg-zinc-950">
              <TradingViewEmbed symbol={selectedItem.tradingViewSymbol} className="h-[480px] w-full" />
            </div>
          </CardContent>
        </Card>
      ) : null}
    </section>
  );
}
