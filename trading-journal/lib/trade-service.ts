import { and, asc, eq } from "drizzle-orm";

import { trades } from "@/db/schema";
import { getSessionUser, isAdminDemoUser } from "@/lib/auth";
import { getDb } from "@/lib/db";
import {
  isJournalPair,
  isJournalStrategy,
  type TradeScreenshot,
} from "@/lib/journal-constants";
import {
  listUserWatchlistSymbols,
} from "@/lib/watchlist-ticker-service";
import {
  getTradeForUser,
  rowToTradeRecord,
  type TradeRecord,
} from "@/lib/trade-db";
import type { Trade, TradeOutcome } from "@/lib/trades";

export type TradeInput = {
  pair: string;
  date: string;
  outcome: TradeOutcome;
  profitPercent: number;
  profitAmount: number;
  strategy: Trade["strategy"];
  position?: Trade["position"] | null;
  notes?: string | null;
  journalHtml?: string | null;
  screenshots?: TradeScreenshot[];
  chartData?: Trade["chartData"];
};

export class TradeServiceError extends Error {
  status: number;

  constructor(message: string, status = 400) {
    super(message);
    this.status = status;
  }
}

export async function requirePersonalJournalUser() {
  const user = await getSessionUser();
  if (!user) {
    throw new TradeServiceError("Unauthorized", 401);
  }
  if (isAdminDemoUser(user)) {
    throw new TradeServiceError(
      "Admin demo cannot access personal trade records. Sign in with a Supabase account.",
      403,
    );
  }
  if (!process.env.DATABASE_URL) {
    throw new TradeServiceError("Database is not configured.", 503);
  }
  return user;
}

function assertValidOutcome(outcome: string): outcome is TradeOutcome {
  return outcome === "WIN" || outcome === "LOSS";
}

function assertValidStrategy(strategy: string): strategy is Trade["strategy"] {
  return isJournalStrategy(strategy);
}

async function assertValidPair(pair: string, userId: string) {
  const normalized = pair.trim();
  if (isJournalPair(normalized)) {
    return;
  }

  const savedSymbols = await listUserWatchlistSymbols(userId);
  if (savedSymbols.some((symbol) => symbol.toUpperCase() === normalized.toUpperCase())) {
    return;
  }

  throw new TradeServiceError(
    "pair must be one of the Charts watchlist symbols (BTC-USD, AAPL, etc.) or a saved custom ticker.",
  );
}

function parseScreenshots(value: unknown): TradeScreenshot[] | undefined {
  if (value === undefined) {
    return undefined;
  }
  if (!Array.isArray(value)) {
    throw new TradeServiceError("screenshots must be an array.");
  }

  return value.map((item, index) => {
    if (!item || typeof item !== "object") {
      throw new TradeServiceError(`screenshots[${index}] must be an object.`);
    }
    const candidate = item as Partial<TradeScreenshot>;
    if (!candidate.name?.trim() || !candidate.url?.trim()) {
      throw new TradeServiceError(`screenshots[${index}] requires name and url.`);
    }
    return { name: candidate.name.trim(), url: candidate.url.trim() };
  });
}

export function parseTradeInput(body: unknown): TradeInput {
  if (!body || typeof body !== "object") {
    throw new TradeServiceError("Request body must be a JSON object.");
  }

  const candidate = body as Partial<TradeInput>;
  if (!candidate.pair?.trim()) {
    throw new TradeServiceError("pair is required.");
  }

  if (!candidate.date?.trim()) {
    throw new TradeServiceError("date is required.");
  }
  if (!candidate.outcome || !assertValidOutcome(candidate.outcome)) {
    throw new TradeServiceError("outcome must be WIN or LOSS.");
  }
  if (typeof candidate.profitPercent !== "number" || !Number.isFinite(candidate.profitPercent)) {
    throw new TradeServiceError("profitPercent must be a number.");
  }
  if (typeof candidate.profitAmount !== "number" || !Number.isFinite(candidate.profitAmount)) {
    throw new TradeServiceError("profitAmount must be a number.");
  }
  if (!candidate.strategy || !assertValidStrategy(candidate.strategy)) {
    throw new TradeServiceError(
      "strategy must be BouncyBall Breakout, Backside trade, Support zone rebounce, or Capitulation V.",
    );
  }

  const chartData = candidate.chartData ?? [];
  if (!Array.isArray(chartData)) {
    throw new TradeServiceError("chartData must be an array.");
  }

  return {
    pair: candidate.pair.trim(),
    date: candidate.date.trim(),
    outcome: candidate.outcome,
    profitPercent: candidate.profitPercent,
    profitAmount: candidate.profitAmount,
    strategy: candidate.strategy,
    position: candidate.position ?? null,
    notes: candidate.notes ?? null,
    journalHtml: candidate.journalHtml ?? null,
    screenshots: parseScreenshots(candidate.screenshots) ?? [],
    chartData: chartData as Trade["chartData"],
  };
}

