import type { ComputedPosition, PositionSide } from "@/lib/ls-portfolio-types";

/** One row of market reference stats for a ticker (beta draft). */
export type BetaReferenceRow = {
  symbol: string;
  beta_spy: number | null;
  corr_spy_60d: number | null;
  sector: string | null;
  market_cap: number | null;
  avg_volume_20d: number | null;
  pct_from_52w_high: number | null;
  source: "static" | "yahoo";
};

export type BetaReferencePositionRow = BetaReferenceRow & {
  side: PositionSide;
  portfolio_weight_pct: number;
  beta_contribution: number | null;
};

export type BetaReferenceSummary = {
  rows: BetaReferencePositionRow[];
  net_beta: number | null;
  long_beta: number | null;
  short_beta: number | null;
  as_of: string;
  benchmark: string;
  disclaimer: string;
};

/** Curated draft values — replaced by live fetch when available. */
export const STATIC_BETA_REFERENCE: Record<string, Omit<BetaReferenceRow, "symbol" | "source">> = {
  TSLA: {
    beta_spy: 2.08,
    corr_spy_60d: 0.62,
    sector: "Consumer Cyclical",
    market_cap: 800_000_000_000,
    avg_volume_20d: 98_000_000,
    pct_from_52w_high: -18.4,
  },
  COIN: {
    beta_spy: 2.74,
    corr_spy_60d: 0.55,
    sector: "Financial Services",
    market_cap: 58_000_000_000,
    avg_volume_20d: 12_500_000,
    pct_from_52w_high: -22.1,
  },
  SCCO: {
    beta_spy: 1.12,
    corr_spy_60d: 0.48,
    sector: "Basic Materials",
    market_cap: 72_000_000_000,
    avg_volume_20d: 1_800_000,
    pct_from_52w_high: -8.6,
  },
  CRCL: {
    beta_spy: 1.45,
    corr_spy_60d: 0.41,
    sector: "Industrials",
    market_cap: 2_400_000_000,
    avg_volume_20d: 420_000,
    pct_from_52w_high: -31.2,
  },
  IREN: {
    beta_spy: 2.35,
    corr_spy_60d: 0.52,
    sector: "Technology",
    market_cap: 3_100_000_000,
    avg_volume_20d: 18_000_000,
    pct_from_52w_high: -28.5,
  },
  SNDK: {
    beta_spy: 1.68,
    corr_spy_60d: 0.44,
    sector: "Technology",
    market_cap: 18_000_000_000,
    avg_volume_20d: 890_000,
    pct_from_52w_high: -12.3,
  },
  EWY: {
    beta_spy: 0.86,
    corr_spy_60d: 0.71,
    sector: "ETF — Korea Equity",
    market_cap: 6_800_000_000,
    avg_volume_20d: 4_200_000,
    pct_from_52w_high: -6.2,
  },
  SPY: {
    beta_spy: 1.0,
    corr_spy_60d: 1.0,
    sector: "ETF — US Large Cap",
    market_cap: 580_000_000_000,
    avg_volume_20d: 72_000_000,
    pct_from_52w_high: -1.8,
  },
  AAPL: {
    beta_spy: 1.24,
    corr_spy_60d: 0.78,
    sector: "Technology",
    market_cap: 3_200_000_000_000,
    avg_volume_20d: 58_000_000,
    pct_from_52w_high: -9.4,
  },
  NVDA: {
    beta_spy: 1.92,
    corr_spy_60d: 0.68,
    sector: "Technology",
    market_cap: 2_800_000_000_000,
    avg_volume_20d: 285_000_000,
    pct_from_52w_high: -5.1,
  },
};

type YahooQuoteSummary = {
  quoteSummary?: {
    result?: Array<{
      defaultKeyStatistics?: { beta?: { raw?: number } };
      summaryProfile?: { sector?: string; industry?: string };
      price?: {
        marketCap?: { raw?: number };
        regularMarketVolume?: { raw?: number };
        fiftyTwoWeekHigh?: { raw?: number };
        regularMarketPrice?: { raw?: number };
      };
    }>;
  };
};

export function staticReferenceForSymbol(symbol: string): BetaReferenceRow {
  const key = symbol.trim().toUpperCase();
  const row = STATIC_BETA_REFERENCE[key];
  if (!row) {
    return {
      symbol: key,
      beta_spy: null,
      corr_spy_60d: null,
      sector: null,
      market_cap: null,
      avg_volume_20d: null,
      pct_from_52w_high: null,
      source: "static",
    };
  }
  return { symbol: key, ...row, source: "static" };
}

