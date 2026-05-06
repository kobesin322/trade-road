import { asc, eq } from "drizzle-orm";

import { type TradeRow, trades } from "@/db/schema";
import { getDb } from "@/lib/db";
import type { Trade, TradeOutcome } from "@/lib/trades";

function normalizePosition(value: string | null): Trade["position"] {
  if (value === "SHORT") {
    return "SHORT";
  }
  if (value === "LONG") {
    return "LONG";
  }
  return "LONG";
}

export function rowToTrade(row: TradeRow): Trade {
  const dateIso =
    row.date instanceof Date ? row.date.toISOString() : String(row.date);

  return {
    id: row.id,
    pair: row.pair,
    date: dateIso.slice(0, 10),
    outcome: row.outcome as TradeOutcome,
    profitPercent: Number(row.profitPercent),
    profitAmount: Number(row.profitAmount),
    strategy: row.strategy as Trade["strategy"],
    position: normalizePosition(row.position),
    chartData: Array.isArray(row.chartData) ? (row.chartData as Trade["chartData"]) : [],
  };
}

export async function listTradesForUser(userId: string) {
  const db = getDb();
  const rows = await db
    .select()
    .from(trades)
    .where(eq(trades.userId, userId))
    .orderBy(asc(trades.date), asc(trades.pair));

  return rows.map(rowToTrade);
}
