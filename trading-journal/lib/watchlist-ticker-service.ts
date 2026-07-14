import { and, asc, eq } from "drizzle-orm";

import { userWatchlistTickers, type UserWatchlistTickerRow } from "@/db/schema";
import { getSessionUser, isAdminDemoUser } from "@/lib/auth";
import { getDb } from "@/lib/db";
import {
  createWatchlistItemFromSymbol,
  isBuiltInWatchlistItem,
  isMarketSymbolFormat,
  type WatchlistTickerInput,
  type WatchlistTickerPatch,
} from "@/lib/market-data/custom-watchlist";
import type { WatchlistItem } from "@/lib/market-data/symbols";

export type { WatchlistTickerInput, WatchlistTickerPatch } from "@/lib/market-data/custom-watchlist";

export class WatchlistTickerServiceError extends Error {
  status: number;

  constructor(message: string, status = 400) {
    super(message);
    this.status = status;
  }
}

export async function requirePersonalWatchlistUser() {
  const user = await getSessionUser();
  if (!user) {
    throw new WatchlistTickerServiceError("Unauthorized", 401);
  }
  if (isAdminDemoUser(user)) {
    throw new WatchlistTickerServiceError(
      "Admin demo cannot access personal watchlist records. Sign in with a Supabase account.",
      403,
    );
  }
  if (!process.env.DATABASE_URL) {
    throw new WatchlistTickerServiceError("Database is not configured.", 503);
  }
  return user;
}

export function rowToWatchlistItem(row: UserWatchlistTickerRow): WatchlistItem {
  return {
    id: row.id,
    label: row.label,
    yahooSymbol: row.yahooSymbol,
    tradingViewSymbol: row.tradingViewSymbol,
    assetClass: row.assetClass === "crypto" ? "crypto" : "stock",
  };
}

function normalizeInput(input: WatchlistTickerInput): WatchlistTickerInput {
  const yahooSymbol = input.yahooSymbol.trim().toUpperCase();
  if (!isMarketSymbolFormat(yahooSymbol)) {
    throw new WatchlistTickerServiceError("yahooSymbol must be a valid market symbol.");
  }

  const label = input.label.trim();
  if (!label) {
    throw new WatchlistTickerServiceError("label is required.");
  }

  const tradingViewSymbol = input.tradingViewSymbol.trim();
  if (!tradingViewSymbol) {
    throw new WatchlistTickerServiceError("tradingViewSymbol is required.");
  }

  if (input.assetClass !== "crypto" && input.assetClass !== "stock") {
    throw new WatchlistTickerServiceError("assetClass must be crypto or stock.");
  }

  const candidate = createWatchlistItemFromSymbol(yahooSymbol, {
    label,
    assetClass: input.assetClass,
    exchange: input.exchange ?? undefined,
  });

  if (isBuiltInWatchlistItem(candidate)) {
    throw new WatchlistTickerServiceError(
      `${yahooSymbol} is already included in the default dashboard watchlist.`,
      409,
    );
  }

  return {
    yahooSymbol,
    label,
    tradingViewSymbol,
    assetClass: input.assetClass,
    quoteType: input.quoteType?.trim() || null,
    exchange: input.exchange?.trim() || null,
    sortOrder:
      typeof input.sortOrder === "number" && Number.isFinite(input.sortOrder)
        ? Math.max(0, Math.floor(input.sortOrder))
        : 0,
  };
}

export function parseWatchlistTickerInput(body: unknown): WatchlistTickerInput {
  if (!body || typeof body !== "object") {
    throw new WatchlistTickerServiceError("Request body must be a JSON object.");
  }

  const candidate = body as Partial<WatchlistTickerInput>;
  if (!candidate.yahooSymbol?.trim()) {
    throw new WatchlistTickerServiceError("yahooSymbol is required.");
  }
  if (!candidate.label?.trim()) {
    throw new WatchlistTickerServiceError("label is required.");
  }
  if (!candidate.tradingViewSymbol?.trim()) {
    throw new WatchlistTickerServiceError("tradingViewSymbol is required.");
  }
  if (candidate.assetClass !== "crypto" && candidate.assetClass !== "stock") {
    throw new WatchlistTickerServiceError("assetClass must be crypto or stock.");
  }

  return normalizeInput({
    yahooSymbol: candidate.yahooSymbol,
    label: candidate.label,
    tradingViewSymbol: candidate.tradingViewSymbol,
    assetClass: candidate.assetClass,
    quoteType: candidate.quoteType ?? null,
    exchange: candidate.exchange ?? null,
    sortOrder: candidate.sortOrder,
  });
}

