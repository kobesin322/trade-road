export const JOURNAL_STRATEGIES = [
  "BouncyBall Breakout",
  "Backside trade",
  "Support zone rebounce",
  "Capitulation V",
] as const;

export type JournalStrategy = (typeof JOURNAL_STRATEGIES)[number];

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

export const JOURNAL_PAIR_OPTIONS = [
  { group: "Crypto", symbols: ["BTC-USD", "ETH-USD", "SOL-USD", "BNB-USD", "XRP-USD"] },
  { group: "US Stocks", symbols: ["AAPL", "MSFT", "NVDA", "TSLA", "SPY"] },
] as const;

export const JOURNAL_PAIR_VALUES = JOURNAL_PAIR_OPTIONS.flatMap((group) => group.symbols);

export function isJournalPair(value: string) {
  return JOURNAL_PAIR_VALUES.includes(value as (typeof JOURNAL_PAIR_VALUES)[number]);
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
  journalHtml: string;
  screenshots: TradeScreenshot[];
};

export type JournalScreenshotUpload = {
  name: string;
  dataUrl: string;
};
