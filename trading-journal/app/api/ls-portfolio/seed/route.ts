import { NextResponse } from "next/server";

import { tradeErrorResponse } from "@/lib/api/trade-route";
import {
  LSPortfolioServiceError,
  loadPortfolioForUser,
  requirePortfolioUser,
  seedDemoPortfolio,
} from "@/lib/ls-portfolio-service";

export async function POST() {
  try {
    const user = await requirePortfolioUser();
    const snapshot = await seedDemoPortfolio(user.id);
    return NextResponse.json(snapshot);
  } catch (error) {
    if (error instanceof LSPortfolioServiceError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    return tradeErrorResponse(error);
  }
}

export async function GET() {
  try {
    const user = await requirePortfolioUser();
    return NextResponse.json(await loadPortfolioForUser(user.id));
  } catch (error) {
    if (error instanceof LSPortfolioServiceError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    return tradeErrorResponse(error);
  }
}
