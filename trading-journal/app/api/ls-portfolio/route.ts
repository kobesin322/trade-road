import { NextResponse } from "next/server";

import { tradeErrorResponse } from "@/lib/api/trade-route";
import {
  LSPortfolioServiceError,
  loadPortfolioForUser,
  requirePortfolioUser,
} from "@/lib/ls-portfolio-service";
import { updatePortfolio } from "@/lib/ls-portfolio-db";

export async function GET() {
  try {
    const user = await requirePortfolioUser();
    const snapshot = await loadPortfolioForUser(user.id);
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
    const snapshot = await loadPortfolioForUser(user.id);
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
    });
    if (!updated) {
      return NextResponse.json({ error: "Portfolio not found." }, { status: 404 });
    }
    return NextResponse.json(await loadPortfolioForUser(user.id));
  } catch (error) {
    if (error instanceof LSPortfolioServiceError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    return tradeErrorResponse(error);
  }
}
