import { US_STOCK_TICKERS } from "@/lib/ticker-symbols";

export type WatchlistItem = {
  id: string;
  label: string;
  yahooSymbol: string;
  tradingViewSymbol: string;
  assetClass: "crypto" | "stock";
};

export const CRYPTO_WATCHLIST: WatchlistItem[] = [
  {
    id: "btc",
    label: "Bitcoin",
    yahooSymbol: "BTC-USD",
    tradingViewSymbol: "BINANCE:BTCUSDT",
    assetClass: "crypto",
  },
  {
    id: "eth",
    label: "Ethereum",
    yahooSymbol: "ETH-USD",
    tradingViewSymbol: "BINANCE:ETHUSDT",
    assetClass: "crypto",
  },
  {
    id: "sol",
    label: "Solana",
    yahooSymbol: "SOL-USD",
    tradingViewSymbol: "BINANCE:SOLUSDT",
    assetClass: "crypto",
  },
  {
    id: "bnb",
    label: "BNB",
    yahooSymbol: "BNB-USD",
    tradingViewSymbol: "BINANCE:BNBUSDT",
    assetClass: "crypto",
  },
  {
    id: "xrp",
    label: "XRP",
    yahooSymbol: "XRP-USD",
    tradingViewSymbol: "BINANCE:XRPUSDT",
    assetClass: "crypto",
  },
];

/** Exchange prefix is approximate — charts use Yahoo symbol for data. */
const STOCK_EXCHANGE: Partial<Record<string, string>> = {
  SPY: "AMEX",
  SOXL: "AMEX",
  SOXX: "NASDAQ",
  SQQQ: "NASDAQ",
  TQQQ: "NASDAQ",
  EWY: "AMEX",
  FUTU: "NASDAQ",
};

function stockToWatchlistItem(symbol: string): WatchlistItem {
  const exchange = STOCK_EXCHANGE[symbol] ?? "NASDAQ";
  return {
    id: symbol.toLowerCase(),
    label: symbol,
    yahooSymbol: symbol,
    tradingViewSymbol: `${exchange}:${symbol}`,
    assetClass: "stock",
  };
}

export const STOCK_WATCHLIST: WatchlistItem[] = US_STOCK_TICKERS.map(stockToWatchlistItem);

export const MARKET_WATCHLIST: WatchlistItem[] = [...CRYPTO_WATCHLIST, ...STOCK_WATCHLIST];

export function findWatchlistItem(id: string) {
  return MARKET_WATCHLIST.find((item) => item.id === id);
}

export function findWatchlistItemBySymbol(symbol: string) {
  const normalized = symbol.trim().toUpperCase();
  return MARKET_WATCHLIST.find((item) => item.yahooSymbol.toUpperCase() === normalized);
}
