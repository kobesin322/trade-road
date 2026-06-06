import { NextResponse } from "next/server";

import { tradeErrorResponse } from "@/lib/api/trade-route";
import {
  deletePosition,
  getPortfolioSnapshot,
  logPortfolioEvent,
  updatePosition,
} from "@/lib/ls-portfolio-db";
import {
  LSPortfolioServiceError,
  loadPortfolioForUser,
  requirePortfolioUser,
} from "@/lib/ls-portfolio-service";

type RouteContext = { params: Promise<{ id: string }> };

export async function PATCH(request: Request, context: RouteContext) {
  try {
    const user = await requirePortfolioUser();
    const { id } = await context.params;
    const body = (await request.json()) as Record<string, unknown>;
    const snapshot = await getPortfolioSnapshot(user.id);
    const existing = snapshot.positions.find((p) => p.id === id);
    if (!existing) {
      return NextResponse.json({ error: "Position not found." }, { status: 404 });
    }

    const updated = await updatePosition(user.id, id, {
      ...(body.quantity !== undefined ? { quantity: Number(body.quantity) } : {}),
      ...(body.avg_entry_price !== undefined
        ? { avg_entry_price: Number(body.avg_entry_price) }
        : {}),
      ...(body.current_price !== undefined ? { current_price: Number(body.current_price) } : {}),
      ...(body.stop_loss_price !== undefined
        ? { stop_loss_price: body.stop_loss_price ? Number(body.stop_loss_price) : null }
        : {}),
      ...(body.target_price !== undefined
        ? { target_price: body.target_price ? Number(body.target_price) : null }
        : {}),
      ...(body.notes !== undefined ? { notes: body.notes as string | null } : {}),
      ...(body.symbol !== undefined ? { symbol: String(body.symbol) } : {}),
    });

    if (!updated) {
      return NextResponse.json({ error: "Unable to update position." }, { status: 500 });
    }

    const eventType =
      body.current_price !== undefined && Object.keys(body).length === 1
        ? "PRICE_UPDATE"
        : "MANUAL_EDIT";

    await logPortfolioEvent(snapshot.portfolio.id, {
      event_type: eventType,
      position_id: id,
      payload: {
        symbol: updated.symbol,
        ...body,
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

export async function DELETE(_request: Request, context: RouteContext) {
  try {
    const user = await requirePortfolioUser();
    const { id } = await context.params;
    const snapshot = await getPortfolioSnapshot(user.id);
    const existing = snapshot.positions.find((p) => p.id === id);
    if (!existing) {
      return NextResponse.json({ error: "Position not found." }, { status: 404 });
    }

    await deletePosition(user.id, id);
    await logPortfolioEvent(snapshot.portfolio.id, {
      event_type: "DELETE_POSITION",
      position_id: id,
      payload: { symbol: existing.symbol, side: existing.side },
    });

    return NextResponse.json(await loadPortfolioForUser(user.id));
  } catch (error) {
    if (error instanceof LSPortfolioServiceError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    return tradeErrorResponse(error);
  }
}
