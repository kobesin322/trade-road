import type {
  BacktestResult,
  EquityCurvePoint,
  OHLCVBar,
  PerformanceMetrics,
  StrategyParams,
  StrategySignal,
  Trade,
  TradeExitReason,
} from "@/lib/orderflow/types";

function applySlippage(price: number, direction: "long" | "short", side: "entry" | "exit", slippageBps: number) {
  const adjustment = price * (slippageBps / 10_000);
  const paysUp = (direction === "long" && side === "entry") || (direction === "short" && side === "exit");
  return paysUp ? price + adjustment : price - adjustment;
}

function getExit(signal: StrategySignal, bar: OHLCVBar) {
  if (signal.direction === "long") {
    const hitStop = bar.low <= signal.stopLoss;
    const hitTarget = bar.high >= signal.takeProfit;

    if (hitStop && hitTarget) {
      return { price: signal.stopLoss, reason: "stop_loss" as const };
    }

    if (hitStop) {
      return { price: signal.stopLoss, reason: "stop_loss" as const };
    }

    if (hitTarget) {
      return { price: signal.takeProfit, reason: "take_profit" as const };
    }
  } else {
    const hitStop = bar.high >= signal.stopLoss;
    const hitTarget = bar.low <= signal.takeProfit;

    if (hitStop && hitTarget) {
      return { price: signal.stopLoss, reason: "stop_loss" as const };
    }

    if (hitStop) {
      return { price: signal.stopLoss, reason: "stop_loss" as const };
    }

    if (hitTarget) {
      return { price: signal.takeProfit, reason: "take_profit" as const };
    }
  }

  return null;
}

function calculateMetrics(
  trades: Trade[],
  equityCurve: EquityCurvePoint[],
  startingEquity: number,
): PerformanceMetrics {
  const wins = trades.filter((trade) => trade.netPnl > 0);
  const losses = trades.filter((trade) => trade.netPnl <= 0);
  const grossProfit = wins.reduce((sum, trade) => sum + trade.netPnl, 0);
  const grossLoss = Math.abs(losses.reduce((sum, trade) => sum + trade.netPnl, 0));
  const endingEquity = equityCurve.at(-1)?.equity ?? startingEquity;
  const netPnl = endingEquity - startingEquity;

  return {
    totalTrades: trades.length,
    wins: wins.length,
    losses: losses.length,
    winRate: trades.length ? wins.length / trades.length : 0,
    grossProfit,
    grossLoss,
    profitFactor: grossLoss > 0 ? grossProfit / grossLoss : grossProfit > 0 ? Number.POSITIVE_INFINITY : 0,
    expectancy: trades.length ? trades.reduce((sum, trade) => sum + trade.netPnl, 0) / trades.length : 0,
    maxDrawdown: equityCurve.reduce((maxDrawdown, point) => Math.max(maxDrawdown, point.drawdown), 0),
    netPnl,
    returnPercent: startingEquity > 0 ? netPnl / startingEquity : 0,
  };
}

export function runBacktest(
  bars: OHLCVBar[],
  signals: StrategySignal[],
  params: StrategyParams,
): BacktestResult {
  let equity = params.startingEquity;
  let peakEquity = equity;
  const trades: Trade[] = [];
  const equityCurve: EquityCurvePoint[] = [
    {
      timestamp: bars[0]?.timestamp ?? Date.now(),
      equity,
      drawdown: 0,
    },
  ];

  for (const signal of signals) {
    const entryBar = bars[signal.index + 1];
    if (!entryBar) {
      continue;
    }

    const rawEntry = entryBar.open || signal.entry;
    const entry = applySlippage(rawEntry, signal.direction, "entry", params.slippageBps);
    const riskPerUnit = Math.abs(entry - signal.stopLoss);
    const capitalRisk = equity * (params.riskPerTradePercent / 100);
    const quantity = riskPerUnit > 0 ? capitalRisk / riskPerUnit : 0;

    if (!Number.isFinite(quantity) || quantity <= 0) {
      continue;
    }

    let exitPrice = bars.at(-1)?.close ?? entry;
    let exitTimestamp = bars.at(-1)?.timestamp ?? signal.timestamp;
    let exitIndex = bars.length - 1;
    let exitReason: TradeExitReason = "end_of_data";

    for (let cursor = signal.index + 1; cursor < bars.length; cursor += 1) {
      const exit = getExit(signal, bars[cursor]);
      if (exit) {
        exitPrice = exit.price;
        exitTimestamp = bars[cursor].timestamp;
        exitIndex = cursor;
        exitReason = exit.reason;
        break;
      }
    }

    const slippedExit = applySlippage(exitPrice, signal.direction, "exit", params.slippageBps);
    const grossPnl =
      signal.direction === "long"
        ? (slippedExit - entry) * quantity
        : (entry - slippedExit) * quantity;
    const netPnl = grossPnl - params.commissionPerTrade * 2;

    equity += netPnl;
    peakEquity = Math.max(peakEquity, equity);
    const drawdown = peakEquity > 0 ? (peakEquity - equity) / peakEquity : 0;

    trades.push({
      ...signal,
      entry,
      exitTimestamp,
      exitIndex,
      exitPrice: slippedExit,
      exitReason,
      quantity,
      grossPnl,
      netPnl,
      returnPercent: entry > 0 ? (slippedExit - entry) / entry : 0,
      equityAfter: equity,
    });
    equityCurve.push({
      timestamp: exitTimestamp,
      equity,
      drawdown,
    });
  }

  return {
    trades,
    equityCurve,
    metrics: calculateMetrics(trades, equityCurve, params.startingEquity),
  };
}
