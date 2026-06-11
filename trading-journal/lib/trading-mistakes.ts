export const TRADING_MISTAKE_OPTIONS = [
  { key: "overtrading", label: "Overtrading" },
  { key: "over_focus", label: "Over-focus on 1–2 stocks" },
  { key: "over_position", label: "Over-position / oversized" },
  { key: "not_focusing", label: "Not focusing" },
  { key: "emotional_trading", label: "Emotional trading" },
  { key: "chased_entry", label: "Chased entry" },
  { key: "moved_stop", label: "Moved stop loss" },
  { key: "revenge_trade", label: "Revenge trading" },
  { key: "fomo_entry", label: "FOMO entry" },
  { key: "no_plan", label: "Traded without a plan" },
  { key: "held_loser", label: "Held loser too long" },
  { key: "cut_winner_early", label: "Cut winner too early" },
  { key: "ignored_risk", label: "Ignored risk rules" },
] as const;

export type TradingMistakeKey = (typeof TRADING_MISTAKE_OPTIONS)[number]["key"];

const VALID_KEYS = new Set<string>(TRADING_MISTAKE_OPTIONS.map((option) => option.key));

export function normalizeMistakeFlags(value: unknown): string[] {
  if (!Array.isArray(value)) {
    return [];
  }
  return value.filter((item): item is TradingMistakeKey => typeof item === "string" && VALID_KEYS.has(item));
}

export function mistakeLabel(key: string) {
  return TRADING_MISTAKE_OPTIONS.find((option) => option.key === key)?.label ?? key;
}

export function countMistakes(flags: string[]) {
  return flags.length;
}
