"use server";

import { revalidatePath } from "next/cache";

import { getSessionUser, isAdminDemoUser } from "@/lib/auth";
import {
  type JournalEntryInput,
  type JournalScreenshotUpload,
  isJournalPair,
  isTradeSelfRating,
  isTradeSpecies,
} from "@/lib/journal-constants";
import { uploadJournalScreenshots } from "@/lib/journal-screenshots";
import { tradeRecordToTrade } from "@/lib/trade-db";
import {
  createPersonalTrade,
  deletePersonalTrade,
  updatePersonalTrade,
  type TradeInput,
} from "@/lib/trade-service";
import type { Trade } from "@/lib/trades";

export type SaveJournalResult =
  | { ok: true; trade: Trade; message: string }
  | { ok: false; message: string };

function toTradeInput(entry: JournalEntryInput): TradeInput {
  return {
    pair: entry.pair,
    date: entry.date,
    outcome: entry.outcome,
    profitPercent: entry.profitPercent,
    profitAmount: entry.profitAmount,
    strategy: entry.strategy,
    species: entry.species,
    position: entry.position,
    notes: null,
    stopLoss: entry.stopLoss ?? null,
    takeProfit: entry.takeProfit ?? null,
    riskRewardRatio: entry.riskRewardRatio ?? null,
    entryPoint: entry.entryPoint ?? null,
    ratingOverall: entry.ratingOverall ?? null,
    ratingSizing: entry.ratingSizing ?? null,
    ratingEntry: entry.ratingEntry ?? null,
    ratingExit: entry.ratingExit ?? null,
    levelPushes: entry.levelPushes,
    journalHtml: entry.journalHtml || null,
    screenshots: entry.screenshots,
    chartData: [],
  };
}

function validateJournalEntry(
  entry: JournalEntryInput,
  uploads: JournalScreenshotUpload[],
) {
  if (!isJournalPair(entry.pair)) {
    return "Pair must be selected from the Charts watchlist or your saved tickers.";
  }
  if (!entry.date.trim()) {
    return "Date is required.";
  }
  if (!entry.strategy.trim()) {
    return "Strategy is required.";
  }
  if (!isTradeSpecies(entry.species)) {
    return "Species must be Stocks, Perps, or Futures.";
  }
  if (entry.outcome !== "WIN" && entry.outcome !== "LOSS") {
    return "Outcome must be WIN or LOSS.";
  }
  if (uploads.length + entry.screenshots.length > 6) {
    return "You can attach up to 6 screenshots per journal entry.";
  }
  for (const [index, push] of entry.levelPushes.entries()) {
    if (push.levelType !== "SL" && push.levelType !== "TP") {
      return `Push record ${index + 1} must be SL or TP.`;
    }
    if (!Number.isFinite(push.price)) {
      return `Push record ${index + 1} needs a valid price.`;
    }
    if (!push.pushedAt.trim()) {
      return `Push record ${index + 1} needs a push time.`;
    }
  }

  const ratings = [
    entry.ratingOverall,
    entry.ratingSizing,
    entry.ratingEntry,
    entry.ratingExit,
  ];
  for (const rating of ratings) {
    if (rating != null && !isTradeSelfRating(rating)) {
      return "Self-rated ranking must be one of A+, A, B+, B, C+, C, D.";
    }
  }

  return null;
}

export async function saveJournalEntry(
  entry: JournalEntryInput,
  uploads: JournalScreenshotUpload[] = [],
): Promise<SaveJournalResult> {
  const user = await getSessionUser();
  if (!user) {
    return { ok: false, message: "You must be signed in." };
  }
  if (isAdminDemoUser(user)) {
    return {
      ok: false,
      message: "Sign in with a Supabase account to save journals.",
    };
  }
  if (!process.env.DATABASE_URL) {
    return { ok: false, message: "Database is not configured." };
  }

  const validationError = validateJournalEntry(entry, uploads);
  if (validationError) {
    return { ok: false, message: validationError };
  }

  try {
    const baseInput = toTradeInput(entry);

    if (entry.id) {
      const updated = await updatePersonalTrade(user.id, entry.id, baseInput);
      if (!updated) {
        return { ok: false, message: "Journal entry not found." };
      }

      const screenshots = uploads.length
        ? await uploadJournalScreenshots(user.id, entry.id, uploads, entry.screenshots)
        : entry.screenshots;

      const finalized =
        uploads.length > 0
          ? await updatePersonalTrade(user.id, entry.id, { screenshots })
          : updated;

      if (!finalized) {
        return { ok: false, message: "Unable to finalize journal screenshots." };
      }

      revalidatePath("/app");
      return {
        ok: true,
        trade: tradeRecordToTrade(finalized),
        message: "Journal entry updated.",
      };
    }

    const created = await createPersonalTrade(user.id, {
      ...baseInput,
      screenshots: [],
    });

    if (!created) {
      return { ok: false, message: "Unable to create journal entry." };
    }

    const screenshots = uploads.length
      ? await uploadJournalScreenshots(user.id, created.id, uploads, [])
      : [];

    const finalized =
      screenshots.length > 0
        ? await updatePersonalTrade(user.id, created.id, { screenshots })
        : created;

    if (!finalized) {
      return { ok: false, message: "Journal created but screenshot upload failed." };
    }

    revalidatePath("/app");
    return {
      ok: true,
      trade: tradeRecordToTrade(finalized),
      message: "Journal entry created.",
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to save journal entry.";
    return { ok: false, message };
  }
}

export async function deleteJournalEntry(tradeId: string): Promise<SaveJournalResult> {
  const user = await getSessionUser();
  if (!user || isAdminDemoUser(user)) {
    return { ok: false, message: "Unauthorized." };
  }

  const deleted = await deletePersonalTrade(user.id, tradeId);
  if (!deleted) {
    return { ok: false, message: "Journal entry not found." };
  }

  revalidatePath("/app");
  return { ok: true, trade: {} as Trade, message: "Journal entry deleted." };
}
