import { sql } from "drizzle-orm";
import {
  jsonb,
  numeric,
  pgTable,
  text,
  timestamp,
  uuid,
} from "drizzle-orm/pg-core";

export type ChartPoint = { time: string; price: number };

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
  chartData: jsonb("chart_data")
    .$type<ChartPoint[]>()
    .notNull()
    .default(sql`'[]'::jsonb`),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export type TradeRow = typeof trades.$inferSelect;
export type TradeInsert = typeof trades.$inferInsert;
