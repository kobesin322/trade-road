import { NextResponse } from "next/server";

import { TradeServiceError } from "@/lib/trade-service";

export function tradeErrorResponse(error: unknown) {
  if (error instanceof TradeServiceError) {
    return NextResponse.json({ error: error.message }, { status: error.status });
  }

  const message = error instanceof Error ? error.message : "Unexpected server error.";
  return NextResponse.json({ error: message }, { status: 500 });
}
