import { NextResponse } from "next/server";

type YahooChartResponse = {
  chart?: {
    result?: Array<{
      meta?: {
        currency?: string;
        exchangeName?: string;
        fullExchangeName?: string;
        regularMarketPrice?: number;
        regularMarketTime?: number;
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

type StooqResponse = {
  symbols?: Array<{
    close?: number;
    date?: string;
    high?: number;
    low?: number;
    open?: number;
    symbol?: string;
    time?: string;
  }>;
};

type NqQuote = {
  change: number | null;
  changePercent: number | null;
  currency: string;
  exchange: string;
  high: number | null;
  low: number | null;
  open: number | null;
  price: number;
  source: string;
  symbol: string;
  timestamp: string;
};

const YAHOO_NQ_URL = "https://query1.finance.yahoo.com/v8/finance/chart/NQ=F?range=1d&interval=1m";
const STOOQ_NQ_URL = "https://stooq.com/q/l/?s=nq.f&f=sd2t2ohlcv&h&e=json";

function latestNumber(values: Array<number | null> | undefined) {
  if (!values) {
    return null;
  }

  for (let index = values.length - 1; index >= 0; index -= 1) {
    const value = values[index];
    if (typeof value === "number" && Number.isFinite(value)) {
      return value;
    }
  }

  return null;
}

async function fetchJson<T>(url: string): Promise<T> {
  const response = await fetch(url, {
    cache: "no-store",
    headers: {
      "User-Agent": "Mozilla/5.0 TradeRoad Market Data",
    },
  });

  if (!response.ok) {
    throw new Error(`Request failed with ${response.status}`);
  }

  return response.json() as Promise<T>;
}

async function fetchYahooQuote(): Promise<NqQuote> {
  const payload = await fetchJson<YahooChartResponse>(YAHOO_NQ_URL);
  const result = payload.chart?.result?.[0];
  const meta = result?.meta;
  const close = result?.indicators?.quote?.[0]?.close;
  const price = meta?.regularMarketPrice ?? latestNumber(close);
  const open = close?.find((value): value is number => typeof value === "number") ?? null;

  if (typeof price !== "number" || !Number.isFinite(price)) {
    throw new Error("Yahoo NQ response did not include a usable price.");
  }

  const change = open ? price - open : null;
  const timestampSeconds =
    meta?.regularMarketTime ?? result?.timestamp?.[result.timestamp.length - 1] ?? null;

  return {
    change,
    changePercent: open && change !== null ? (change / open) * 100 : null,
    currency: meta?.currency ?? "USD",
    exchange: meta?.fullExchangeName ?? meta?.exchangeName ?? "CME",
    high: null,
    low: null,
    open,
    price,
    source: "Yahoo Finance delayed futures chart",
    symbol: meta?.symbol ?? "NQ=F",
    timestamp: timestampSeconds
      ? new Date(timestampSeconds * 1000).toISOString()
      : new Date().toISOString(),
  };
}

async function fetchStooqQuote(): Promise<NqQuote> {
  const payload = await fetchJson<StooqResponse>(STOOQ_NQ_URL);
  const symbol = payload.symbols?.[0];
  const price = Number(symbol?.close);

  if (!Number.isFinite(price)) {
    throw new Error("Stooq NQ response did not include a usable price.");
  }

  const open = typeof symbol?.open === "number" ? symbol.open : null;
  const change = open ? price - open : null;
  const timestamp =
    symbol?.date && symbol.time
      ? new Date(`${symbol.date}T${symbol.time}Z`).toISOString()
      : new Date().toISOString();

  return {
    change,
    changePercent: open && change !== null ? (change / open) * 100 : null,
    currency: "USD",
    exchange: "CME",
    high: typeof symbol?.high === "number" ? symbol.high : null,
    low: typeof symbol?.low === "number" ? symbol.low : null,
    open,
    price,
    source: "Stooq delayed futures quote",
    symbol: symbol?.symbol ?? "NQ.F",
    timestamp,
  };
}

export async function GET() {
  try {
    return NextResponse.json(await fetchYahooQuote());
  } catch {
    try {
      return NextResponse.json(await fetchStooqQuote());
    } catch (error) {
      const message = error instanceof Error ? error.message : "NQ source unavailable.";
      return NextResponse.json({ error: message }, { status: 502 });
    }
  }
}
