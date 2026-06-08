import { NextResponse } from "next/server";

import { tradeErrorResponse } from "@/lib/api/trade-route";
import {
  LSPortfolioServiceError,
  loadPortfolioForUser,
  normalizeSnapshotDate,
  requirePortfolioUser,
} from "@/lib/ls-portfolio-service";
import { updatePortfolio } from "@/lib/ls-portfolio-db";

export async function GET(request: Request) {
  try {
    const user = await requirePortfolioUser();
    const { searchParams } = new URL(request.url);
    const date = normalizeSnapshotDate(searchParams.get("date"));
    const snapshot = await loadPortfolioForUser(user.id, date);
    return NextResponse.json(snapshot);
  } catch (error) {
    if (error instanceof LSPortfolioServiceError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    return tradeErrorResponse(error);
  }
}

export async function PATCH(request: Request) {
  try {
    const user = await requirePortfolioUser();
    const body = (await request.json()) as Record<string, unknown>;
    const date = normalizeSnapshotDate(
      typeof body.date === "string" ? body.date : new URL(request.url).searchParams.get("date"),
    );
    const snapshot = await loadPortfolioForUser(user.id, date);
    const updated = await updatePortfolio(user.id, snapshot.portfolio.id, {
      ...(typeof body.name === "string" ? { name: body.name } : {}),
      ...(typeof body.target_long_ratio === "number"
        ? {
            target_long_ratio: body.target_long_ratio,
            target_short_ratio: 1 - body.target_long_ratio,
          }
        : {}),
      ...(typeof body.long_cash === "number" ? { long_cash: body.long_cash } : {}),
      ...(typeof body.short_cash === "number" ? { short_cash: body.short_cash } : {}),
      ...(body.notes !== undefined ? { notes: body.notes as string | null } : {}),
      ...(typeof body.overtrading === "boolean" ? { overtrading: body.overtrading } : {}),
      ...(typeof body.over_focus === "boolean" ? { over_focus: body.over_focus } : {}),
      ...(typeof body.over_position === "boolean" ? { over_position: body.over_position } : {}),
      ...(typeof body.not_focusing === "boolean" ? { not_focusing: body.not_focusing } : {}),
      ...(typeof body.emotional_trading === "boolean"
        ? { emotional_trading: body.emotional_trading }
        : {}),
      ...(typeof body.market_confidence === "number"
        ? { market_confidence: body.market_confidence }
        : {}),
      ...(typeof body.self_confidence === "number" ? { self_confidence: body.self_confidence } : {}),
    });
    if (!updated) {
      return NextResponse.json({ error: "Snapshot not found." }, { status: 404 });
    }
    return NextResponse.json(await loadPortfolioForUser(user.id, date));
  } catch (error) {
    if (error instanceof LSPortfolioServiceError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    return tradeErrorResponse(error);
  }
}
