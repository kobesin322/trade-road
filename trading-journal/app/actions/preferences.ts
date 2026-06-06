"use server";

import { revalidatePath } from "next/cache";

import { getSessionUser } from "@/lib/auth";
import { setDemoTradesEnabled } from "@/lib/user-preferences";

export async function updateDemoTradesPreference(enabled: boolean) {
  const user = await getSessionUser();
  if (!user) {
    throw new Error("Unauthorized");
  }

  await setDemoTradesEnabled(user.id, enabled);
  revalidatePath("/");
  return { ok: true, demoTradesEnabled: enabled };
}
