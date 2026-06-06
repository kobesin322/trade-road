import { NextResponse } from "next/server";

import { tradeErrorResponse } from "@/lib/api/trade-route";
import {
  getPortfolioSnapshot,
  logPortfolioEvent,
  updatePortfolio,
} from "@/lib/ls-portfolio-db";
import {
  LSPortfolioServiceError,
  loadPortfolioForUser,
  normalizeSnapshotDate,
  requirePortfolioUser,
} from "@/lib/ls-portfolio-service";

export async function POST(request: Request) {
  try {
    const user = await requirePortfolioUser();
    const body = (await request.json()) as Record<string, unknown>;
    const date = normalizeSnapshotDate(typeof body.date === "string" ? body.date : null);
    const pool = body.pool === "short" ? "short" : "long";
    const amount = Number(body.amount);
    const reason = typeof body.reason === "string" ? body.reason : "";

    if (!Number.isFinite(amount) || amount === 0) {
      return NextResponse.json({ error: "Non-zero amount required." }, { status: 400 });
    }

    const snapshot = await getPortfolioSnapshot(user.id, date);
    const long_cash =
      pool === "long" ? snapshot.portfolio.long_cash + amount : snapshot.portfolio.long_cash;
    const short_cash =
      pool === "short" ? snapshot.portfolio.short_cash + amount : snapshot.portfolio.short_cash;

    if (long_cash < 0 || short_cash < 0) {
      return NextResponse.json({ error: "Cash cannot go negative." }, { status: 400 });
    }

    await updatePortfolio(user.id, snapshot.portfolio.id, { long_cash, short_cash });
    await logPortfolioEvent(snapshot.portfolio.id, {
      event_type: "CASH_ADJUST",
      payload: { pool, amount, reason, snapshot_date: date },
    });

    return NextResponse.json(await loadPortfolioForUser(user.id, date));
  } catch (error) {
    if (error instanceof LSPortfolioServiceError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    return tradeErrorResponse(error);
  }
}
