"use server";

import { revalidatePath } from "next/cache";

import { getSessionUser, isAdminDemoUser } from "@/lib/auth";
import {
  upsertDailyOverview,
  deleteDailyOverview,
  getDailyOverviewById,
  updateDailyOverviewScreenshots,
} from "@/lib/daily-overview-db";
import type {
  DailyOverviewInput,
  DailyOverviewScreenshotUploads,
} from "@/lib/daily-overview-types";
import type { TradeScreenshot } from "@/lib/journal-constants";
import { uploadDailyOverviewScreenshots } from "@/lib/journal-screenshots";

export type SaveDailyOverviewResult =
  | { ok: true; message: string }
  | { ok: false; message: string };

const MAX_SCREENSHOTS_PER_SECTION = 6;

function parseScreenshots(value: unknown): TradeScreenshot[] {
  if (!Array.isArray(value)) {
    return [];
  }
  return value.filter(
    (item): item is TradeScreenshot =>
      Boolean(item) &&
      typeof item === "object" &&
      typeof (item as TradeScreenshot).name === "string" &&
      typeof (item as TradeScreenshot).url === "string",
  );
}

function validateScreenshotCounts(
  input: DailyOverviewInput,
  uploads: DailyOverviewScreenshotUploads,
) {
  const preTradeUploads = uploads.preTradeList ?? [];
  const marketUploads = uploads.marketAnalysis ?? [];
  const preTradeExisting = parseScreenshots(input.preTradeListScreenshots);
  const marketExisting = parseScreenshots(input.marketAnalysisScreenshots);

  if (preTradeUploads.length + preTradeExisting.length > MAX_SCREENSHOTS_PER_SECTION) {
    return "You can attach up to 6 screenshots in the pre-trade list section.";
  }
  if (marketUploads.length + marketExisting.length > MAX_SCREENSHOTS_PER_SECTION) {
    return "You can attach up to 6 screenshots in the market analysis section.";
  }
  return null;
}

export async function saveDailyOverview(
  input: DailyOverviewInput,
  uploads: DailyOverviewScreenshotUploads = {},
): Promise<SaveDailyOverviewResult> {
  const user = await getSessionUser();
  if (!user) {
    return { ok: false, message: "You must be signed in." };
  }
  if (isAdminDemoUser(user)) {
    return { ok: false, message: "Daily overviews require a Supabase account." };
  }
  if (!process.env.DATABASE_URL) {
    return { ok: false, message: "Database is not configured." };
  }

  const validationError = validateScreenshotCounts(input, uploads);
  if (validationError) {
    return { ok: false, message: validationError };
  }

  const preTradeUploads = uploads.preTradeList ?? [];
  const marketUploads = uploads.marketAnalysis ?? [];
  const preTradeExisting = parseScreenshots(input.preTradeListScreenshots);
  const marketExisting = parseScreenshots(input.marketAnalysisScreenshots);

  try {
    const saved = await upsertDailyOverview(user.id, {
      ...input,
      preTradeListScreenshots: preTradeExisting,
      marketAnalysisScreenshots: marketExisting,
    });

    if (!saved) {
      return { ok: false, message: "Unable to save daily overview." };
    }

    const preTradeListScreenshots = preTradeUploads.length
      ? await uploadDailyOverviewScreenshots(
          user.id,
          saved.id,
          "pre-trade-list",
          preTradeUploads,
          preTradeExisting,
        )
      : preTradeExisting;

    const marketAnalysisScreenshots = marketUploads.length
      ? await uploadDailyOverviewScreenshots(
          user.id,
          saved.id,
          "market-analysis",
          marketUploads,
          marketExisting,
        )
      : marketExisting;

    if (preTradeUploads.length || marketUploads.length) {
      await updateDailyOverviewScreenshots(user.id, saved.id, {
        ...(preTradeUploads.length ? { preTradeListScreenshots } : {}),
        ...(marketUploads.length ? { marketAnalysisScreenshots } : {}),
      });
    }

    revalidatePath("/app");
    return { ok: true, message: "Daily overview saved." };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to save daily overview.";
    return { ok: false, message };
  }
}

export async function removeDailyOverview(id: string): Promise<SaveDailyOverviewResult> {
  const user = await getSessionUser();
  if (!user || isAdminDemoUser(user)) {
    return { ok: false, message: "Unauthorized." };
  }

  const existing = await getDailyOverviewById(user.id, id);
  if (!existing) {
    return { ok: false, message: "Daily overview not found." };
  }

  await deleteDailyOverview(user.id, id);
  revalidatePath("/app");
  return { ok: true, message: "Daily overview deleted." };
}
