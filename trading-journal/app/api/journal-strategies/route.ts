import { NextResponse } from "next/server";

import { journalStrategyErrorResponse } from "@/lib/api/journal-strategy-route";
import {
  createUserJournalStrategy,
  listAvailableJournalStrategiesForUser,
  listUserJournalStrategies,
  parseUserJournalStrategyInput,
  requirePersonalJournalStrategyUser,
} from "@/lib/user-journal-strategy-service";

export async function GET() {
  try {
    const user = await requirePersonalJournalStrategyUser();
    const [items, available] = await Promise.all([
      listUserJournalStrategies(user.id),
      listAvailableJournalStrategiesForUser(user.id),
    ]);
    return NextResponse.json({ items, available });
  } catch (error) {
    return journalStrategyErrorResponse(error);
  }
}

export async function POST(request: Request) {
  try {
    const user = await requirePersonalJournalStrategyUser();
    const input = parseUserJournalStrategyInput(await request.json());
    const item = await createUserJournalStrategy(user.id, input);
    return NextResponse.json({ item }, { status: 201 });
  } catch (error) {
    return journalStrategyErrorResponse(error);
  }
}
