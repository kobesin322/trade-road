/** Curated US equity / ETF tickers used across journal, charts, and L/S portfolio. */
export const US_STOCK_TICKERS = [
  "AAOI",
  "AMD",
  "COIN",
  "CRCL",
  "CRWV",
  "DRAM",
  "EWY",
  "FUTU",
  "INTC",
  "IREN",
  "LITE",
  "MARA",
  "MU",
  "NBIS",
  "NDQ",
  "OKLO",
  "ONDS",
  "SNDK",
  "SOXL",
  "SOXX",
  "SQQQ",
  "TQQQ",
  "TSLA",
  "USAR",
  // Legacy defaults kept for existing trades / demos
  "AAPL",
  "MSFT",
  "NVDA",
  "SPY",
  "SCCO",
] as const;

export type UsStockTicker = (typeof US_STOCK_TICKERS)[number];

export const CRYPTO_TICKERS = ["BTC-USD", "ETH-USD", "SOL-USD", "BNB-USD", "XRP-USD"] as const;

export const JOURNAL_TICKER_GROUPS = [
  { group: "Crypto", symbols: [...CRYPTO_TICKERS] },
  { group: "US Stocks", symbols: [...US_STOCK_TICKERS] },
] as const;

export const ALL_TICKER_OPTIONS = [
  ...CRYPTO_TICKERS,
  ...US_STOCK_TICKERS,
] as const;

export function isKnownTicker(value: string) {
  const normalized = value.trim().toUpperCase();
  return ALL_TICKER_OPTIONS.some((t) => t.toUpperCase() === normalized);
}
