import { revalidatePath } from "next/cache";
import { NextResponse } from "next/server";

import { tradeErrorResponse } from "@/lib/api/trade-route";
import {
  deletePersonalTrade,
  getPersonalTrade,
  parseTradePatch,
  requirePersonalJournalUser,
  toPublicTrade,
  updatePersonalTrade,
} from "@/lib/trade-service";

type RouteContext = {
  params: Promise<{ id: string }>;
};

export async function GET(_request: Request, context: RouteContext) {
  try {
    const user = await requirePersonalJournalUser();
    const { id } = await context.params;
    const trade = await getPersonalTrade(user.id, id);

    if (!trade) {
      return NextResponse.json({ error: "Trade not found." }, { status: 404 });
    }

    return NextResponse.json({ trade: toPublicTrade(trade) });
  } catch (error) {
    return tradeErrorResponse(error);
  }
}

export async function PATCH(request: Request, context: RouteContext) {
  try {
    const user = await requirePersonalJournalUser();
    const { id } = await context.params;
    const patch = parseTradePatch(await request.json());
    const trade = await updatePersonalTrade(user.id, id, patch);

    if (!trade) {
      return NextResponse.json({ error: "Trade not found." }, { status: 404 });
    }

    revalidatePath("/");
    return NextResponse.json({ trade: toPublicTrade(trade) });
  } catch (error) {
    return tradeErrorResponse(error);
  }
}

export async function DELETE(_request: Request, context: RouteContext) {
  try {
    const user = await requirePersonalJournalUser();
    const { id } = await context.params;
    const deleted = await deletePersonalTrade(user.id, id);

    if (!deleted) {
      return NextResponse.json({ error: "Trade not found." }, { status: 404 });
    }

    revalidatePath("/");
    return NextResponse.json({ ok: true });
  } catch (error) {
    return tradeErrorResponse(error);
  }
}
