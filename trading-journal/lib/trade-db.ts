import { asc, eq } from "drizzle-orm";

import { type TradeRow, trades } from "@/db/schema";
import { getDb } from "@/lib/db";
import { normalizeJournalStrategy, type TradeScreenshot } from "@/lib/journal-constants";
import type { Trade, TradeOutcome } from "@/lib/trades";

function normalizePosition(value: string | null): Trade["position"] {
  if (value === "SHORT") {
    return "SHORT";
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
    strategy: normalizeJournalStrategy(row.strategy),
    position: normalizePosition(row.position),
    notes: row.notes ?? null,
    journalHtml: row.journalHtml ?? null,
    screenshots: Array.isArray(row.screenshots) ? row.screenshots : [],
    chartData: Array.isArray(row.chartData) ? (row.chartData as Trade["chartData"]) : [],
  };
}

export type TradeRecord = Trade & {
  createdAt: string;
  updatedAt: string;
};

export function rowToTradeRecord(row: TradeRow): TradeRecord {
  const trade = rowToTrade(row);
  const createdAt =
    row.createdAt instanceof Date ? row.createdAt.toISOString() : String(row.createdAt);
  const updatedAt =
    row.updatedAt instanceof Date ? row.updatedAt.toISOString() : String(row.updatedAt);

  return {
    ...trade,
    createdAt,
    updatedAt,
  };
}

export function tradeRecordToTrade(record: TradeRecord): Trade {
  return {
    id: record.id,
    pair: record.pair,
    date: record.date,
    outcome: record.outcome,
    profitPercent: record.profitPercent,
    profitAmount: record.profitAmount,
    strategy: record.strategy,
    position: record.position,
    notes: record.notes,
    journalHtml: record.journalHtml,
    screenshots: record.screenshots,
    chartData: record.chartData,
  };
}

export async function getTradeForUser(userId: string, tradeId: string) {
  const db = getDb();
  const [row] = await db
    .select()
    .from(trades)
    .where(eq(trades.id, tradeId))
    .limit(1);

  if (!row || row.userId !== userId) {
    return null;
  }

  return rowToTradeRecord(row);
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

export type { TradeScreenshot };
