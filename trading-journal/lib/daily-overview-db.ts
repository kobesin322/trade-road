import { and, desc, eq, inArray, sql } from "drizzle-orm";

import { dailyOverviewTrades, dailyOverviews, type DailyOverviewRow, trades } from "@/db/schema";
import { getDb } from "@/lib/db";
import type { DailyOverview, DailyOverviewRecord } from "@/lib/daily-overview-types";
import { normalizeMistakeFlags } from "@/lib/trading-mistakes";
import { rowToTrade } from "@/lib/trade-db";

function formatOverviewDate(value: string | Date) {
  if (value instanceof Date) {
    return value.toISOString().slice(0, 10);
  }
  return String(value).slice(0, 10);
}

function parseScreenshotArray(value: unknown) {
  return Array.isArray(value) ? value : [];
}

export function rowToDailyOverview(
  row: DailyOverviewRow,
  linkedTradeIds: string[] = [],
): DailyOverview {
  return {
    id: row.id,
    date: formatOverviewDate(row.overviewDate),
    tradePerformanceHtml: row.tradePerformanceHtml ?? null,
    preTradeListHtml: row.preTradeListHtml ?? null,
    marketAnalysisHtml: row.marketAnalysisHtml ?? null,
    preTradeListScreenshots: parseScreenshotArray(row.preTradeListScreenshots),
    marketAnalysisScreenshots: parseScreenshotArray(row.marketAnalysisScreenshots),
    mistakeFlags: normalizeMistakeFlags(row.mistakeFlags),
    mistakesNotes: row.mistakesNotes ?? null,
    linkedTradeIds,
    createdAt:
      row.createdAt instanceof Date ? row.createdAt.toISOString() : String(row.createdAt),
    updatedAt:
      row.updatedAt instanceof Date ? row.updatedAt.toISOString() : String(row.updatedAt),
  };
}

async function getLinkedTradeIds(overviewIds: string[]) {
  if (!overviewIds.length) {
    return new Map<string, string[]>();
  }

  const db = getDb();
  const links = await db
    .select()
    .from(dailyOverviewTrades)
    .where(inArray(dailyOverviewTrades.dailyOverviewId, overviewIds));

  const map = new Map<string, string[]>();
  for (const link of links) {
    const current = map.get(link.dailyOverviewId) ?? [];
    current.push(link.tradeId);
    map.set(link.dailyOverviewId, current);
  }
  return map;
}

export async function listDailyOverviewsForUser(userId: string) {
  const db = getDb();
  const rows = await db
    .select()
    .from(dailyOverviews)
    .where(eq(dailyOverviews.userId, userId))
    .orderBy(desc(dailyOverviews.overviewDate));

  const linkMap = await getLinkedTradeIds(rows.map((row) => row.id));
  return rows.map((row) => rowToDailyOverview(row, linkMap.get(row.id) ?? []));
}

export async function getDailyOverviewByDate(userId: string, date: string) {
  const db = getDb();
  const [row] = await db
    .select()
    .from(dailyOverviews)
    .where(and(eq(dailyOverviews.userId, userId), eq(dailyOverviews.overviewDate, date)))
    .limit(1);

  if (!row) {
    return null;
  }

  const linkMap = await getLinkedTradeIds([row.id]);
  return rowToDailyOverview(row, linkMap.get(row.id) ?? []);
}

export async function getDailyOverviewRecordByDate(
  userId: string,
  date: string,
): Promise<DailyOverviewRecord | null> {
  const overview = await getDailyOverviewByDate(userId, date);
  if (!overview) {
    return null;
  }

  const db = getDb();
  const linkedTrades =
    overview.linkedTradeIds.length > 0
      ? await db
          .select()
          .from(trades)
          .where(and(eq(trades.userId, userId), inArray(trades.id, overview.linkedTradeIds)))
      : [];

  return {
    ...overview,
    linkedTrades: linkedTrades.map(rowToTrade),
  };
}

export async function getDailyOverviewById(userId: string, id: string) {
  const db = getDb();
  const [row] = await db
    .select()
    .from(dailyOverviews)
    .where(and(eq(dailyOverviews.id, id), eq(dailyOverviews.userId, userId)))
    .limit(1);

  if (!row) {
    return null;
  }

  const linkMap = await getLinkedTradeIds([row.id]);
  return rowToDailyOverview(row, linkMap.get(row.id) ?? []);
}

async function assertTradesLinkable(userId: string, date: string, tradeIds: string[]) {
  if (!tradeIds.length) {
    return;
  }

  const db = getDb();
  const rows = await db
    .select({ id: trades.id, date: trades.date })
    .from(trades)
    .where(and(eq(trades.userId, userId), inArray(trades.id, tradeIds)));

  if (rows.length !== tradeIds.length) {
    throw new Error("One or more linked trades were not found.");
  }

  for (const row of rows) {
    const tradeDate = formatOverviewDate(row.date);
    if (tradeDate !== date) {
      throw new Error("Linked trades must belong to the same day as the daily overview.");
    }
  }
}

