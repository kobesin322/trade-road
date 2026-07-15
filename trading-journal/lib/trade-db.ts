import { asc, eq, inArray } from "drizzle-orm";

import { type TradeLevelPushRow, type TradeRow, tradeLevelPushes, trades } from "@/db/schema";
import { getDb } from "@/lib/db";
import {
  normalizeJournalStrategy,
  type TradeLevelPush,
  type TradeScreenshot,
} from "@/lib/journal-constants";
import type { Trade, TradeOutcome } from "@/lib/trades";

function normalizePosition(value: string | null): Trade["position"] {
  if (value === "SHORT") {
    return "SHORT";
  }
  return "LONG";
}

function optionalNumber(value: string | null | undefined) {
  if (value === null || value === undefined || value === "") {
    return null;
  }

  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

export function rowToLevelPush(row: TradeLevelPushRow): TradeLevelPush {
  const pushedAt =
    row.pushedAt instanceof Date ? row.pushedAt.toISOString() : String(row.pushedAt);

  return {
    id: row.id,
    levelType: row.levelType === "TP" ? "TP" : "SL",
    price: Number(row.price),
    pushedAt,
    note: row.note ?? null,
  };
}

export function rowToTrade(row: TradeRow, levelPushes: TradeLevelPush[] = []): Trade {
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
    stopLoss: optionalNumber(row.stopLoss),
    takeProfit: optionalNumber(row.takeProfit),
    riskRewardRatio: optionalNumber(row.riskRewardRatio),
    levelPushes,
    journalHtml: row.journalHtml ?? null,
    screenshots: Array.isArray(row.screenshots) ? row.screenshots : [],
    chartData: Array.isArray(row.chartData) ? (row.chartData as Trade["chartData"]) : [],
  };
}

export type TradeRecord = Trade & {
  createdAt: string;
  updatedAt: string;
};

export function rowToTradeRecord(row: TradeRow, levelPushes: TradeLevelPush[] = []): TradeRecord {
  const trade = rowToTrade(row, levelPushes);
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
    stopLoss: record.stopLoss,
    takeProfit: record.takeProfit,
    riskRewardRatio: record.riskRewardRatio,
    levelPushes: record.levelPushes ?? [],
    journalHtml: record.journalHtml,
    screenshots: record.screenshots,
    chartData: record.chartData,
  };
}

export async function listLevelPushesForTradeIds(tradeIds: string[]) {
  if (!tradeIds.length) {
    return new Map<string, TradeLevelPush[]>();
  }

  const db = getDb();
  const rows = await db
    .select()
    .from(tradeLevelPushes)
    .where(inArray(tradeLevelPushes.tradeId, tradeIds))
    .orderBy(asc(tradeLevelPushes.sortOrder), asc(tradeLevelPushes.pushedAt));

  const grouped = new Map<string, TradeLevelPush[]>();
  for (const row of rows) {
    const push = rowToLevelPush(row);
    const current = grouped.get(row.tradeId) ?? [];
    current.push(push);
    grouped.set(row.tradeId, current);
  }

  return grouped;
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

  const pushesByTrade = await listLevelPushesForTradeIds([tradeId]);
  return rowToTradeRecord(row, pushesByTrade.get(tradeId) ?? []);
}

export async function listTradesForUser(userId: string) {
  const db = getDb();
  const rows = await db
    .select()
    .from(trades)
    .where(eq(trades.userId, userId))
    .orderBy(asc(trades.date), asc(trades.pair));

  const pushesByTrade = await listLevelPushesForTradeIds(rows.map((row) => row.id));
  return rows.map((row) => rowToTrade(row, pushesByTrade.get(row.id) ?? []));
}

export type { TradeScreenshot };
