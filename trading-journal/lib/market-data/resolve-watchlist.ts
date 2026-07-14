import { createWatchlistItemFromSymbol } from "@/lib/market-data/custom-watchlist";
import {
  findWatchlistItem,
  findWatchlistItemBySymbol,
  type WatchlistItem,
} from "@/lib/market-data/symbols";

export function resolveWatchlistItem(input: {
  id?: string | null;
  symbol?: string | null;
}): WatchlistItem | undefined {
  if (input.id) {
    const builtIn = findWatchlistItem(input.id);
    if (builtIn) {
      return builtIn;
    }

    if (input.id.startsWith("custom-") && input.symbol) {
      return createWatchlistItemFromSymbol(input.symbol, { label: input.symbol });
    }
  }

  if (input.symbol?.trim()) {
    const builtIn = findWatchlistItemBySymbol(input.symbol);
    if (builtIn) {
      return builtIn;
    }

    return createWatchlistItemFromSymbol(input.symbol);
  }

  return undefined;
}
