import { NextResponse } from "next/server";

import { journalStrategyErrorResponse } from "@/lib/api/journal-strategy-route";
import {
  deleteUserJournalStrategy,
  getUserJournalStrategy,
  parseUserJournalStrategyPatch,
  requirePersonalJournalStrategyUser,
  updateUserJournalStrategy,
} from "@/lib/user-journal-strategy-service";

type RouteContext = {
  params: Promise<{ id: string }>;
};

export async function GET(_request: Request, context: RouteContext) {
  try {
    const user = await requirePersonalJournalStrategyUser();
    const { id } = await context.params;
    const item = await getUserJournalStrategy(user.id, id);
    if (!item) {
      return NextResponse.json({ error: "Strategy not found." }, { status: 404 });
    }
    return NextResponse.json({ item });
  } catch (error) {
    return journalStrategyErrorResponse(error);
  }
}

export async function PATCH(request: Request, context: RouteContext) {
  try {
    const user = await requirePersonalJournalStrategyUser();
    const { id } = await context.params;
    const patch = parseUserJournalStrategyPatch(await request.json());
    const item = await updateUserJournalStrategy(user.id, id, patch);
    if (!item) {
      return NextResponse.json({ error: "Strategy not found." }, { status: 404 });
    }
    return NextResponse.json({ item });
  } catch (error) {
    return journalStrategyErrorResponse(error);
  }
}

export async function DELETE(_request: Request, context: RouteContext) {
  try {
    const user = await requirePersonalJournalStrategyUser();
    const { id } = await context.params;
    const deleted = await deleteUserJournalStrategy(user.id, id);
    if (!deleted) {
      return NextResponse.json({ error: "Strategy not found." }, { status: 404 });
    }
    return NextResponse.json({ ok: true });
  } catch (error) {
    return journalStrategyErrorResponse(error);
  }
}
