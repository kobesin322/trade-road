import { and, asc, eq } from "drizzle-orm";

import { trades, tradeLevelPushes } from "@/db/schema";
import { getSessionUser, isAdminDemoUser } from "@/lib/auth";
import { getDb } from "@/lib/db";
import {
  isJournalPair,
  isJournalStrategy,
  isTradeSelfRating,
  type TradeLevelPushInput,
  type TradeScreenshot,
  type TradeSelfRating,
} from "@/lib/journal-constants";
import {
  listUserWatchlistSymbols,
} from "@/lib/watchlist-ticker-service";
import {
  getTradeForUser,
  listLevelPushesForTradeIds,
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
  stopLoss?: number | null;
  takeProfit?: number | null;
  riskRewardRatio?: number | null;
  ratingOverall?: TradeSelfRating | null;
  ratingSizing?: TradeSelfRating | null;
  ratingEntry?: TradeSelfRating | null;
  ratingExit?: TradeSelfRating | null;
  levelPushes?: TradeLevelPushInput[];
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

function parseOptionalNumber(value: unknown, field: string) {
  if (value === undefined || value === null || value === "") {
    return null;
  }

  if (typeof value !== "number" || !Number.isFinite(value)) {
    throw new TradeServiceError(`${field} must be a number.`);
  }

  return value;
}

function parseOptionalSelfRating(value: unknown, field: string): TradeSelfRating | null {
  if (value === undefined || value === null || value === "") {
    return null;
  }

  if (typeof value !== "string" || !isTradeSelfRating(value)) {
    throw new TradeServiceError(`${field} must be one of A+, A, B+, B, C+, C, D.`);
  }

  return value;
}

function parseLevelPushes(value: unknown): TradeLevelPushInput[] | undefined {
  if (value === undefined) {
    return undefined;
  }

  if (!Array.isArray(value)) {
    throw new TradeServiceError("levelPushes must be an array.");
  }

  return value.map((item, index) => {
    if (!item || typeof item !== "object") {
      throw new TradeServiceError(`levelPushes[${index}] must be an object.`);
    }

    const candidate = item as Partial<TradeLevelPushInput>;
    if (candidate.levelType !== "SL" && candidate.levelType !== "TP") {
      throw new TradeServiceError(`levelPushes[${index}].levelType must be SL or TP.`);
    }
    if (typeof candidate.price !== "number" || !Number.isFinite(candidate.price)) {
      throw new TradeServiceError(`levelPushes[${index}].price must be a number.`);
    }

    const pushedAt = candidate.pushedAt?.trim();
    if (!pushedAt) {
      throw new TradeServiceError(`levelPushes[${index}].pushedAt is required.`);
    }

    if (Number.isNaN(Date.parse(pushedAt))) {
      throw new TradeServiceError(`levelPushes[${index}].pushedAt must be a valid datetime.`);
    }

    return {
      id: candidate.id,
      clientId: candidate.clientId,
      levelType: candidate.levelType,
      price: candidate.price,
      pushedAt: new Date(pushedAt).toISOString(),
      note: candidate.note?.trim() || null,
    };
  });
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
    stopLoss: parseOptionalNumber(candidate.stopLoss, "stopLoss"),
    takeProfit: parseOptionalNumber(candidate.takeProfit, "takeProfit"),
    riskRewardRatio: parseOptionalNumber(candidate.riskRewardRatio, "riskRewardRatio"),
    ratingOverall: parseOptionalSelfRating(candidate.ratingOverall, "ratingOverall"),
    ratingSizing: parseOptionalSelfRating(candidate.ratingSizing, "ratingSizing"),
    ratingEntry: parseOptionalSelfRating(candidate.ratingEntry, "ratingEntry"),
    ratingExit: parseOptionalSelfRating(candidate.ratingExit, "ratingExit"),
    levelPushes: parseLevelPushes(candidate.levelPushes) ?? [],
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
  if (candidate.stopLoss !== undefined) {
    patch.stopLoss = parseOptionalNumber(candidate.stopLoss, "stopLoss");
  }
  if (candidate.takeProfit !== undefined) {
    patch.takeProfit = parseOptionalNumber(candidate.takeProfit, "takeProfit");
  }
  if (candidate.riskRewardRatio !== undefined) {
    patch.riskRewardRatio = parseOptionalNumber(candidate.riskRewardRatio, "riskRewardRatio");
  }
  if (candidate.ratingOverall !== undefined) {
    patch.ratingOverall = parseOptionalSelfRating(candidate.ratingOverall, "ratingOverall");
  }
  if (candidate.ratingSizing !== undefined) {
    patch.ratingSizing = parseOptionalSelfRating(candidate.ratingSizing, "ratingSizing");
  }
  if (candidate.ratingEntry !== undefined) {
    patch.ratingEntry = parseOptionalSelfRating(candidate.ratingEntry, "ratingEntry");
  }
  if (candidate.ratingExit !== undefined) {
    patch.ratingExit = parseOptionalSelfRating(candidate.ratingExit, "ratingExit");
  }
  if (candidate.levelPushes !== undefined) {
    patch.levelPushes = parseLevelPushes(candidate.levelPushes) ?? [];
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

async function syncTradeLevelPushes(
  userId: string,
  tradeId: string,
  pushes: TradeLevelPushInput[],
) {
  const db = getDb();
  await db.delete(tradeLevelPushes).where(eq(tradeLevelPushes.tradeId, tradeId));

  if (!pushes.length) {
    return;
  }

  await db.insert(tradeLevelPushes).values(
    pushes.map((push, index) => ({
      tradeId,
      userId,
      levelType: push.levelType,
      price: String(push.price),
      pushedAt: new Date(push.pushedAt),
      note: push.note ?? null,
      sortOrder: index,
    })),
  );
}

export async function listPersonalTrades(userId: string) {
  const db = getDb();
  const rows = await db
    .select()
    .from(trades)
    .where(eq(trades.userId, userId))
    .orderBy(asc(trades.date), asc(trades.pair));

  const pushesByTrade = await listLevelPushesForTradeIds(rows.map((row) => row.id));
  return rows.map((row) => rowToTradeRecord(row, pushesByTrade.get(row.id) ?? []));
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
      stopLoss: input.stopLoss === null || input.stopLoss === undefined ? null : String(input.stopLoss),
      takeProfit:
        input.takeProfit === null || input.takeProfit === undefined ? null : String(input.takeProfit),
      riskRewardRatio:
        input.riskRewardRatio === null || input.riskRewardRatio === undefined
          ? null
          : String(input.riskRewardRatio),
      ratingOverall: input.ratingOverall ?? null,
      ratingSizing: input.ratingSizing ?? null,
      ratingEntry: input.ratingEntry ?? null,
      ratingExit: input.ratingExit ?? null,
      journalHtml: input.journalHtml ?? null,
      screenshots: input.screenshots ?? [],
      chartData: input.chartData ?? [],
    })
    .returning();

  if (!row) {
    return null;
  }

  if (input.levelPushes !== undefined) {
    await syncTradeLevelPushes(userId, row.id, input.levelPushes);
  }

  const pushesByTrade = await listLevelPushesForTradeIds([row.id]);
  return rowToTradeRecord(row, pushesByTrade.get(row.id) ?? []);
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
      ...(patch.stopLoss !== undefined
        ? { stopLoss: patch.stopLoss === null ? null : String(patch.stopLoss) }
        : {}),
      ...(patch.takeProfit !== undefined
        ? { takeProfit: patch.takeProfit === null ? null : String(patch.takeProfit) }
        : {}),
      ...(patch.riskRewardRatio !== undefined
        ? {
            riskRewardRatio:
              patch.riskRewardRatio === null ? null : String(patch.riskRewardRatio),
          }
        : {}),
      ...(patch.ratingOverall !== undefined ? { ratingOverall: patch.ratingOverall ?? null } : {}),
      ...(patch.ratingSizing !== undefined ? { ratingSizing: patch.ratingSizing ?? null } : {}),
      ...(patch.ratingEntry !== undefined ? { ratingEntry: patch.ratingEntry ?? null } : {}),
      ...(patch.ratingExit !== undefined ? { ratingExit: patch.ratingExit ?? null } : {}),
      ...(patch.journalHtml !== undefined ? { journalHtml: patch.journalHtml ?? null } : {}),
      ...(patch.screenshots !== undefined ? { screenshots: patch.screenshots } : {}),
      ...(patch.chartData !== undefined ? { chartData: patch.chartData } : {}),
    })
    .where(and(eq(trades.id, tradeId), eq(trades.userId, userId)))
    .returning();

  if (!row) {
    return null;
  }

  if (patch.levelPushes !== undefined) {
    await syncTradeLevelPushes(userId, tradeId, patch.levelPushes);
  }

  const pushesByTrade = await listLevelPushesForTradeIds([tradeId]);
  return rowToTradeRecord(row, pushesByTrade.get(tradeId) ?? []);
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
