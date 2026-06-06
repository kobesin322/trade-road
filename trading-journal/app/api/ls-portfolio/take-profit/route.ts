import { NextResponse } from "next/server";

import { tradeErrorResponse } from "@/lib/api/trade-route";
import {
  deletePosition,
  getPortfolioSnapshot,
  logPortfolioEvent,
  updatePortfolio,
  updatePosition,
} from "@/lib/ls-portfolio-db";
import { calculateTakeProfitPreview } from "@/lib/ls-portfolio";
import {
  LSPortfolioServiceError,
  loadPortfolioForUser,
  requirePortfolioUser,
} from "@/lib/ls-portfolio-service";

export async function POST(request: Request) {
  try {
    const user = await requirePortfolioUser();
    const body = (await request.json()) as Record<string, unknown>;
    const snapshot = await getPortfolioSnapshot(user.id);
    const positionId = String(body.position_id ?? "");
    const position = snapshot.positions.find((p) => p.id === positionId);
    if (!position) {
      return NextResponse.json({ error: "Position not found." }, { status: 404 });
    }

    const preview = calculateTakeProfitPreview(position, snapshot.portfolio, snapshot.positions, {
      sell_qty: body.sell_qty !== undefined ? Number(body.sell_qty) : undefined,
      sell_pct: body.sell_pct !== undefined ? Number(body.sell_pct) : undefined,
    });

    if (preview.sell_qty <= 0) {
      return NextResponse.json({ error: "Quantity to close must be greater than zero." }, {
        status: 400,
      });
    }

    if (preview.remaining_qty <= 0) {
      await deletePosition(user.id, position.id);
    } else {
      await updatePosition(user.id, position.id, { quantity: preview.remaining_qty });
    }

    await updatePortfolio(user.id, snapshot.portfolio.id, {
      long_cash: preview.after.long_pool - preview.after.long_mv,
      short_cash: preview.after.short_pool - preview.after.short_mv,
    });

    await logPortfolioEvent(snapshot.portfolio.id, {
      event_type: "TAKE_PROFIT",
      position_id: position.id,
      payload: {
        symbol: position.symbol,
        side: position.side,
        sell_qty: preview.sell_qty,
        sell_pct: preview.sell_pct,
        realized_pnl: preview.realized_pnl,
        cash_delta: preview.cash_delta,
        long_pool_after: preview.after.long_pool,
        short_pool_after: preview.after.short_pool,
      },
    });

    return NextResponse.json(await loadPortfolioForUser(user.id));
  } catch (error) {
    if (error instanceof LSPortfolioServiceError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    return tradeErrorResponse(error);
  }
}

export async function GET(request: Request) {
  try {
    const user = await requirePortfolioUser();
    const { searchParams } = new URL(request.url);
    const positionId = searchParams.get("position_id");
    const sellPct = Number(searchParams.get("sell_pct") ?? 30);
    const sellQtyParam = searchParams.get("sell_qty");

    const snapshot = await getPortfolioSnapshot(user.id);
    const position = snapshot.positions.find((p) => p.id === positionId);
    if (!position) {
      return NextResponse.json({ error: "Position not found." }, { status: 404 });
    }

    const preview = calculateTakeProfitPreview(position, snapshot.portfolio, snapshot.positions, {
      sell_pct: sellQtyParam ? undefined : sellPct,
      sell_qty: sellQtyParam ? Number(sellQtyParam) : undefined,
    });

    return NextResponse.json({ preview });
  } catch (error) {
    if (error instanceof LSPortfolioServiceError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    return tradeErrorResponse(error);
  }
}
