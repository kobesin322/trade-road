const YAHOO_CHART_BASE = "https://query1.finance.yahoo.com/v8/finance/chart";
export const RS_BENCHMARK = "QQQ";
export const RS_DEFAULT_RANGE = "1mo";

type YahooChartMeta = {
  regularMarketPrice?: number;
  chartPreviousClose?: number;
  previousClose?: number;
  symbol?: string;
};

type YahooChartResponse = {
  chart?: {
    result?: Array<{
      meta?: YahooChartMeta;
      indicators?: { quote?: Array<{ close?: Array<number | null> }> };
      timestamp?: number[];
    }>;
  };
};

export type TrailingReturn = {
  symbol: string;
  return_pct: number | null;
  range: string;
};

async function fetchChartPayload(symbol: string, range: string) {
  const url = `${YAHOO_CHART_BASE}/${encodeURIComponent(symbol)}?range=${encodeURIComponent(range)}&interval=1d`;
  const response = await fetch(url, {
    cache: "no-store",
    headers: { "User-Agent": "Mozilla/5.0 TradeRoad RS" },
    signal: AbortSignal.timeout(8000),
  });
  if (!response.ok) {
    return null;
  }
  return (await response.json()) as YahooChartResponse;
}

function extractReturnPct(payload: YahooChartResponse | null): number | null {
  if (!payload) {
    return null;
  }
  const result = payload.chart?.result?.[0];
  const meta = result?.meta;
  const closes = result?.indicators?.quote?.[0]?.close ?? [];
  const validCloses = closes.filter((c): c is number => typeof c === "number" && Number.isFinite(c));

  if (validCloses.length >= 2) {
    const first = validCloses[0];
    const last = validCloses[validCloses.length - 1];
    if (first > 0) {
      return ((last - first) / first) * 100;
    }
  }

  const price = meta?.regularMarketPrice;
  const baseline = meta?.chartPreviousClose ?? meta?.previousClose;
  if (typeof price === "number" && typeof baseline === "number" && baseline > 0) {
    return ((price - baseline) / baseline) * 100;
  }

  return null;
}

export async function fetchTrailingReturn(
  symbol: string,
  range = RS_DEFAULT_RANGE,
): Promise<TrailingReturn> {
  const payload = await fetchChartPayload(symbol, range);
  return {
    symbol: symbol.toUpperCase(),
    return_pct: extractReturnPct(payload),
    range,
  };
}

export async function fetchBenchmarkAndSymbolReturns(
  symbols: string[],
  range = RS_DEFAULT_RANGE,
): Promise<{ benchmark: TrailingReturn; symbols: TrailingReturn[] }> {
  const unique = [...new Set(symbols.map((s) => s.trim().toUpperCase()).filter(Boolean))];
  const [benchmark, ...symbolReturns] = await Promise.all([
    fetchTrailingReturn(RS_BENCHMARK, range),
    ...unique.map((symbol) => fetchTrailingReturn(symbol, range)),
  ]);

  return { benchmark, symbols: symbolReturns };
}
