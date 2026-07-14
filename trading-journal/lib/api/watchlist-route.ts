import { NextResponse } from "next/server";

import { WatchlistTickerServiceError } from "@/lib/watchlist-ticker-service";

export function watchlistErrorResponse(error: unknown) {
  if (error instanceof WatchlistTickerServiceError) {
    return NextResponse.json({ error: error.message }, { status: error.status });
  }

  const message = error instanceof Error ? error.message : "Unexpected server error.";
  return NextResponse.json({ error: message }, { status: 500 });
}
