import type { WatchlistItem } from "@/lib/market-data/symbols";

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
        quote?: Array<{
          close?: Array<number | null>;
        }>;
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
