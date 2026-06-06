import { NextResponse } from "next/server";

import { tradeErrorResponse } from "@/lib/api/trade-route";
import {
  getPortfolioSnapshot,
  logPortfolioEvent,
  updatePortfolio,
} from "@/lib/ls-portfolio-db";
import { calculateRebalancePreview } from "@/lib/ls-portfolio";
import {
  LSPortfolioServiceError,
  loadPortfolioForUser,
  normalizeSnapshotDate,
  requirePortfolioUser,
} from "@/lib/ls-portfolio-service";

export async function POST(request: Request) {
  try {
    const user = await requirePortfolioUser();
    const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
    const date = normalizeSnapshotDate(typeof body.date === "string" ? body.date : null);
    const snapshot = await getPortfolioSnapshot(user.id, date);
    const preview = calculateRebalancePreview(snapshot.portfolio, snapshot.positions);

    if (preview.direction === "none" || preview.transfer_amount <= 0) {
      return NextResponse.json({ error: "Snapshot is already at target ratio." }, { status: 400 });
    }

    const long_cash = preview.after.long_pool - preview.after.long_mv;
    const short_cash = preview.after.short_pool - preview.after.short_mv;

    await updatePortfolio(user.id, snapshot.portfolio.id, { long_cash, short_cash });
    await logPortfolioEvent(snapshot.portfolio.id, {
      event_type: "REBALANCE_CASH",
      payload: {
        snapshot_date: date,
        direction: preview.direction,
        transfer_amount: preview.transfer_amount,
        long_pool_after: preview.after.long_pool,
        short_pool_after: preview.after.short_pool,
      },
    });

    return NextResponse.json(await loadPortfolioForUser(user.id, date));
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
    const date = normalizeSnapshotDate(searchParams.get("date"));
    const snapshot = await getPortfolioSnapshot(user.id, date);
    const preview = calculateRebalancePreview(snapshot.portfolio, snapshot.positions);
    return NextResponse.json({ preview });
  } catch (error) {
    if (error instanceof LSPortfolioServiceError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    return tradeErrorResponse(error);
  }
}
