import { JOURNAL_TICKER_GROUPS } from "@/lib/ticker-symbols";
import { isMarketSymbolFormat } from "@/lib/market-data/custom-watchlist";

export const SYSTEM_JOURNAL_STRATEGIES = [
  "BouncyBall Breakout",
  "Backside trade",
  "Support zone rebounce",
  "Capitulation V",
] as const;

/** @deprecated Use SYSTEM_JOURNAL_STRATEGIES */
export const JOURNAL_STRATEGIES = SYSTEM_JOURNAL_STRATEGIES;

export type SystemJournalStrategy = (typeof SYSTEM_JOURNAL_STRATEGIES)[number];

/** Any strategy label — system default or user-defined. */
export type JournalStrategy = string;

export const TRADE_SPECIES = ["Stocks", "Perps", "Futures"] as const;

export type TradeSpecies = (typeof TRADE_SPECIES)[number];

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

export function isTradeSpecies(value: string): value is TradeSpecies {
  return TRADE_SPECIES.includes(value as TradeSpecies);
}

export type TradeScreenshot = {
  name: string;
  url: string;
};

export const JOURNAL_STRATEGY_COLORS: Record<SystemJournalStrategy, string> = {
  "BouncyBall Breakout": "#38bdf8",
  "Backside trade": "#facc15",
  "Support zone rebounce": "#a78bfa",
  "Capitulation V": "#fb7185",
};

const LEGACY_STRATEGY_MAP: Record<string, SystemJournalStrategy> = {
  "Strategy #1": "BouncyBall Breakout",
  "Strategy #2": "Backside trade",
  "Strategy #3": "Support zone rebounce",
};

export function isSystemJournalStrategy(value: string): value is SystemJournalStrategy {
  return SYSTEM_JOURNAL_STRATEGIES.includes(value as SystemJournalStrategy);
}

/** @deprecated Use isSystemJournalStrategy for defaults only */
export function isJournalStrategy(value: string): value is SystemJournalStrategy {
  return isSystemJournalStrategy(value);
}

export function normalizeJournalStrategy(value: string): string {
  const trimmed = value.trim();
  if (!trimmed) {
    return SYSTEM_JOURNAL_STRATEGIES[0];
  }
  if (isSystemJournalStrategy(trimmed)) {
    return trimmed;
  }
  if (trimmed in LEGACY_STRATEGY_MAP) {
    return LEGACY_STRATEGY_MAP[trimmed];
  }
  return trimmed;
}

function hashStrategyColor(name: string) {
  let hash = 0;
  for (let index = 0; index < name.length; index += 1) {
    hash = name.charCodeAt(index) + ((hash << 5) - hash);
  }
  const hue = Math.abs(hash) % 360;
  return `hsl(${hue} 70% 62%)`;
}

export function getJournalStrategyColor(
  name: string,
  customColors: Record<string, string> = {},
) {
  if (isSystemJournalStrategy(name)) {
    return JOURNAL_STRATEGY_COLORS[name];
  }
  if (customColors[name]) {
    return customColors[name];
  }
  return hashStrategyColor(name);
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
  species: TradeSpecies;
  outcome: "WIN" | "LOSS";
  profitPercent: number;
  profitAmount: number;
  position: "LONG" | "SHORT";
  stopLoss?: number | null;
  takeProfit?: number | null;
  riskRewardRatio?: number | null;
  entryPoint?: number | null;
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

export type UserJournalStrategy = {
  id: string;
  name: string;
  description?: string | null;
  color?: string | null;
  sortOrder: number;
  createdAt: string;
  updatedAt: string;
};

export type UserJournalStrategyInput = {
  name: string;
  description?: string | null;
  color?: string | null;
  sortOrder?: number;
};

export type UserJournalStrategyPatch = Partial<UserJournalStrategyInput>;

export function buildCustomStrategyColorMap(strategies: UserJournalStrategy[]) {
  return Object.fromEntries(
    strategies
      .filter((strategy) => strategy.color)
      .map((strategy) => [strategy.name, strategy.color as string]),
  );
}
