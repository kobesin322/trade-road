import { NextResponse } from "next/server";

import { tradeErrorResponse } from "@/lib/api/trade-route";
import {
  buildBetaReferenceSummary,
  resolveReferenceRows,
} from "@/lib/ls-portfolio-beta-reference";
import { computeAllPositions, computePools } from "@/lib/ls-portfolio";
import {
  LSPortfolioServiceError,
  loadPortfolioForUser,
  normalizeSnapshotDate,
  requirePortfolioUser,
} from "@/lib/ls-portfolio-service";

export async function GET(request: Request) {
  try {
    const user = await requirePortfolioUser();
    const url = new URL(request.url);
    const date = normalizeSnapshotDate(url.searchParams.get("date"));
    const snapshot = await loadPortfolioForUser(user.id, date);
    const pools = computePools(snapshot.positions, snapshot.portfolio);
    const computed = computeAllPositions(snapshot.positions, snapshot.portfolio);
    const symbols = computed.map((p) => p.symbol);
    const references = await resolveReferenceRows(symbols);
    const summary = buildBetaReferenceSummary(computed, references, pools.total_pool);

    return NextResponse.json(summary);
  } catch (error) {
    if (error instanceof LSPortfolioServiceError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    return tradeErrorResponse(error);
  }
}
