import { JOURNAL_TICKER_GROUPS } from "@/lib/ticker-symbols";
import { isMarketSymbolFormat } from "@/lib/market-data/custom-watchlist";

export const JOURNAL_STRATEGIES = [
  "BouncyBall Breakout",
  "Backside trade",
  "Support zone rebounce",
  "Capitulation V",
] as const;

export type JournalStrategy = (typeof JOURNAL_STRATEGIES)[number];

export const TRADE_SELF_RATINGS = ["A+", "A", "B+", "B", "C+", "C", "D"] as const;

export type TradeSelfRating = (typeof TRADE_SELF_RATINGS)[number];

export const TRADE_SELF_RATING_FIELDS = [
  { key: "ratingOverall", label: "Overall trade" },
  { key: "ratingSizing", label: "Sizing Management" },
  { key: "ratingEntry", label: "Entry" },
  { key: "ratingExit", label: "Exit Management" },
] as const;

export type TradeSelfRatingField = (typeof TRADE_SELF_RATING_FIELDS)[number]["key"];

export function isTradeSelfRating(value: string): value is TradeSelfRating {
  return TRADE_SELF_RATINGS.includes(value as TradeSelfRating);
}

export type TradeScreenshot = {
  name: string;
  url: string;
};

export const JOURNAL_STRATEGY_COLORS: Record<JournalStrategy, string> = {
  "BouncyBall Breakout": "#38bdf8",
  "Backside trade": "#facc15",
  "Support zone rebounce": "#a78bfa",
  "Capitulation V": "#fb7185",
};

const LEGACY_STRATEGY_MAP: Record<string, JournalStrategy> = {
  "Strategy #1": "BouncyBall Breakout",
  "Strategy #2": "Backside trade",
  "Strategy #3": "Support zone rebounce",
};

export function normalizeJournalStrategy(value: string): JournalStrategy {
  if (JOURNAL_STRATEGIES.includes(value as JournalStrategy)) {
    return value as JournalStrategy;
  }
  return LEGACY_STRATEGY_MAP[value] ?? "BouncyBall Breakout";
}

export function isJournalStrategy(value: string): value is JournalStrategy {
  return JOURNAL_STRATEGIES.includes(value as JournalStrategy);
}

export const JOURNAL_PAIR_OPTIONS = JOURNAL_TICKER_GROUPS;

export const JOURNAL_PAIR_VALUES = JOURNAL_PAIR_OPTIONS.flatMap((group) => group.symbols);

export function isJournalPair(value: string) {
  const normalized = value.trim();
  if (JOURNAL_PAIR_VALUES.includes(normalized as (typeof JOURNAL_PAIR_VALUES)[number])) {
    return true;
  }

  return isMarketSymbolFormat(normalized);
}

export type JournalEntryInput = {
  id?: string;
  pair: string;
  date: string;
  strategy: JournalStrategy;
  outcome: "WIN" | "LOSS";
  profitPercent: number;
  profitAmount: number;
  position: "LONG" | "SHORT";
  stopLoss?: number | null;
  takeProfit?: number | null;
  riskRewardRatio?: number | null;
  ratingOverall?: TradeSelfRating | null;
  ratingSizing?: TradeSelfRating | null;
  ratingEntry?: TradeSelfRating | null;
  ratingExit?: TradeSelfRating | null;
  levelPushes: TradeLevelPushInput[];
  journalHtml: string;
  screenshots: TradeScreenshot[];
};

export type TradeLevelPushLevelType = "SL" | "TP";

export type TradeLevelPush = {
  id: string;
  levelType: TradeLevelPushLevelType;
  price: number;
  pushedAt: string;
  note?: string | null;
};

export type TradeLevelPushInput = {
  id?: string;
  clientId?: string;
  levelType: TradeLevelPushLevelType;
  price: number;
  pushedAt: string;
  note?: string | null;
};

export type JournalScreenshotUpload = {
  name: string;
  dataUrl: string;
};
