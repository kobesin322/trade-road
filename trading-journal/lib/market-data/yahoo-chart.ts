import type { WatchlistItem } from "@/lib/market-data/symbols";
import type { OHLCVBar } from "@/lib/orderflow/types";

type YahooQuoteSeries = {
  open?: Array<number | null>;
  high?: Array<number | null>;
  low?: Array<number | null>;
  close?: Array<number | null>;
  volume?: Array<number | null>;
};

type YahooChartResponse = {
  chart?: {
    result?: Array<{
      meta?: {
        currency?: string;
        exchangeName?: string;
        fullExchangeName?: string;
        regularMarketPrice?: number;
        chartPreviousClose?: number;
        previousClose?: number;
        symbol?: string;
      };
      indicators?: {
        quote?: YahooQuoteSeries[];
      };
      timestamp?: number[];
    }>;
  };
};

export type MarketChartPoint = {
  time: string;
  price: number;
  timestamp: number;
};

export type MarketChartPayload = {
  id: string;
  label: string;
  symbol: string;
  tradingViewSymbol: string;
  assetClass: WatchlistItem["assetClass"];
  currency: string;
  exchange: string;
  price: number;
  change: number | null;
  changePercent: number | null;
  source: string;
  points: MarketChartPoint[];
};

export type MarketOHLCVPayload = {
  id: string;
  label: string;
  symbol: string;
  yahooSymbol: string;
  tradingViewSymbol: string;
  assetClass: WatchlistItem["assetClass"];
  currency: string;
  exchange: string;
  price: number;
  change: number | null;
  changePercent: number | null;
  source: string;
  range: string;
  interval: string;
  bars: OHLCVBar[];
};

const YAHOO_CHART_BASE = "https://query1.finance.yahoo.com/v8/finance/chart";

async function fetchJson<T>(url: string): Promise<T> {
  const response = await fetch(url, {
    cache: "no-store",
    headers: {
      "User-Agent": "Mozilla/5.0 TradeRoad Market Data",
    },
  });

  if (!response.ok) {
    throw new Error(`Yahoo chart request failed with ${response.status}.`);
  }

  return response.json() as Promise<T>;
}

function buildPoints(timestamps: number[], closes: Array<number | null>): MarketChartPoint[] {
  const points: MarketChartPoint[] = [];

  for (let index = 0; index < timestamps.length; index += 1) {
    const close = closes[index];
    const timestamp = timestamps[index];

    if (typeof close !== "number" || !Number.isFinite(close) || typeof timestamp !== "number") {
      continue;
    }

    points.push({
      time: new Date(timestamp * 1000).toISOString(),
      price: close,
      timestamp,
    });
  }

  return points;
}

function buildOHLCVBars(timestamps: number[], quote: YahooQuoteSeries): OHLCVBar[] {
  const bars: OHLCVBar[] = [];

  for (let index = 0; index < timestamps.length; index += 1) {
    const timestamp = timestamps[index];
    const open = quote.open?.[index];
    const high = quote.high?.[index];
    const low = quote.low?.[index];
    const close = quote.close?.[index];
    const volume = quote.volume?.[index];

    if (
      typeof timestamp !== "number" ||
      typeof open !== "number" ||
      typeof high !== "number" ||
      typeof low !== "number" ||
      typeof close !== "number" ||
      !Number.isFinite(open) ||
      !Number.isFinite(high) ||
      !Number.isFinite(low) ||
      !Number.isFinite(close)
    ) {
      continue;
    }

    bars.push({
      timestamp: timestamp * 1000,
      open,
      high,
      low,
      close,
      volume: typeof volume === "number" && Number.isFinite(volume) ? volume : 0,
    });
  }

  return bars;
}

export async function fetchYahooMarketChart(
  item: WatchlistItem,
  options: { range?: string; interval?: string } = {},
): Promise<MarketChartPayload> {
  const range = options.range ?? "5d";
  const interval = options.interval ?? "15m";
  const url = `${YAHOO_CHART_BASE}/${encodeURIComponent(item.yahooSymbol)}?range=${range}&interval=${interval}`;
  const payload = await fetchJson<YahooChartResponse>(url);
  const result = payload.chart?.result?.[0];
  const meta = result?.meta;
  const closes = result?.indicators?.quote?.[0]?.close ?? [];
  const timestamps = result?.timestamp ?? [];
  const points = buildPoints(timestamps, closes);

  if (!points.length) {
    throw new Error(`Yahoo chart for ${item.yahooSymbol} did not return price points.`);
  }

  const price = meta?.regularMarketPrice ?? points[points.length - 1].price;
  const baseline =
    meta?.chartPreviousClose ??
    meta?.previousClose ??
    points[0]?.price ??
    null;
  const change = baseline !== null ? price - baseline : null;
  const changePercent =
    baseline !== null && baseline !== 0 && change !== null ? (change / baseline) * 100 : null;

  return {
    id: item.id,
    label: item.label,
    symbol: meta?.symbol ?? item.yahooSymbol,
    tradingViewSymbol: item.tradingViewSymbol,
    assetClass: item.assetClass,
    currency: meta?.currency ?? "USD",
    exchange: meta?.fullExchangeName ?? meta?.exchangeName ?? "—",
    price,
    change,
    changePercent,
    source: "Yahoo Finance chart API",
    points,
  };
}

export async function fetchYahooOHLCV(
  item: WatchlistItem,
  options: { range?: string; interval?: string } = {},
): Promise<MarketOHLCVPayload> {
  const range = options.range ?? "5d";
  const interval = options.interval ?? "15m";
  const url = `${YAHOO_CHART_BASE}/${encodeURIComponent(item.yahooSymbol)}?range=${range}&interval=${interval}`;
  const payload = await fetchJson<YahooChartResponse>(url);
  const result = payload.chart?.result?.[0];
  const meta = result?.meta;
  const quote = result?.indicators?.quote?.[0] ?? {};
  const timestamps = result?.timestamp ?? [];
  const bars = buildOHLCVBars(timestamps, quote);

  if (!bars.length) {
    throw new Error(`Yahoo OHLCV for ${item.yahooSymbol} did not return usable bars.`);
  }

  const price = meta?.regularMarketPrice ?? bars[bars.length - 1].close;
  const baseline =
    meta?.chartPreviousClose ??
    meta?.previousClose ??
    bars[0]?.close ??
    null;
  const change = baseline !== null ? price - baseline : null;
  const changePercent =
    baseline !== null && baseline !== 0 && change !== null ? (change / baseline) * 100 : null;

  return {
    id: item.id,
    label: item.label,
    symbol: meta?.symbol ?? item.yahooSymbol,
    yahooSymbol: item.yahooSymbol,
    tradingViewSymbol: item.tradingViewSymbol,
    assetClass: item.assetClass,
    currency: meta?.currency ?? "USD",
    exchange: meta?.fullExchangeName ?? meta?.exchangeName ?? "—",
    price,
    change,
    changePercent,
    source: "Yahoo Finance chart API",
    range,
    interval,
    bars,
  };
}
