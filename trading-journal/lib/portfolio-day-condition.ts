import type { Portfolio, PortfolioDayCondition } from "@/lib/ls-portfolio-types";

const DAY_CONDITION_FLAG_KEYS = [
  "overtrading",
  "over_focus",
  "over_position",
  "not_focusing",
  "emotional_trading",
] as const satisfies ReadonlyArray<keyof PortfolioDayCondition>;

export function portfolioToDayCondition(portfolio: Portfolio): PortfolioDayCondition {
  return {
    overtrading: portfolio.overtrading,
    over_focus: portfolio.over_focus,
    over_position: portfolio.over_position,
    not_focusing: portfolio.not_focusing,
    emotional_trading: portfolio.emotional_trading,
    market_confidence: portfolio.market_confidence,
    self_confidence: portfolio.self_confidence,
  };
}

export function countActiveFlags(condition: PortfolioDayCondition) {
  return DAY_CONDITION_FLAG_KEYS.filter((key) => condition[key]).length;
}

export function dayConditionHasContent(condition: PortfolioDayCondition) {
  return (
    countActiveFlags(condition) > 0 ||
    condition.market_confidence !== 50 ||
    condition.self_confidence !== 50
  );
}

export function confidenceLabel(value: number) {
  if (value >= 80) {
    return "High";
  }
  if (value >= 60) {
    return "Solid";
  }
  if (value >= 40) {
    return "Neutral";
  }
  if (value >= 20) {
    return "Low";
  }
  return "Very low";
}
