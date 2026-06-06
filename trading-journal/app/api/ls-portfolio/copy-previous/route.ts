import { NextResponse } from "next/server";

import { copySnapshotFromPrevious } from "@/lib/ls-portfolio-db";
import {
  LSPortfolioServiceError,
  normalizeSnapshotDate,
  requirePortfolioUser,
} from "@/lib/ls-portfolio-service";

export async function POST(request: Request) {
  try {
    const user = await requirePortfolioUser();
    const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
    const date = normalizeSnapshotDate(
      typeof body.date === "string" ? body.date : new URL(request.url).searchParams.get("date"),
    );
    const snapshot = await copySnapshotFromPrevious(user.id, date);
    return NextResponse.json(snapshot);
  } catch (error) {
    if (error instanceof LSPortfolioServiceError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    const message = error instanceof Error ? error.message : "Copy failed.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
