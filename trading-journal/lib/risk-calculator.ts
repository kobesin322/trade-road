export type RiskCalculatorSide = "LONG" | "SHORT";

export type RiskCalculatorInput = {
  side: RiskCalculatorSide;
  riskDollars: number;
  capital: number;
  leverage: number;
  entry: number;
  takeProfit: number;
  stopLoss: number;
};

export type RiskCalculatorResult = {
  valid: boolean;
  errors: string[];
  tpPercent: number | null;
  slPercent: number | null;
  rewardRiskRatio: number | null;
  positionSize: number | null;
  notionalValue: number | null;
  riskPercentOfCapital: number | null;
  expectedProfitDollars: number | null;
  buyingPower: number | null;
  usesLeveragePct: number | null;
};

function round(value: number, digits = 4) {
  const factor = 10 ** digits;
  return Math.round(value * factor) / factor;
}

export function computeRiskCalculator(input: RiskCalculatorInput): RiskCalculatorResult {
  const errors: string[] = [];
  const { side, riskDollars, capital, leverage, entry, takeProfit, stopLoss } = input;

  if (!Number.isFinite(riskDollars) || riskDollars <= 0) {
    errors.push("Risk must be greater than zero.");
  }
  if (!Number.isFinite(capital) || capital <= 0) {
    errors.push("Capital must be greater than zero.");
  }
  if (!Number.isFinite(leverage) || leverage < 1 || leverage > 100) {
    errors.push("Leverage must be between 1x and 100x.");
  }
  if (!Number.isFinite(entry) || entry <= 0) {
    errors.push("Entry price must be greater than zero.");
  }
  if (!Number.isFinite(takeProfit) || takeProfit <= 0) {
    errors.push("Take-profit price must be greater than zero.");
  }
  if (!Number.isFinite(stopLoss) || stopLoss <= 0) {
    errors.push("Stop-loss price must be greater than zero.");
  }

  if (errors.length > 0) {
    return emptyResult(errors);
  }

  const riskPerUnit =
    side === "LONG" ? entry - stopLoss : stopLoss - entry;
  const rewardPerUnit =
    side === "LONG" ? takeProfit - entry : entry - takeProfit;

  if (side === "LONG") {
    if (stopLoss >= entry) {
      errors.push("For longs, stop-loss must be below entry.");
    }
    if (takeProfit <= entry) {
      errors.push("For longs, take-profit must be above entry.");
    }
  } else {
    if (stopLoss <= entry) {
      errors.push("For shorts, stop-loss must be above entry.");
    }
    if (takeProfit >= entry) {
      errors.push("For shorts, take-profit must be below entry.");
    }
  }

  if (riskPerUnit <= 0) {
    errors.push("Stop-loss distance must be positive.");
  }
  if (rewardPerUnit <= 0) {
    errors.push("Take-profit distance must be positive.");
  }

  if (errors.length > 0) {
    return emptyResult(errors);
  }

  const tpPercent =
    side === "LONG"
      ? ((takeProfit - entry) / entry) * 100
      : ((entry - takeProfit) / entry) * 100;
  const slPercent =
    side === "LONG"
      ? ((entry - stopLoss) / entry) * 100
      : ((stopLoss - entry) / entry) * 100;
  const rewardRiskRatio = rewardPerUnit / riskPerUnit;
  const positionSize = riskDollars / riskPerUnit;
  const notionalValue = positionSize * entry;
  const buyingPower = capital * leverage;
  const riskPercentOfCapital = (riskDollars / capital) * 100;
  const expectedProfitDollars = riskDollars * rewardRiskRatio;
  const usesLeveragePct = buyingPower > 0 ? (notionalValue / buyingPower) * 100 : null;

  if (notionalValue > buyingPower) {
    errors.push(
      `Position notional (${notionalValue.toFixed(0)}) exceeds buying power (${buyingPower.toFixed(0)}).`,
    );
  }

  return {
    valid: errors.length === 0,
    errors,
    tpPercent: round(tpPercent, 2),
    slPercent: round(slPercent, 2),
    rewardRiskRatio: round(rewardRiskRatio, 2),
    positionSize: round(positionSize, 4),
    notionalValue: round(notionalValue, 2),
    riskPercentOfCapital: round(riskPercentOfCapital, 2),
    expectedProfitDollars: round(expectedProfitDollars, 2),
    buyingPower: round(buyingPower, 2),
    usesLeveragePct: usesLeveragePct !== null ? round(usesLeveragePct, 1) : null,
  };
}

function emptyResult(errors: string[]): RiskCalculatorResult {
  return {
    valid: false,
    errors,
    tpPercent: null,
    slPercent: null,
    rewardRiskRatio: null,
    positionSize: null,
    notionalValue: null,
    riskPercentOfCapital: null,
    expectedProfitDollars: null,
    buyingPower: null,
    usesLeveragePct: null,
  };
}

export function formatRiskRatio(value: number | null) {
  if (value === null) {
    return "—";
  }
  return `1 : ${value.toFixed(2)}`;
}

export function buildCalculatorJournalHtml(input: RiskCalculatorInput, result: RiskCalculatorResult) {
  const lines = [
    "<h3>Risk calculator plan</h3>",
    "<ul>",
    `<li><strong>Side:</strong> ${input.side}</li>`,
    `<li><strong>Entry:</strong> $${input.entry}</li>`,
    `<li><strong>Take profit:</strong> $${input.takeProfit} (${result.tpPercent?.toFixed(2) ?? "—"}%)</li>`,
    `<li><strong>Stop loss:</strong> $${input.stopLoss} (${result.slPercent?.toFixed(2) ?? "—"}%)</li>`,
    `<li><strong>Risk:</strong> $${input.riskDollars} (${result.riskPercentOfCapital?.toFixed(2) ?? "—"}% of capital)</li>`,
    `<li><strong>Capital:</strong> $${input.capital}</li>`,
    `<li><strong>Leverage:</strong> ${input.leverage}x</li>`,
    `<li><strong>Position size:</strong> ${result.positionSize ?? "—"}</li>`,
    `<li><strong>R:R:</strong> ${formatRiskRatio(result.rewardRiskRatio)}</li>`,
    `<li><strong>Expected profit:</strong> $${result.expectedProfitDollars ?? "—"}</li>`,
    "</ul>",
  ];
  return lines.join("");
}
