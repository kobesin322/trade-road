import type { TradeInsert } from "@/db/schema";

import { sampleTrades } from "./trades";

export function buildSampleTradeRows(userId: string): TradeInsert[] {
  return sampleTrades.map((trade) => ({
    userId,
    pair: trade.pair,
    date: new Date(`${trade.date}T15:00:00.000Z`),
    outcome: trade.outcome,
    profitPercent: String(trade.profitPercent),
    profitAmount: String(trade.profitAmount),
    strategy: trade.strategy,
    position: trade.position,
    notes: null,
    journalHtml: null,
    screenshots: [],
    chartData: trade.chartData,
  }));
}