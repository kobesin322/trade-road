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

export const STOCK_WATCHLIST: WatchlistItem[] = [
  {
    id: "aapl",
    label: "Apple",
    yahooSymbol: "AAPL",
    tradingViewSymbol: "NASDAQ:AAPL",
    assetClass: "stock",
  },
  {
    id: "msft",
    label: "Microsoft",
    yahooSymbol: "MSFT",
    tradingViewSymbol: "NASDAQ:MSFT",
    assetClass: "stock",
  },
  {
    id: "nvda",
    label: "NVIDIA",
    yahooSymbol: "NVDA",
    tradingViewSymbol: "NASDAQ:NVDA",
    assetClass: "stock",
  },
  {
    id: "tsla",
    label: "Tesla",
    yahooSymbol: "TSLA",
    tradingViewSymbol: "NASDAQ:TSLA",
    assetClass: "stock",
  },
  {
    id: "spy",
    label: "S&P 500 ETF",
    yahooSymbol: "SPY",
    tradingViewSymbol: "AMEX:SPY",
    assetClass: "stock",
  },
];

export const MARKET_WATCHLIST: WatchlistItem[] = [...CRYPTO_WATCHLIST, ...STOCK_WATCHLIST];

export function findWatchlistItem(id: string) {
  return MARKET_WATCHLIST.find((item) => item.id === id);
}