export function parseWatchlistTickerPatch(body: unknown): WatchlistTickerPatch {
  if (!body || typeof body !== "object") {
    throw new WatchlistTickerServiceError("Request body must be a JSON object.");
  }

  const candidate = body as Partial<WatchlistTickerPatch>;
  const patch: WatchlistTickerPatch = {};

  if (candidate.label !== undefined) {
    const label = candidate.label.trim();
    if (!label) {
      throw new WatchlistTickerServiceError("label cannot be empty.");
    }
    patch.label = label;
  }

  if (candidate.sortOrder !== undefined) {
    if (!Number.isFinite(candidate.sortOrder)) {
      throw new WatchlistTickerServiceError("sortOrder must be a number.");
    }
    patch.sortOrder = Math.max(0, Math.floor(candidate.sortOrder));
  }

  if (!Object.keys(patch).length) {
    throw new WatchlistTickerServiceError("No valid fields to update.");
  }

  return patch;
}

export async function listUserWatchlistTickers(userId: string) {
  const db = getDb();
  const rows = await db
    .select()
    .from(userWatchlistTickers)
    .where(eq(userWatchlistTickers.userId, userId))
    .orderBy(asc(userWatchlistTickers.sortOrder), asc(userWatchlistTickers.createdAt));

  return rows.map(rowToWatchlistItem);
}

export async function getUserWatchlistTicker(userId: string, id: string) {
  const db = getDb();
  const [row] = await db
    .select()
    .from(userWatchlistTickers)
    .where(and(eq(userWatchlistTickers.userId, userId), eq(userWatchlistTickers.id, id)))
    .limit(1);

  return row ? rowToWatchlistItem(row) : null;
}

export async function createUserWatchlistTicker(userId: string, input: WatchlistTickerInput) {
  const normalized = normalizeInput(input);
  const db = getDb();

  const [row] = await db
    .insert(userWatchlistTickers)
    .values({
      userId,
      yahooSymbol: normalized.yahooSymbol,
      label: normalized.label,
      tradingViewSymbol: normalized.tradingViewSymbol,
      assetClass: normalized.assetClass,
      quoteType: normalized.quoteType,
      exchange: normalized.exchange,
      sortOrder: normalized.sortOrder ?? 0,
    })
    .onConflictDoNothing({
      target: [userWatchlistTickers.userId, userWatchlistTickers.yahooSymbol],
    })
    .returning();

  if (row) {
    return rowToWatchlistItem(row);
  }

  const [existing] = await db
    .select()
    .from(userWatchlistTickers)
    .where(
      and(
        eq(userWatchlistTickers.userId, userId),
        eq(userWatchlistTickers.yahooSymbol, normalized.yahooSymbol),
      ),
    )
    .limit(1);

  if (!existing) {
    throw new WatchlistTickerServiceError("Ticker could not be saved.", 500);
  }

  return rowToWatchlistItem(existing);
}

export async function updateUserWatchlistTicker(
  userId: string,
  id: string,
  patch: WatchlistTickerPatch,
) {
  const db = getDb();
  const [row] = await db
    .update(userWatchlistTickers)
    .set({
      ...(patch.label !== undefined ? { label: patch.label } : {}),
      ...(patch.sortOrder !== undefined ? { sortOrder: patch.sortOrder } : {}),
    })
    .where(and(eq(userWatchlistTickers.userId, userId), eq(userWatchlistTickers.id, id)))
    .returning();

  return row ? rowToWatchlistItem(row) : null;
}

export async function deleteUserWatchlistTicker(userId: string, id: string) {
  const db = getDb();
  const [row] = await db
    .delete(userWatchlistTickers)
    .where(and(eq(userWatchlistTickers.userId, userId), eq(userWatchlistTickers.id, id)))
    .returning({ id: userWatchlistTickers.id });

  return Boolean(row);
}

export async function listUserWatchlistSymbols(userId: string) {
  const items = await listUserWatchlistTickers(userId);
  return items.map((item) => item.yahooSymbol);
}
