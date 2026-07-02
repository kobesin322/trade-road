import { NextResponse } from "next/server";

import { findWatchlistItem } from "@/lib/market-data/symbols";
import { fetchYahooOHLCV } from "@/lib/market-data/yahoo-chart";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const id = searchParams.get("id");
  const range = searchParams.get("range") ?? "5d";
  const interval = searchParams.get("interval") ?? "15m";

  if (!id) {
    return NextResponse.json({ error: "Missing watchlist id." }, { status: 400 });
  }

  const item = findWatchlistItem(id);
  if (!item) {
    return NextResponse.json({ error: `Unknown watchlist id: ${id}` }, { status: 404 });
  }

  try {
    return NextResponse.json(await fetchYahooOHLCV(item, { range, interval }));
  } catch (error) {
    const message = error instanceof Error ? error.message : "OHLCV data unavailable.";
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
