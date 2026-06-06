import { NextResponse } from "next/server";

import { tradeErrorResponse } from "@/lib/api/trade-route";
import {
  getPortfolioSnapshot,
  insertPosition,
  logPortfolioEvent,
} from "@/lib/ls-portfolio-db";
import {
  LSPortfolioServiceError,
  loadPortfolioForUser,
  requirePortfolioUser,
} from "@/lib/ls-portfolio-service";
import type { PositionSide } from "@/lib/ls-portfolio-types";

export async function POST(request: Request) {
  try {
    const user = await requirePortfolioUser();
    const body = (await request.json()) as Record<string, unknown>;
    const snapshot = await getPortfolioSnapshot(user.id);

    const side = body.side as PositionSide;
    const symbol = String(body.symbol ?? "").trim().toUpperCase();
    const quantity = Number(body.quantity);
    const avg_entry_price = Number(body.avg_entry_price);
    const current_price = Number(body.current_price ?? body.avg_entry_price);

    if (!symbol || !Number.isFinite(quantity) || quantity <= 0) {
      return NextResponse.json({ error: "Valid symbol and quantity required." }, { status: 400 });
    }
    if (!Number.isFinite(avg_entry_price) || avg_entry_price <= 0) {
      return NextResponse.json({ error: "Valid entry price required." }, { status: 400 });
    }
    if (side !== "long" && side !== "short") {
      return NextResponse.json({ error: "Side must be long or short." }, { status: 400 });
    }

    const position = await insertPosition(snapshot.portfolio.id, {
      side,
      symbol,
      quantity,
      avg_entry_price,
      current_price,
      stop_loss_price: body.stop_loss_price ? Number(body.stop_loss_price) : null,
      target_price: body.target_price ? Number(body.target_price) : null,
      notes: typeof body.notes === "string" ? body.notes : null,
    });

    if (!position) {
      return NextResponse.json({ error: "Unable to add position." }, { status: 500 });
    }

    await logPortfolioEvent(snapshot.portfolio.id, {
      event_type: "ADD_POSITION",
      position_id: position.id,
      payload: {
        symbol: position.symbol,
        side: position.side,
        quantity: position.quantity,
        avg_entry_price: position.avg_entry_price,
      },
    });

    return NextResponse.json(await loadPortfolioForUser(user.id), { status: 201 });
  } catch (error) {
    if (error instanceof LSPortfolioServiceError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    return tradeErrorResponse(error);
  }
}
