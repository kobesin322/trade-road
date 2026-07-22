import { revalidatePath } from "next/cache";
import { NextResponse } from "next/server";

import { tradeErrorResponse } from "@/lib/api/trade-route";
import {
  createPersonalTrade,
  listPersonalTrades,
  parseTradeInput,
  requirePersonalJournalUser,
  toPublicTrade,
} from "@/lib/trade-service";

export async function GET() {
  try {
    const user = await requirePersonalJournalUser();
    const trades = await listPersonalTrades(user.id);
    return NextResponse.json({ trades: trades.map(toPublicTrade) });
  } catch (error) {
    return tradeErrorResponse(error);
  }
}

export async function POST(request: Request) {
  try {
    const user = await requirePersonalJournalUser();
    const input = parseTradeInput(await request.json());
    const trade = await createPersonalTrade(user.id, input);

    if (!trade) {
      return NextResponse.json({ error: "Trade was not created." }, { status: 500 });
    }

    revalidatePath("/app");
    return NextResponse.json({ trade: toPublicTrade(trade) }, { status: 201 });
  } catch (error) {
    return tradeErrorResponse(error);
  }
}
