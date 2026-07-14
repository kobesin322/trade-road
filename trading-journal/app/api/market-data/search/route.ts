import { NextResponse } from "next/server";

import { searchYahooSymbols } from "@/lib/market-data/yahoo-search";
import { createWatchlistItemFromSearch } from "@/lib/market-data/custom-watchlist";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const query = searchParams.get("q") ?? "";
  const limit = Number(searchParams.get("limit") ?? "12");

  if (!query.trim()) {
    return NextResponse.json({ items: [] });
  }

  try {
    const quotes = await searchYahooSymbols(query, Number.isFinite(limit) ? Math.min(limit, 20) : 12);
    const items = quotes.map((quote) => ({
      ...createWatchlistItemFromSearch(quote),
      quoteType: quote.quoteType ?? null,
      exchange: quote.exchange ?? null,
    }));

    return NextResponse.json({ items });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Symbol search unavailable.";
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
