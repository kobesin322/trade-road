import { NextResponse } from "next/server";

import { UserJournalStrategyServiceError } from "@/lib/user-journal-strategy-service";

export function journalStrategyErrorResponse(error: unknown) {
  if (error instanceof UserJournalStrategyServiceError) {
    return NextResponse.json({ error: error.message }, { status: error.status });
  }

  const message = error instanceof Error ? error.message : "Unexpected server error.";
  if (message.includes("unique") || message.includes("duplicate key")) {
    return NextResponse.json({ error: "You already have a strategy with that name." }, { status: 409 });
  }

  return NextResponse.json({ error: message }, { status: 500 });
}
