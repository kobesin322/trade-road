import { NextResponse } from "next/server";

import { watchlistErrorResponse } from "@/lib/api/watchlist-route";
import {
  deleteUserWatchlistTicker,
  getUserWatchlistTicker,
  parseWatchlistTickerPatch,
  requirePersonalWatchlistUser,
  updateUserWatchlistTicker,
} from "@/lib/watchlist-ticker-service";

type RouteContext = {
  params: Promise<{ id: string }>;
};

export async function GET(_request: Request, context: RouteContext) {
  try {
    const user = await requirePersonalWatchlistUser();
    const { id } = await context.params;
    const item = await getUserWatchlistTicker(user.id, id);

    if (!item) {
      return NextResponse.json({ error: "Watchlist ticker not found." }, { status: 404 });
    }

    return NextResponse.json({ item });
  } catch (error) {
    return watchlistErrorResponse(error);
  }
}

export async function PATCH(request: Request, context: RouteContext) {
  try {
    const user = await requirePersonalWatchlistUser();
    const { id } = await context.params;
    const patch = parseWatchlistTickerPatch(await request.json());
    const item = await updateUserWatchlistTicker(user.id, id, patch);

    if (!item) {
      return NextResponse.json({ error: "Watchlist ticker not found." }, { status: 404 });
    }

    return NextResponse.json({ item });
  } catch (error) {
    return watchlistErrorResponse(error);
  }
}

export async function DELETE(_request: Request, context: RouteContext) {
  try {
    const user = await requirePersonalWatchlistUser();
    const { id } = await context.params;
    const deleted = await deleteUserWatchlistTicker(user.id, id);

    if (!deleted) {
      return NextResponse.json({ error: "Watchlist ticker not found." }, { status: 404 });
    }

    return NextResponse.json({ ok: true });
  } catch (error) {
    return watchlistErrorResponse(error);
  }
}
