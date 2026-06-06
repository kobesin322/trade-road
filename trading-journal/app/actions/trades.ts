"use server";

import { and, eq, sql } from "drizzle-orm";
import { revalidatePath } from "next/cache";

import { trades } from "@/db/schema";
import { getSessionUser, isAdminDemoUser } from "@/lib/auth";
import { getDb } from "@/lib/db";
import { buildSampleTradeRows } from "@/lib/seed-trades";
import { listTradesForUser, rowToTrade } from "@/lib/trade-db";
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
  chartData: Trade["chartData"];
};

function requireDbUser(user: NonNullable<Awaited<ReturnType<typeof getSessionUser>>>) {
  if (isAdminDemoUser(user)) {
    throw new Error(
      "Admin demo cannot write to the database. Sign out and sign in with a Supabase account.",
    );
  }
}

export async function createTrade(input: TradeInput) {
  const user = await getSessionUser();
  if (!user) {
    throw new Error("Unauthorized");
  }
  requireDbUser(user);

  const db = getDb();
  const [row] = await db
    .insert(trades)
    .values({
      userId: user.id,
      pair: input.pair,
      date: new Date(input.date),
      outcome: input.outcome,
      profitPercent: String(input.profitPercent),
      profitAmount: String(input.profitAmount),
      strategy: input.strategy,
      position: input.position ?? null,
      notes: input.notes ?? null,
      chartData: input.chartData,
    })
    .returning();

  revalidatePath("/");
  return row ? rowToTrade(row) : null;
}

export async function updateTrade(
  id: string,
  patch: Partial<
    Pick<
      TradeInput,
      "pair" | "date" | "outcome" | "profitPercent" | "profitAmount" | "strategy" | "position" | "notes" | "chartData"
    >
  >,
) {
  const user = await getSessionUser();
  if (!user) {
    throw new Error("Unauthorized");
  }
  requireDbUser(user);

  const db = getDb();

  const definedEntries = Object.entries(patch).filter(([, value]) => value !== undefined);
  if (definedEntries.length === 0) {
    return null;
  }

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
      ...(patch.chartData !== undefined ? { chartData: patch.chartData } : {}),
    })
    .where(and(eq(trades.id, id), eq(trades.userId, user.id)))
    .returning();

  revalidatePath("/");
  return row ? rowToTrade(row) : null;
}

export async function deleteTrade(id: string) {
  const user = await getSessionUser();
  if (!user) {
    throw new Error("Unauthorized");
  }
  requireDbUser(user);

  const db = getDb();
  await db.delete(trades).where(and(eq(trades.id, id), eq(trades.userId, user.id)));
  revalidatePath("/");
}

export async function seedSampleTrades(): Promise<{ ok: boolean; message: string }> {
  const user = await getSessionUser();
  if (!user) {
    return { ok: false, message: "You must be signed in." };
  }
  if (isAdminDemoUser(user)) {
    return {
      ok: false,
      message:
        "Admin demo cannot save trades. Sign out and sign in with a Supabase account, then try again.",
    };
  }

  const db = getDb();
  const [{ count }] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(trades)
    .where(eq(trades.userId, user.id));

  if (count > 0) {
    return {
      ok: false,
      message: "Sample data is only loaded when you have zero trades. Clear trades in Supabase or use a fresh account.",
    };
  }

  await db.insert(trades).values(buildSampleTradeRows(user.id));
  revalidatePath("/");
  return { ok: true, message: "Loaded the March 2026 demo pack." };
}

export async function buildTradesCsv(): Promise<string> {
  const user = await getSessionUser();
  if (!user) {
    throw new Error("Unauthorized");
  }
  requireDbUser(user);

  const list = await listTradesForUser(user.id);
  const headers = [
    "id",
    "pair",
    "date",
    "outcome",
    "profit_percent",
    "profit_amount",
    "strategy",
    "position",
    "notes",
  ];
  const escape = (value: string) => `"${value.replaceAll('"', '""')}"`;
  const lines = [
    headers.join(","),
    ...list.map((trade) =>
      [
        trade.id,
        trade.pair,
        trade.date,
        trade.outcome,
        String(trade.profitPercent),
        String(trade.profitAmount),
        trade.strategy,
        trade.position,
        "",
      ]
        .map((cell) => escape(String(cell)))
        .join(","),
    ),
  ];
  return lines.join("\n");
}
