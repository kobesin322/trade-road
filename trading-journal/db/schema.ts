import { sql } from "drizzle-orm";
import {
  boolean,
  jsonb,
  numeric,
  pgTable,
  text,
  timestamp,
  uuid,
} from "drizzle-orm/pg-core";

export type ChartPoint = { time: string; price: number };

export type TradeScreenshot = { name: string; url: string };

export const trades = pgTable("trades", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id").notNull(),
  pair: text("pair").notNull(),
  date: timestamp("date", { withTimezone: true }).notNull(),
  outcome: text("outcome").notNull(),
  profitPercent: numeric("profit_percent").notNull(),
  profitAmount: numeric("profit_amount").notNull(),
  strategy: text("strategy").notNull(),
  position: text("position"),
  notes: text("notes"),
  journalHtml: text("journal_html"),
  screenshots: jsonb("screenshots")
    .$type<TradeScreenshot[]>()
    .notNull()
    .default(sql`'[]'::jsonb`),
  chartData: jsonb("chart_data")
    .$type<ChartPoint[]>()
    .notNull()
    .default(sql`'[]'::jsonb`),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export type TradeRow = typeof trades.$inferSelect;
export type TradeInsert = typeof trades.$inferInsert;

export const userPreferences = pgTable("user_preferences", {
  userId: uuid("user_id").primaryKey(),
  demoTradesEnabled: boolean("demo_trades_enabled").notNull().default(false),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export type UserPreferencesRow = typeof userPreferences.$inferSelect;
