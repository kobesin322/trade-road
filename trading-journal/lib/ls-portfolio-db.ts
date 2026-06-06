import { and, desc, eq } from "drizzle-orm";

import { portfolioEvents, portfolios, positions, type PortfolioRow, type PositionRow } from "@/db/schema";
import { getDb } from "@/lib/db";
import type { Portfolio, PortfolioEvent, Position } from "@/lib/ls-portfolio-types";

function num(value: string | number | null | undefined) {
  return Number(value ?? 0);
}

function ts(value: Date | string) {
  return value instanceof Date ? value.toISOString() : String(value);
}

export function rowToPortfolio(row: PortfolioRow): Portfolio {
  return {
    id: row.id,
    user_id: row.userId,
    name: row.name,
    target_long_ratio: num(row.targetLongRatio),
    target_short_ratio: num(row.targetShortRatio),
    long_cash: num(row.longCash),
    short_cash: num(row.shortCash),
    notes: row.notes,
    created_at: ts(row.createdAt),
    updated_at: ts(row.updatedAt),
  };
}

export function rowToPosition(row: PositionRow): Position {
  return {
    id: row.id,
    portfolio_id: row.portfolioId,
    side: row.side,
    symbol: row.symbol,
    quantity: num(row.quantity),
    avg_entry_price: num(row.avgEntryPrice),
    current_price: num(row.currentPrice),
    stop_loss_price: row.stopLossPrice ? num(row.stopLossPrice) : null,
    target_price: row.targetPrice ? num(row.targetPrice) : null,
    notes: row.notes,
    created_at: ts(row.createdAt),
    updated_at: ts(row.updatedAt),
  };
}

export async function getOrCreatePortfolio(userId: string) {
  const db = getDb();
  const [existing] = await db
    .select()
    .from(portfolios)
    .where(eq(portfolios.userId, userId))
    .limit(1);

  if (existing) {
    return rowToPortfolio(existing);
  }

  const [created] = await db
    .insert(portfolios)
    .values({
      userId,
      targetLongRatio: "0.600",
      targetShortRatio: "0.400",
      longCash: "2500.00",
      shortCash: "1400.00",
    })
    .returning();

  if (!created) {
    throw new Error("Unable to create portfolio.");
  }
  return rowToPortfolio(created);
}

export async function getPortfolioSnapshot(userId: string) {
  const portfolio = await getOrCreatePortfolio(userId);
  const db = getDb();

  const positionRows = await db
    .select()
    .from(positions)
    .where(eq(positions.portfolioId, portfolio.id))
    .orderBy(positions.symbol);

  const eventRows = await db
    .select()
    .from(portfolioEvents)
    .where(eq(portfolioEvents.portfolioId, portfolio.id))
    .orderBy(desc(portfolioEvents.createdAt))
    .limit(20);

  return {
    portfolio,
    positions: positionRows.map(rowToPosition),
    events: eventRows.map((row) => ({
      id: row.id,
      portfolio_id: row.portfolioId,
      event_type: row.eventType,
      position_id: row.positionId,
      payload: row.payload ?? null,
      created_at: ts(row.createdAt),
    })) satisfies PortfolioEvent[],
  };
}

export async function updatePortfolio(
  userId: string,
  portfolioId: string,
  patch: Partial<{
    name: string;
    target_long_ratio: number;
    target_short_ratio: number;
    long_cash: number;
    short_cash: number;
    notes: string | null;
  }>,
) {
  const db = getDb();
  const [row] = await db
    .update(portfolios)
    .set({
      ...(patch.name !== undefined ? { name: patch.name } : {}),
      ...(patch.target_long_ratio !== undefined
        ? { targetLongRatio: String(patch.target_long_ratio) }
        : {}),
      ...(patch.target_short_ratio !== undefined
        ? { targetShortRatio: String(patch.target_short_ratio) }
        : {}),
      ...(patch.long_cash !== undefined ? { longCash: String(patch.long_cash) } : {}),
      ...(patch.short_cash !== undefined ? { shortCash: String(patch.short_cash) } : {}),
      ...(patch.notes !== undefined ? { notes: patch.notes } : {}),
    })
    .where(and(eq(portfolios.id, portfolioId), eq(portfolios.userId, userId)))
    .returning();

  return row ? rowToPortfolio(row) : null;
}

