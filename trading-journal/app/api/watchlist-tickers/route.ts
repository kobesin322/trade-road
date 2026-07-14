import { NextResponse } from "next/server";

import { watchlistErrorResponse } from "@/lib/api/watchlist-route";
import {
  createUserWatchlistTicker,
  listUserWatchlistTickers,
  parseWatchlistTickerInput,
  requirePersonalWatchlistUser,
} from "@/lib/watchlist-ticker-service";

export async function GET() {
  try {
    const user = await requirePersonalWatchlistUser();
    const items = await listUserWatchlistTickers(user.id);
    return NextResponse.json({ items });
  } catch (error) {
    return watchlistErrorResponse(error);
  }
}

export async function POST(request: Request) {
  try {
    const user = await requirePersonalWatchlistUser();
    const input = parseWatchlistTickerInput(await request.json());
    const item = await createUserWatchlistTicker(user.id, input);
    return NextResponse.json({ item }, { status: 201 });
  } catch (error) {
    return watchlistErrorResponse(error);
  }
}
