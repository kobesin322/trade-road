import { sql } from "drizzle-orm";
import {
  boolean,
  date,
  jsonb,
  numeric,
  pgTable,
  primaryKey,
  text,
  timestamp,
  unique,
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

export const dailyOverviews = pgTable(
  "daily_overviews",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id").notNull(),
    overviewDate: date("overview_date").notNull(),
    tradePerformanceHtml: text("trade_performance_html"),
    preTradeListHtml: text("pre_trade_list_html"),
    marketAnalysisHtml: text("market_analysis_html"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [unique("daily_overviews_user_date_unique").on(table.userId, table.overviewDate)],
);

export const dailyOverviewTrades = pgTable(
  "daily_overview_trades",
  {
    dailyOverviewId: uuid("daily_overview_id")
      .notNull()
      .references(() => dailyOverviews.id, { onDelete: "cascade" }),
    tradeId: uuid("trade_id")
      .notNull()
      .references(() => trades.id, { onDelete: "cascade" }),
  },
  (table) => [primaryKey({ columns: [table.dailyOverviewId, table.tradeId] })],
);

export type DailyOverviewRow = typeof dailyOverviews.$inferSelect;
export type DailyOverviewInsert = typeof dailyOverviews.$inferInsert;
