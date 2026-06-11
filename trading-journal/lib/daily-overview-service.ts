import { getSessionUser, isAdminDemoUser } from "@/lib/auth";
import {
  deleteDailyOverview,
  getDailyOverviewById,
  getDailyOverviewRecordByDate,
  listDailyOverviewsForUser,
  upsertDailyOverview,
} from "@/lib/daily-overview-db";
import type { DailyOverviewInput } from "@/lib/daily-overview-types";
import type { TradeScreenshot } from "@/lib/journal-constants";
import { normalizeMistakeFlags } from "@/lib/trading-mistakes";

export class DailyOverviewServiceError extends Error {
  status: number;

  constructor(message: string, status = 400) {
    super(message);
    this.status = status;
  }
}

export async function requireDailyOverviewUser() {
  const user = await getSessionUser();
  if (!user) {
    throw new DailyOverviewServiceError("Unauthorized", 401);
  }
  if (isAdminDemoUser(user)) {
    throw new DailyOverviewServiceError(
      "Admin demo cannot access daily overviews. Sign in with a Supabase account.",
      403,
    );
  }
  if (!process.env.DATABASE_URL) {
    throw new DailyOverviewServiceError("Database is not configured.", 503);
  }
  return user;
}

function parseScreenshots(value: unknown): TradeScreenshot[] | undefined {
  if (value === undefined) {
    return undefined;
  }
  if (!Array.isArray(value)) {
    throw new DailyOverviewServiceError("screenshots must be an array.");
  }
  for (const [index, item] of value.entries()) {
    if (!item || typeof item !== "object") {
      throw new DailyOverviewServiceError(`screenshots[${index}] must be an object.`);
    }
    const shot = item as TradeScreenshot;
    if (!shot.name?.trim() || !shot.url?.trim()) {
      throw new DailyOverviewServiceError(`screenshots[${index}] requires name and url.`);
    }
  }
  return value as TradeScreenshot[];
}

function parseDailyOverviewInput(body: unknown): DailyOverviewInput {
  if (!body || typeof body !== "object") {
    throw new DailyOverviewServiceError("Request body must be a JSON object.");
  }

  const candidate = body as Partial<DailyOverviewInput>;
  if (!candidate.date?.trim()) {
    throw new DailyOverviewServiceError("date is required.");
  }

  const linkedTradeIds = candidate.linkedTradeIds;
  if (
    linkedTradeIds !== undefined &&
    (!Array.isArray(linkedTradeIds) || linkedTradeIds.some((id) => typeof id !== "string"))
  ) {
    throw new DailyOverviewServiceError("linkedTradeIds must be an array of trade ids.");
  }

  return {
    date: candidate.date.trim().slice(0, 10),
    tradePerformanceHtml: candidate.tradePerformanceHtml ?? null,
    preTradeListHtml: candidate.preTradeListHtml ?? null,
    marketAnalysisHtml: candidate.marketAnalysisHtml ?? null,
    preTradeListScreenshots: parseScreenshots(candidate.preTradeListScreenshots),
    marketAnalysisScreenshots: parseScreenshots(candidate.marketAnalysisScreenshots),
    mistakeFlags:
      candidate.mistakeFlags !== undefined
        ? normalizeMistakeFlags(candidate.mistakeFlags)
        : undefined,
    mistakesNotes: candidate.mistakesNotes ?? null,
    linkedTradeIds: linkedTradeIds ?? [],
  };
}

export async function listPersonalDailyOverviews(userId: string) {
  return listDailyOverviewsForUser(userId);
}

export async function getPersonalDailyOverviewByDate(userId: string, date: string) {
  return getDailyOverviewRecordByDate(userId, date.slice(0, 10));
}

export async function savePersonalDailyOverview(userId: string, body: unknown) {
  const input = parseDailyOverviewInput(body);
  return upsertDailyOverview(userId, input);
}

export async function removePersonalDailyOverview(userId: string, id: string) {
  const existing = await getDailyOverviewById(userId, id);
  if (!existing) {
    throw new DailyOverviewServiceError("Daily overview not found.", 404);
  }
  const deleted = await deleteDailyOverview(userId, id);
  if (!deleted) {
    throw new DailyOverviewServiceError("Daily overview not found.", 404);
  }
  return { ok: true as const };
}

export { parseDailyOverviewInput };
