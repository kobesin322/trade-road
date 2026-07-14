import { sql } from "drizzle-orm";
import {
  boolean,
  date,
  integer,
  jsonb,
  numeric,
  pgEnum,
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

export const userWatchlistTickers = pgTable(
  "user_watchlist_tickers",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id").notNull(),
    yahooSymbol: text("yahoo_symbol").notNull(),
    label: text("label").notNull(),
    tradingViewSymbol: text("trading_view_symbol").notNull(),
    assetClass: text("asset_class").notNull(),
    quoteType: text("quote_type"),
    exchange: text("exchange"),
    sortOrder: integer("sort_order").notNull().default(0),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [unique("user_watchlist_tickers_user_symbol_unique").on(table.userId, table.yahooSymbol)],
);

export type UserWatchlistTickerRow = typeof userWatchlistTickers.$inferSelect;
export type UserWatchlistTickerInsert = typeof userWatchlistTickers.$inferInsert;

export const dailyOverviews = pgTable(
  "daily_overviews",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id").notNull(),
    overviewDate: date("overview_date").notNull(),
    tradePerformanceHtml: text("trade_performance_html"),
    preTradeListHtml: text("pre_trade_list_html"),
    marketAnalysisHtml: text("market_analysis_html"),
    preTradeListScreenshots: jsonb("pre_trade_list_screenshots")
      .$type<TradeScreenshot[]>()
      .notNull()
      .default(sql`'[]'::jsonb`),
    marketAnalysisScreenshots: jsonb("market_analysis_screenshots")
      .$type<TradeScreenshot[]>()
      .notNull()
      .default(sql`'[]'::jsonb`),
    mistakeFlags: jsonb("mistake_flags")
      .$type<string[]>()
      .notNull()
      .default(sql`'[]'::jsonb`),
    mistakesNotes: text("mistakes_notes"),
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

export const positionSideEnum = pgEnum("position_side", ["long", "short"]);
export const positionBookTypeEnum = pgEnum("position_book_type", ["core", "tactical"]);

export const portfolios = pgTable(
  "portfolios",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id").notNull(),
    snapshotDate: date("snapshot_date").notNull().defaultNow(),
    name: text("name").notNull().default("Daily L/S Snapshot"),
    targetLongRatio: numeric("target_long_ratio").notNull().default("0.600"),
    targetShortRatio: numeric("target_short_ratio").notNull().default("0.400"),
    longCash: numeric("long_cash").notNull().default("0"),
    shortCash: numeric("short_cash").notNull().default("0"),
    notes: text("notes"),
    flagOvertrading: boolean("flag_overtrading").notNull().default(false),
    flagOverFocus: boolean("flag_over_focus").notNull().default(false),
    flagOverPosition: boolean("flag_over_position").notNull().default(false),
    flagNotFocusing: boolean("flag_not_focusing").notNull().default(false),
    flagEmotionalTrading: boolean("flag_emotional_trading").notNull().default(false),
    marketConfidence: numeric("market_confidence").notNull().default("50"),
    selfConfidence: numeric("self_confidence").notNull().default("50"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [unique("portfolios_user_snapshot_unique").on(table.userId, table.snapshotDate)],
);

export const positions = pgTable("positions", {
  id: uuid("id").primaryKey().defaultRandom(),
  portfolioId: uuid("portfolio_id")
    .notNull()
    .references(() => portfolios.id, { onDelete: "cascade" }),
  side: positionSideEnum("side").notNull(),
  bookType: positionBookTypeEnum("book_type").notNull().default("tactical"),
  symbol: text("symbol").notNull(),
  quantity: numeric("quantity").notNull(),
  avgEntryPrice: numeric("avg_entry_price").notNull(),
  currentPrice: numeric("current_price").notNull(),
  stopLossPrice: numeric("stop_loss_price"),
  targetPrice: numeric("target_price"),
  notes: text("notes"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const portfolioEvents = pgTable("portfolio_events", {
  id: uuid("id").primaryKey().defaultRandom(),
  portfolioId: uuid("portfolio_id")
    .notNull()
    .references(() => portfolios.id, { onDelete: "cascade" }),
  eventType: text("event_type").notNull(),
  positionId: uuid("position_id").references(() => positions.id, { onDelete: "set null" }),
  payload: jsonb("payload").$type<Record<string, unknown>>(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export type PortfolioRow = typeof portfolios.$inferSelect;
export type PositionRow = typeof positions.$inferSelect;
export type PortfolioEventRow = typeof portfolioEvents.$inferSelect;
