import { cookies } from "next/headers";
import { eq } from "drizzle-orm";

import { userPreferences } from "@/db/schema";
import {
  DEMO_TRADES_COOKIE,
  demoTradesCookieValue,
  parseDemoTradesCookie,
} from "@/lib/demo-trades-preference";
import { getDb } from "@/lib/db";
import { isAdminDemoUser } from "@/lib/auth";

function defaultDemoModeForUser(userId: string) {
  return isAdminDemoUser({ id: userId });
}

export async function getDemoTradesEnabled(userId: string) {
  const cookieStore = await cookies();
  const cookieValue = parseDemoTradesCookie(cookieStore.get(DEMO_TRADES_COOKIE)?.value);

  if (!process.env.DATABASE_URL || isAdminDemoUser({ id: userId })) {
    return cookieValue ?? defaultDemoModeForUser(userId);
  }

  try {
    const db = getDb();
    const [row] = await db
      .select({ demoTradesEnabled: userPreferences.demoTradesEnabled })
      .from(userPreferences)
      .where(eq(userPreferences.userId, userId))
      .limit(1);

    if (row) {
      return row.demoTradesEnabled;
    }
  } catch {
    // Fall back to cookie/default when preferences table is not migrated yet.
  }

  return cookieValue ?? defaultDemoModeForUser(userId);
}

export async function setDemoTradesEnabled(userId: string, enabled: boolean) {
  const cookieStore = await cookies();
  cookieStore.set(DEMO_TRADES_COOKIE, demoTradesCookieValue(enabled), {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 24 * 365,
  });

  if (!process.env.DATABASE_URL || isAdminDemoUser({ id: userId })) {
    return;
  }

  const db = getDb();
  await db
    .insert(userPreferences)
    .values({
      userId,
      demoTradesEnabled: enabled,
    })
    .onConflictDoUpdate({
      target: userPreferences.userId,
      set: {
        demoTradesEnabled: enabled,
      },
    });
}
