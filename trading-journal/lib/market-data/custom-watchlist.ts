import { MARKET_WATCHLIST, type WatchlistItem } from "@/lib/market-data/symbols";
import type { YahooSearchQuote } from "@/lib/market-data/yahoo-search";

export type WatchlistTickerInput = {
  yahooSymbol: string;
  label: string;
  tradingViewSymbol: string;
  assetClass: WatchlistItem["assetClass"];
  quoteType?: string | null;
  exchange?: string | null;
  sortOrder?: number;
};

export type WatchlistTickerPatch = {
  label?: string;
  sortOrder?: number;
};

const STORAGE_KEY = "traderoad_custom_watchlist_v1";
export const CUSTOM_WATCHLIST_CHANGED_EVENT = "traderoad:custom-watchlist-changed";

const EXCHANGE_MAP: Record<string, string> = {
  NMS: "NASDAQ",
  NG: "NASDAQ",
  NGM: "NASDAQ",
  NYQ: "NYSE",
  ASE: "AMEX",
  PCX: "AMEX",
  NCM: "NASDAQ",
};

export function isMarketSymbolFormat(value: string) {
  return /^[A-Za-z0-9][A-Za-z0-9.-]{0,19}$/.test(value.trim());
}

export function customWatchlistId(yahooSymbol: string) {
  return `custom-${yahooSymbol.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "")}`;
}

export function cryptoTradingViewSymbol(yahooSymbol: string) {
  const base = yahooSymbol.replace(/-USD$/i, "").replace(/-/g, "");
  return `BINANCE:${base}USDT`;
}

export function stockTradingViewSymbol(symbol: string, exchange?: string) {
  const prefix = exchange ? (EXCHANGE_MAP[exchange] ?? "NASDAQ") : "NASDAQ";
  return `${prefix}:${symbol}`;
}

export function createWatchlistItemFromSymbol(
  yahooSymbol: string,
  options: {
    label?: string;
    assetClass?: WatchlistItem["assetClass"];
    exchange?: string;
  } = {},
): WatchlistItem {
  const normalized = yahooSymbol.trim().toUpperCase();
  const assetClass =
    options.assetClass ??
    (normalized.endsWith("-USD") || normalized.includes("USDT") ? "crypto" : "stock");

  return {
    id: customWatchlistId(normalized),
    label: options.label?.trim() || normalized,
    yahooSymbol: normalized,
    tradingViewSymbol:
      assetClass === "crypto"
        ? cryptoTradingViewSymbol(normalized)
        : stockTradingViewSymbol(normalized, options.exchange),
    assetClass,
  };
}

export function createWatchlistItemFromSearch(quote: YahooSearchQuote): WatchlistItem {
  const assetClass = quote.quoteType === "CRYPTOCURRENCY" ? "crypto" : "stock";
  return createWatchlistItemFromSymbol(quote.symbol, {
    label: quote.shortname ?? quote.longname ?? quote.symbol,
    assetClass,
    exchange: quote.exchange,
  });
}

export function watchlistItemToInput(
  item: WatchlistItem,
  options: {
    quoteType?: string | null;
    exchange?: string | null;
    sortOrder?: number;
  } = {},
): WatchlistTickerInput {
  return {
    yahooSymbol: item.yahooSymbol,
    label: item.label,
    tradingViewSymbol: item.tradingViewSymbol,
    assetClass: item.assetClass,
    quoteType: options.quoteType ?? null,
    exchange: options.exchange ?? null,
    sortOrder: options.sortOrder,
  };
}

export function dispatchCustomWatchlistChanged() {
  if (typeof window === "undefined") {
    return;
  }

  window.dispatchEvent(new Event(CUSTOM_WATCHLIST_CHANGED_EVENT));
}

export function readLocalCustomWatchlist(): WatchlistItem[] {
  if (typeof window === "undefined") {
    return [];
  }

  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      return [];
    }

    const parsed = JSON.parse(raw) as WatchlistItem[];
    if (!Array.isArray(parsed)) {
      return [];
    }

    return parsed.filter(
      (item) =>
        item &&
        typeof item.id === "string" &&
        typeof item.yahooSymbol === "string" &&
        typeof item.tradingViewSymbol === "string" &&
        (item.assetClass === "crypto" || item.assetClass === "stock"),
    );
  } catch {
    return [];
  }
}

export function writeLocalCustomWatchlist(items: WatchlistItem[]) {
  if (typeof window === "undefined") {
    return;
  }

  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
  dispatchCustomWatchlistChanged();
}

export function clearLocalCustomWatchlist() {
  if (typeof window === "undefined") {
    return;
  }

  window.localStorage.removeItem(STORAGE_KEY);
  dispatchCustomWatchlistChanged();
}

export function isBuiltInWatchlistItem(item: Pick<WatchlistItem, "id" | "yahooSymbol">) {
  return MARKET_WATCHLIST.some(
    (builtIn) =>
      builtIn.id === item.id ||
      builtIn.yahooSymbol.toUpperCase() === item.yahooSymbol.toUpperCase(),
  );
}

export function addLocalCustomWatchlistItem(item: WatchlistItem) {
  if (isBuiltInWatchlistItem(item)) {
    return readLocalCustomWatchlist();
  }

  const current = readLocalCustomWatchlist();
  const exists = current.some(
    (entry) =>
      entry.id === item.id ||
      entry.yahooSymbol.toUpperCase() === item.yahooSymbol.toUpperCase(),
  );

  if (exists) {
    return current;
  }

  const next = [...current, item];
  writeLocalCustomWatchlist(next);
  return next;
}

export function removeLocalCustomWatchlistItem(id: string) {
  const next = readLocalCustomWatchlist().filter((item) => item.id !== id);
  writeLocalCustomWatchlist(next);
  return next;
}

export function mergeWatchlists(customItems: WatchlistItem[]) {
  return [...MARKET_WATCHLIST, ...customItems];
}
