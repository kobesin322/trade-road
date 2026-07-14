import { NextResponse } from "next/server";

import { resolveWatchlistItem } from "@/lib/market-data/resolve-watchlist";
import { fetchYahooOHLCV } from "@/lib/market-data/yahoo-chart";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const id = searchParams.get("id");
  const symbol = searchParams.get("symbol");
  const range = searchParams.get("range") ?? "5d";
  const interval = searchParams.get("interval") ?? "15m";

  const item = resolveWatchlistItem({ id, symbol });
  if (!item) {
    return NextResponse.json({ error: "Missing or unknown watchlist symbol." }, { status: 400 });
  }

  try {
    return NextResponse.json(await fetchYahooOHLCV(item, { range, interval }));
  } catch (error) {
    const message = error instanceof Error ? error.message : "OHLCV data unavailable.";
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
