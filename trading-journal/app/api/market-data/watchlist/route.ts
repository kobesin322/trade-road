import { NextResponse } from "next/server";

import { createWatchlistItemFromSymbol } from "@/lib/market-data/custom-watchlist";
import { resolveWatchlistItem } from "@/lib/market-data/resolve-watchlist";
import { MARKET_WATCHLIST } from "@/lib/market-data/symbols";
import { fetchYahooMarketChart, type MarketChartPayload } from "@/lib/market-data/yahoo-chart";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const range = searchParams.get("range") ?? "5d";
  const interval = searchParams.get("interval") ?? "15m";
  const extraSymbols = searchParams
    .get("extraSymbols")
    ?.split(",")
    .map((symbol) => symbol.trim())
    .filter(Boolean) ?? [];

  const watchlistItems = [
    ...MARKET_WATCHLIST,
    ...extraSymbols
      .map((symbol) => resolveWatchlistItem({ symbol }) ?? createWatchlistItemFromSymbol(symbol))
      .filter(
        (item, index, items) =>
          items.findIndex(
            (candidate) => candidate.yahooSymbol.toUpperCase() === item.yahooSymbol.toUpperCase(),
          ) === index,
      )
      .filter(
        (item) =>
          !MARKET_WATCHLIST.some(
            (builtIn) => builtIn.yahooSymbol.toUpperCase() === item.yahooSymbol.toUpperCase(),
          ),
      ),
  ];

  const results = await Promise.allSettled(
    watchlistItems.map((item) => fetchYahooMarketChart(item, { range, interval })),
  );

  const items: MarketChartPayload[] = [];
  const errors: Array<{ id: string; message: string }> = [];

  results.forEach((result, index) => {
    const item = watchlistItems[index];

    if (result.status === "fulfilled") {
      items.push(result.value);
      return;
    }

    errors.push({
      id: item.id,
      message: result.reason instanceof Error ? result.reason.message : "Chart unavailable.",
    });
  });

  if (!items.length) {
    return NextResponse.json(
      { error: "All watchlist chart requests failed.", errors },
      { status: 502 },
    );
  }

  return NextResponse.json({
    items,
    errors,
    source: "Yahoo Finance chart API",
    tradingViewNote: "Detailed chart powered by TradingView embed.",
  });
}
