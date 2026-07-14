import { NextResponse } from "next/server";

import { tradeErrorResponse } from "@/lib/api/trade-route";
import { buildPortfolioSummary } from "@/lib/ls-portfolio-summary";
import { RS_DEFAULT_RANGE } from "@/lib/ls-portfolio-relative-strength";
import {
  LSPortfolioServiceError,
  loadPortfolioForUser,
  normalizeSnapshotDate,
  requirePortfolioUser,
} from "@/lib/ls-portfolio-service";

export async function GET(request: Request) {
  try {
    const user = await requirePortfolioUser();
    const { searchParams } = new URL(request.url);
    const date = normalizeSnapshotDate(searchParams.get("date"));
    const rsRange = searchParams.get("rs_range") ?? RS_DEFAULT_RANGE;
    const snapshot = await loadPortfolioForUser(user.id, date);
    const summary = await buildPortfolioSummary(snapshot.positions, snapshot.portfolio, {
      includeRelativeStrength: true,
      rsRange,
    });

    return NextResponse.json(summary);
  } catch (error) {
    if (error instanceof LSPortfolioServiceError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    return tradeErrorResponse(error);
  }
}