export async function fetchYahooReference(symbol: string): Promise<BetaReferenceRow | null> {
  const url = `https://query1.finance.yahoo.com/v10/finance/quoteSummary/${encodeURIComponent(symbol)}?modules=defaultKeyStatistics,summaryProfile,price`;
  try {
    const response = await fetch(url, {
      cache: "no-store",
      headers: { "User-Agent": "Mozilla/5.0 TradeRoad Beta Reference" },
      signal: AbortSignal.timeout(6000),
    });
    if (!response.ok) {
      return null;
    }
    const payload = (await response.json()) as YahooQuoteSummary;
    const block = payload.quoteSummary?.result?.[0];
    if (!block) {
      return null;
    }
    const price = block.price?.regularMarketPrice?.raw;
    const high = block.price?.fiftyTwoWeekHigh?.raw;
    const pctFromHigh =
      typeof price === "number" && typeof high === "number" && high > 0
        ? ((price - high) / high) * 100
        : null;

    const staticFallback = STATIC_BETA_REFERENCE[symbol.toUpperCase()];

    return {
      symbol: symbol.toUpperCase(),
      beta_spy: block.defaultKeyStatistics?.beta?.raw ?? staticFallback?.beta_spy ?? null,
      corr_spy_60d: staticFallback?.corr_spy_60d ?? null,
      sector:
        block.summaryProfile?.sector ??
        block.summaryProfile?.industry ??
        staticFallback?.sector ??
        null,
      market_cap: block.price?.marketCap?.raw ?? staticFallback?.market_cap ?? null,
      avg_volume_20d:
        block.price?.regularMarketVolume?.raw ?? staticFallback?.avg_volume_20d ?? null,
      pct_from_52w_high: pctFromHigh ?? staticFallback?.pct_from_52w_high ?? null,
      source: "yahoo",
    };
  } catch {
    return null;
  }
}

export async function resolveReferenceRows(symbols: string[]): Promise<BetaReferenceRow[]> {
  const unique = [...new Set(symbols.map((s) => s.trim().toUpperCase()).filter(Boolean))];
  const rows = await Promise.all(
    unique.map(async (symbol) => {
      const live = await fetchYahooReference(symbol);
      return live ?? staticReferenceForSymbol(symbol);
    }),
  );
  return rows;
}

export function buildBetaReferenceSummary(
  positions: ComputedPosition[],
  references: BetaReferenceRow[],
  totalPool: number,
): BetaReferenceSummary {
  const refBySymbol = new Map(references.map((row) => [row.symbol, row]));

  const rows: BetaReferencePositionRow[] = positions.map((position) => {
    const ref = refBySymbol.get(position.symbol.toUpperCase()) ?? staticReferenceForSymbol(position.symbol);
    const portfolio_weight_pct = totalPool > 0 ? (position.market_value / totalPool) * 100 : 0;
    const sign = position.side === "short" ? -1 : 1;
    const beta_contribution =
      ref.beta_spy !== null ? sign * (portfolio_weight_pct / 100) * ref.beta_spy : null;

    return {
      ...ref,
      side: position.side,
      portfolio_weight_pct,
      beta_contribution,
    };
  });

  const net_beta = sumNullable(rows.map((r) => r.beta_contribution));
  const long_beta = sumNullable(
    rows.filter((r) => r.side === "long").map((r) => r.beta_contribution),
  );
  const short_beta = sumNullable(
    rows.filter((r) => r.side === "short").map((r) => r.beta_contribution),
  );

  return {
    rows,
    net_beta,
    long_beta,
    short_beta,
    as_of: new Date().toISOString(),
    benchmark: "SPY",
    disclaimer:
      "BETA draft — beta vs SPY (5Y monthly), 60d corr vs SPY, sector, liquidity, and extension context. Corr is static until live series is wired.",
  };
}

function sumNullable(values: Array<number | null>) {
  if (values.some((v) => v === null)) {
    const defined = values.filter((v): v is number => v !== null);
    return defined.length ? defined.reduce((a, b) => a + b, 0) : null;
  }
  return values.reduce((a, b) => (a ?? 0) + (b ?? 0), 0);
}

export function formatMarketCap(value: number | null) {
  if (value === null) {
    return "—";
  }
  if (value >= 1_000_000_000_000) {
    return `$${(value / 1_000_000_000_000).toFixed(2)}T`;
  }
  if (value >= 1_000_000_000) {
    return `$${(value / 1_000_000_000).toFixed(1)}B`;
  }
  if (value >= 1_000_000) {
    return `$${(value / 1_000_000).toFixed(0)}M`;
  }
  return `$${value.toLocaleString()}`;
}

export function formatVolume(value: number | null) {
  if (value === null) {
    return "—";
  }
  if (value >= 1_000_000) {
    return `${(value / 1_000_000).toFixed(1)}M`;
  }
  if (value >= 1_000) {
    return `${(value / 1_000).toFixed(0)}K`;
  }
  return value.toLocaleString();
}