export async function insertPosition(
  portfolioId: string,
  input: Omit<Position, "id" | "portfolio_id" | "created_at" | "updated_at">,
) {
  const db = getDb();
  const [row] = await db
    .insert(positions)
    .values({
      portfolioId,
      side: input.side,
      symbol: input.symbol.toUpperCase(),
      quantity: String(input.quantity),
      avgEntryPrice: String(input.avg_entry_price),
      currentPrice: String(input.current_price),
      stopLossPrice: input.stop_loss_price ? String(input.stop_loss_price) : null,
      targetPrice: input.target_price ? String(input.target_price) : null,
      notes: input.notes,
    })
    .returning();

  return row ? rowToPosition(row) : null;
}

export async function updatePosition(
  userId: string,
  positionId: string,
  patch: Partial<{
    quantity: number;
    avg_entry_price: number;
    current_price: number;
    stop_loss_price: number | null;
    target_price: number | null;
    notes: string | null;
    symbol: string;
  }>,
) {
  const db = getDb();
  const portfolio = await getOrCreatePortfolio(userId);

  const [row] = await db
    .update(positions)
    .set({
      ...(patch.quantity !== undefined ? { quantity: String(patch.quantity) } : {}),
      ...(patch.avg_entry_price !== undefined
        ? { avgEntryPrice: String(patch.avg_entry_price) }
        : {}),
      ...(patch.current_price !== undefined ? { currentPrice: String(patch.current_price) } : {}),
      ...(patch.stop_loss_price !== undefined
        ? { stopLossPrice: patch.stop_loss_price ? String(patch.stop_loss_price) : null }
        : {}),
      ...(patch.target_price !== undefined
        ? { targetPrice: patch.target_price ? String(patch.target_price) : null }
        : {}),
      ...(patch.notes !== undefined ? { notes: patch.notes } : {}),
      ...(patch.symbol !== undefined ? { symbol: patch.symbol.toUpperCase() } : {}),
    })
    .where(and(eq(positions.id, positionId), eq(positions.portfolioId, portfolio.id)))
    .returning();

  return row ? rowToPosition(row) : null;
}

export async function deletePosition(userId: string, positionId: string) {
  const db = getDb();
  const portfolio = await getOrCreatePortfolio(userId);
  const deleted = await db
    .delete(positions)
    .where(and(eq(positions.id, positionId), eq(positions.portfolioId, portfolio.id)))
    .returning({ id: positions.id, symbol: positions.symbol });

  return deleted[0] ?? null;
}

export async function logPortfolioEvent(
  portfolioId: string,
  event: {
    event_type: string;
    position_id?: string | null;
    payload?: Record<string, unknown>;
  },
) {
  const db = getDb();
  const [row] = await db
    .insert(portfolioEvents)
    .values({
      portfolioId,
      eventType: event.event_type,
      positionId: event.position_id ?? null,
      payload: event.payload,
    })
    .returning();

  if (!row) {
    return null;
  }
  return {
    id: row.id,
    portfolio_id: row.portfolioId,
    event_type: row.eventType,
    position_id: row.positionId,
    payload: row.payload ?? null,
    created_at: ts(row.createdAt),
  } satisfies PortfolioEvent;
}

export async function clearPortfolioPositions(userId: string) {
  const portfolio = await getOrCreatePortfolio(userId);
  const db = getDb();
  await db.delete(positions).where(eq(positions.portfolioId, portfolio.id));
  await db.delete(portfolioEvents).where(eq(portfolioEvents.portfolioId, portfolio.id));
  return portfolio;
}
