"use server";

import { revalidatePath } from "next/cache";

import { getSessionUser, isAdminDemoUser } from "@/lib/auth";
import { upsertDailyOverview, deleteDailyOverview, getDailyOverviewById } from "@/lib/daily-overview-db";
import type { DailyOverviewInput } from "@/lib/daily-overview-types";

export type SaveDailyOverviewResult =
  | { ok: true; message: string }
  | { ok: false; message: string };

export async function saveDailyOverview(input: DailyOverviewInput): Promise<SaveDailyOverviewResult> {
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

  try {
    await upsertDailyOverview(user.id, input);
    revalidatePath("/");
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
  revalidatePath("/");
  return { ok: true, message: "Daily overview deleted." };
}