async function replaceOverviewTradeLinks(overviewId: string, tradeIds: string[]) {
  const db = getDb();
  await db.delete(dailyOverviewTrades).where(eq(dailyOverviewTrades.dailyOverviewId, overviewId));

  if (!tradeIds.length) {
    return;
  }

  await db.insert(dailyOverviewTrades).values(
    tradeIds.map((tradeId) => ({
      dailyOverviewId: overviewId,
      tradeId,
    })),
  );
}

export async function upsertDailyOverview(
  userId: string,
  input: {
    date: string;
    tradePerformanceHtml?: string | null;
    preTradeListHtml?: string | null;
    marketAnalysisHtml?: string | null;
    preTradeListScreenshots?: DailyOverview["preTradeListScreenshots"];
    marketAnalysisScreenshots?: DailyOverview["marketAnalysisScreenshots"];
    mistakeFlags?: string[];
    mistakesNotes?: string | null;
    linkedTradeIds?: string[];
  },
) {
  const date = input.date.slice(0, 10);
  if (input.linkedTradeIds !== undefined) {
    await assertTradesLinkable(userId, date, input.linkedTradeIds);
  }

  const db = getDb();
  const [row] = await db
    .insert(dailyOverviews)
    .values({
      userId,
      overviewDate: date,
      tradePerformanceHtml: input.tradePerformanceHtml ?? null,
      preTradeListHtml: input.preTradeListHtml ?? null,
      marketAnalysisHtml: input.marketAnalysisHtml ?? null,
      preTradeListScreenshots: input.preTradeListScreenshots ?? [],
      marketAnalysisScreenshots: input.marketAnalysisScreenshots ?? [],
      mistakeFlags: normalizeMistakeFlags(input.mistakeFlags),
      mistakesNotes: input.mistakesNotes ?? null,
    })
    .onConflictDoUpdate({
      target: [dailyOverviews.userId, dailyOverviews.overviewDate],
      set: {
        ...(input.tradePerformanceHtml !== undefined
          ? { tradePerformanceHtml: input.tradePerformanceHtml }
          : {}),
        ...(input.preTradeListHtml !== undefined ? { preTradeListHtml: input.preTradeListHtml } : {}),
        ...(input.marketAnalysisHtml !== undefined
          ? { marketAnalysisHtml: input.marketAnalysisHtml }
          : {}),
        ...(input.preTradeListScreenshots !== undefined
          ? { preTradeListScreenshots: input.preTradeListScreenshots }
          : {}),
        ...(input.marketAnalysisScreenshots !== undefined
          ? { marketAnalysisScreenshots: input.marketAnalysisScreenshots }
          : {}),
        ...(input.mistakeFlags !== undefined
          ? { mistakeFlags: normalizeMistakeFlags(input.mistakeFlags) }
          : {}),
        ...(input.mistakesNotes !== undefined ? { mistakesNotes: input.mistakesNotes } : {}),
        updatedAt: sql`now()`,
      },
    })
    .returning();

  if (!row) {
    throw new Error("Unable to save daily overview.");
  }

  if (input.linkedTradeIds !== undefined) {
    await replaceOverviewTradeLinks(row.id, input.linkedTradeIds);
  }
  return getDailyOverviewRecordByDate(userId, date);
}

export async function updateDailyOverviewScreenshots(
  userId: string,
  overviewId: string,
  input: {
    preTradeListScreenshots?: DailyOverview["preTradeListScreenshots"];
    marketAnalysisScreenshots?: DailyOverview["marketAnalysisScreenshots"];
  },
) {
  const db = getDb();
  const [row] = await db
    .update(dailyOverviews)
    .set({
      ...(input.preTradeListScreenshots !== undefined
        ? { preTradeListScreenshots: input.preTradeListScreenshots }
        : {}),
      ...(input.marketAnalysisScreenshots !== undefined
        ? { marketAnalysisScreenshots: input.marketAnalysisScreenshots }
        : {}),
      updatedAt: sql`now()`,
    })
    .where(and(eq(dailyOverviews.id, overviewId), eq(dailyOverviews.userId, userId)))
    .returning();

  return row ?? null;
}

export async function deleteDailyOverview(userId: string, id: string) {
  const db = getDb();
  const deleted = await db
    .delete(dailyOverviews)
    .where(and(eq(dailyOverviews.id, id), eq(dailyOverviews.userId, userId)))
    .returning({ id: dailyOverviews.id });

  return deleted.length > 0;
}