export function parseTradePatch(body: unknown): Partial<TradeInput> {
  if (!body || typeof body !== "object") {
    throw new TradeServiceError("Request body must be a JSON object.");
  }

  const candidate = body as Partial<TradeInput>;
  const patch: Partial<TradeInput> = {};

  if (candidate.pair !== undefined) {
    if (!candidate.pair.trim()) {
      throw new TradeServiceError("pair cannot be empty.");
    }
    patch.pair = candidate.pair.trim();
  }
  if (candidate.date !== undefined) {
    if (!candidate.date.trim()) {
      throw new TradeServiceError("date cannot be empty.");
    }
    patch.date = candidate.date.trim();
  }
  if (candidate.outcome !== undefined) {
    if (!assertValidOutcome(candidate.outcome)) {
      throw new TradeServiceError("outcome must be WIN or LOSS.");
    }
    patch.outcome = candidate.outcome;
  }
  if (candidate.profitPercent !== undefined) {
    if (typeof candidate.profitPercent !== "number" || !Number.isFinite(candidate.profitPercent)) {
      throw new TradeServiceError("profitPercent must be a number.");
    }
    patch.profitPercent = candidate.profitPercent;
  }
  if (candidate.profitAmount !== undefined) {
    if (typeof candidate.profitAmount !== "number" || !Number.isFinite(candidate.profitAmount)) {
      throw new TradeServiceError("profitAmount must be a number.");
    }
    patch.profitAmount = candidate.profitAmount;
  }
  if (candidate.strategy !== undefined) {
    if (!assertValidStrategy(candidate.strategy)) {
      throw new TradeServiceError("strategy is invalid.");
    }
    patch.strategy = candidate.strategy;
  }
  if (candidate.position !== undefined) {
    patch.position = candidate.position ?? null;
  }
  if (candidate.notes !== undefined) {
    patch.notes = candidate.notes ?? null;
  }
  if (candidate.journalHtml !== undefined) {
    patch.journalHtml = candidate.journalHtml ?? null;
  }
  if (candidate.screenshots !== undefined) {
    patch.screenshots = parseScreenshots(candidate.screenshots) ?? [];
  }
  if (candidate.chartData !== undefined) {
    if (!Array.isArray(candidate.chartData)) {
      throw new TradeServiceError("chartData must be an array.");
    }
    patch.chartData = candidate.chartData as Trade["chartData"];
  }

  if (!Object.keys(patch).length) {
    throw new TradeServiceError("At least one field is required for update.");
  }

  return patch;
}

export async function listPersonalTrades(userId: string) {
  const db = getDb();
  const rows = await db
    .select()
    .from(trades)
    .where(eq(trades.userId, userId))
    .orderBy(asc(trades.date), asc(trades.pair));

  return rows.map(rowToTradeRecord);
}

export async function createPersonalTrade(userId: string, input: TradeInput) {
  await assertValidPair(input.pair, userId);
  const db = getDb();
  const [row] = await db
    .insert(trades)
    .values({
      userId,
      pair: input.pair,
      date: new Date(input.date),
      outcome: input.outcome,
      profitPercent: String(input.profitPercent),
      profitAmount: String(input.profitAmount),
      strategy: input.strategy,
      position: input.position ?? null,
      notes: input.notes ?? null,
      journalHtml: input.journalHtml ?? null,
      screenshots: input.screenshots ?? [],
      chartData: input.chartData ?? [],
    })
    .returning();

  return row ? rowToTradeRecord(row) : null;
}

export async function updatePersonalTrade(
  userId: string,
  tradeId: string,
  patch: Partial<TradeInput>,
) {
  if (patch.pair !== undefined) {
    await assertValidPair(patch.pair, userId);
  }

  const db = getDb();
  const [row] = await db
    .update(trades)
    .set({
      ...(patch.pair !== undefined ? { pair: patch.pair } : {}),
      ...(patch.date !== undefined ? { date: new Date(patch.date) } : {}),
      ...(patch.outcome !== undefined ? { outcome: patch.outcome } : {}),
      ...(patch.profitPercent !== undefined
        ? { profitPercent: String(patch.profitPercent) }
        : {}),
      ...(patch.profitAmount !== undefined
        ? { profitAmount: String(patch.profitAmount) }
        : {}),
      ...(patch.strategy !== undefined ? { strategy: patch.strategy } : {}),
      ...(patch.position !== undefined ? { position: patch.position ?? null } : {}),
      ...(patch.notes !== undefined ? { notes: patch.notes ?? null } : {}),
      ...(patch.journalHtml !== undefined ? { journalHtml: patch.journalHtml ?? null } : {}),
      ...(patch.screenshots !== undefined ? { screenshots: patch.screenshots } : {}),
      ...(patch.chartData !== undefined ? { chartData: patch.chartData } : {}),
    })
    .where(and(eq(trades.id, tradeId), eq(trades.userId, userId)))
    .returning();

  return row ? rowToTradeRecord(row) : null;
}

export async function deletePersonalTrade(userId: string, tradeId: string) {
  const db = getDb();
  const deleted = await db
    .delete(trades)
    .where(and(eq(trades.id, tradeId), eq(trades.userId, userId)))
    .returning({ id: trades.id });

  return deleted.length > 0;
}

export async function getPersonalTrade(userId: string, tradeId: string) {
  return getTradeForUser(userId, tradeId);
}

export function toPublicTrade(trade: TradeRecord) {
  return trade;
}
