"use server";

import { revalidatePath } from "next/cache";

import { getSessionUser, isAdminDemoUser } from "@/lib/auth";
import { tradeRecordToTrade } from "@/lib/trade-db";
import {
  createPersonalTrade,
  deletePersonalTrade,
  listPersonalTrades,
  type TradeInput,
  updatePersonalTrade,
} from "@/lib/trade-service";
import type { Trade } from "@/lib/trades";

export type { TradeInput };

export async function createTrade(input: TradeInput) {
  const user = await getSessionUser();
  if (!user) {
    throw new Error("Unauthorized");
  }
  if (isAdminDemoUser(user)) {
    throw new Error(
      "Admin demo cannot write to the database. Sign out and sign in with a Supabase account.",
    );
  }

  const trade = await createPersonalTrade(user.id, input);
  revalidatePath("/");
  return trade ? tradeRecordToTrade(trade) : null;
}

export async function updateTrade(
  id: string,
  patch: Partial<
    Pick<
      TradeInput,
      "pair" | "date" | "outcome" | "profitPercent" | "profitAmount" | "strategy" | "position" | "notes" | "journalHtml" | "screenshots" | "chartData"
    >
  >,
) {
  const user = await getSessionUser();
  if (!user) {
    throw new Error("Unauthorized");
  }
  if (isAdminDemoUser(user)) {
    throw new Error(
      "Admin demo cannot write to the database. Sign out and sign in with a Supabase account.",
    );
  }

  const trade = await updatePersonalTrade(user.id, id, patch);
  revalidatePath("/");
  return trade ? tradeRecordToTrade(trade) : null;
}

export async function deleteTrade(id: string) {
  const user = await getSessionUser();
  if (!user) {
    throw new Error("Unauthorized");
  }
  if (isAdminDemoUser(user)) {
    throw new Error(
      "Admin demo cannot write to the database. Sign out and sign in with a Supabase account.",
    );
  }

  await deletePersonalTrade(user.id, id);
  revalidatePath("/");
}

export async function buildTradesCsv(): Promise<string> {
  const user = await getSessionUser();
  if (!user) {
    throw new Error("Unauthorized");
  }
  if (isAdminDemoUser(user)) {
    throw new Error("Admin demo cannot export personal trades.");
  }

  const list = await listPersonalTrades(user.id);
  const headers = [
    "id",
    "pair",
    "date",
    "outcome",
    "profit_percent",
    "profit_amount",
    "strategy",
    "species",
    "position",
    "notes",
    "rating_overall",
    "rating_sizing",
    "rating_entry",
    "rating_exit",
    "entry_point",
    "journal_html",
    "screenshot_count",
  ];
  const escape = (value: string) => `"${value.replaceAll('"', '""')}"`;
  const lines = [
    headers.join(","),
    ...list.map((trade) =>
      [
        trade.id,
        trade.pair,
        trade.date,
        trade.outcome,
        String(trade.profitPercent),
        String(trade.profitAmount),
        trade.strategy,
        trade.species ?? "Stocks",
        trade.position,
        trade.notes ?? "",
        trade.ratingOverall ?? "",
        trade.ratingSizing ?? "",
        trade.ratingEntry ?? "",
        trade.ratingExit ?? "",
        trade.entryPoint ?? "",
        trade.journalHtml ?? "",
        String(trade.screenshots?.length ?? 0),
      ]
        .map((cell) => escape(String(cell)))
        .join(","),
    ),
  ];
  return lines.join("\n");
}

export async function listTradesAction() {
  const user = await getSessionUser();
  if (!user || isAdminDemoUser(user)) {
    return [] satisfies Trade[];
  }

  const tradesList = await listPersonalTrades(user.id);
  return tradesList.map(tradeRecordToTrade);
}
