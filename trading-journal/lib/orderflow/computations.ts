import type {
  DeltaMethod,
  OHLCVBar,
  OrderBookSnapshot,
  OrderFlowBar,
  StrategyParams,
  StrategySignal,
} from "@/lib/orderflow/types";

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

function average(values: number[]) {
  return values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : 0;
}

function trueRange(current: OHLCVBar, previous?: OHLCVBar) {
  if (!previous) {
    return current.high - current.low;
  }

  return Math.max(
    current.high - current.low,
    Math.abs(current.high - previous.close),
    Math.abs(current.low - previous.close),
  );
}

function averageTrueRange(data: OHLCVBar[], index: number, lookback: number) {
  const start = Math.max(0, index - lookback + 1);
  const ranges: number[] = [];

  for (let cursor = start; cursor <= index; cursor += 1) {
    ranges.push(trueRange(data[cursor], data[cursor - 1]));
  }

  return Math.max(average(ranges), Number.EPSILON);
}

function countTouches(bars: OHLCVBar[], level: number, tolerance: number, mode: "support" | "resistance") {
  return bars.reduce((touches, bar) => {
    const touched =
      mode === "support"
        ? Math.abs(bar.low - level) <= tolerance
        : Math.abs(bar.high - level) <= tolerance;

    return touches + (touched ? 1 : 0);
  }, 0);
}

function normalizeDelta(barDelta: number, volume: number) {
  return volume > 0 ? barDelta / volume : 0;
}

export function parseOHLCVCSV(csvText: string): OHLCVBar[] {
  const rows = csvText
    .split(/\r?\n/)
    .map((row) => row.trim())
    .filter(Boolean);

  if (rows.length < 2) {
    return [];
  }

  const headers = rows[0].split(",").map((header) => header.trim().toLowerCase());
  const indexOf = (aliases: string[]) => headers.findIndex((header) => aliases.includes(header));
  const timestampIndex = indexOf(["timestamp", "time", "date", "datetime"]);
  const openIndex = indexOf(["open", "o"]);
  const highIndex = indexOf(["high", "h"]);
  const lowIndex = indexOf(["low", "l"]);
  const closeIndex = indexOf(["close", "c"]);
  const volumeIndex = indexOf(["volume", "vol", "v"]);

  if ([timestampIndex, openIndex, highIndex, lowIndex, closeIndex, volumeIndex].some((index) => index < 0)) {
    return [];
  }

  return rows
    .slice(1)
    .map((row) => {
      const columns = row.split(",").map((column) => column.trim());
      const timestampValue = columns[timestampIndex];
      const parsedTimestamp = Number(timestampValue);
      const timestamp = Number.isFinite(parsedTimestamp) ? parsedTimestamp : Date.parse(timestampValue);
      const bar: OHLCVBar = {
        timestamp,
        open: Number(columns[openIndex]),
        high: Number(columns[highIndex]),
        low: Number(columns[lowIndex]),
        close: Number(columns[closeIndex]),
        volume: Number(columns[volumeIndex]),
      };

      return bar;
    })
    .filter((bar) =>
      [bar.timestamp, bar.open, bar.high, bar.low, bar.close, bar.volume].every(Number.isFinite),
    )
    .sort((left, right) => left.timestamp - right.timestamp);
}

export function createSampleBars(): OHLCVBar[] {
  const start = Date.now() - 220 * 15 * 60 * 1000;
  let close = 100;

  return Array.from({ length: 220 }, (_, index) => {
    const wave = Math.sin(index / 7) * 1.1 + Math.sin(index / 19) * 2.6;
    const drift = Math.sin(index / 31) * 0.35;
    const open = close;
    close = Math.max(80, close + wave * 0.18 + drift);
    const spread = 0.7 + Math.abs(Math.sin(index / 5)) * 1.1;

    return {
      timestamp: start + index * 15 * 60 * 1000,
      open,
      high: Math.max(open, close) + spread,
      low: Math.min(open, close) - spread,
      close,
      volume: 900 + Math.round(Math.abs(Math.sin(index / 9)) * 850 + (index % 13) * 26),
    };
  });
}

export function addBarDelta(data: OHLCVBar[], method: DeltaMethod = "close_vs_prev"): OrderFlowBar[] {
  return data.map((bar, index) => {
    const previous = data[index - 1];
    const midpoint = (bar.high + bar.low) / 2;
    const direction =
      method === "close_vs_midpoint"
        ? Math.sign(bar.close - midpoint)
        : Math.sign(bar.close - (previous?.close ?? bar.open));
    const fallbackDirection = Math.sign(bar.close - bar.open);
    const deltaDirection = direction || fallbackDirection;
    const range = Math.max(bar.high - bar.low, Number.EPSILON);
    const conviction = clamp(Math.abs(bar.close - bar.open) / range, 0.15, 1);

    return {
      ...bar,
      barDelta: bar.volume * conviction * deltaDirection,
      cumulativeDelta: 0,
      isSupportTouch: false,
      isResistanceTouch: false,
      bounceStrength: 0,
      deltaDivergence: null,
    };
  });
}

export function computeCVD(bars: OrderFlowBar[]) {
  let cumulativeDelta = 0;

  return bars.map((bar) => {
    cumulativeDelta += bar.barDelta;
    return {
      ...bar,
      cumulativeDelta,
    };
  });
}

export function computeOrderBookImbalance(snapshot: OrderBookSnapshot) {
  const totalDepth = snapshot.bidSize + snapshot.askSize;
  return totalDepth > 0 ? (snapshot.bidSize - snapshot.askSize) / totalDepth : 0;
}

export function detectTouchesAndBounces(bars: OrderFlowBar[], params: StrategyParams) {
  return bars.map((bar, index) => {
    const atr = averageTrueRange(bars, index, params.volatilityLookback);
    const tolerance = atr * params.volatilityFactor;
    const lookbackBars = bars.slice(Math.max(0, index - params.levelLookback), index);
    const supportLevel = lookbackBars.length ? Math.min(...lookbackBars.map((item) => item.low)) : undefined;
    const resistanceLevel = lookbackBars.length ? Math.max(...lookbackBars.map((item) => item.high)) : undefined;
    const supportTouches =
      supportLevel === undefined ? 0 : countTouches(lookbackBars, supportLevel, tolerance, "support");
    const resistanceTouches =
      resistanceLevel === undefined ? 0 : countTouches(lookbackBars, resistanceLevel, tolerance, "resistance");
    const isSupportTouch =
      supportLevel !== undefined &&
      supportTouches >= params.minTouches &&
      Math.abs(bar.low - supportLevel) <= tolerance &&
      bar.close > supportLevel;
    const isResistanceTouch =
      resistanceLevel !== undefined &&
      resistanceTouches >= params.minTouches &&
      Math.abs(bar.high - resistanceLevel) <= tolerance &&
      bar.close < resistanceLevel;
    const supportBounce = isSupportTouch ? clamp((bar.close - bar.low) / atr, 0, 3) : 0;
    const resistanceBounce = isResistanceTouch ? clamp((bar.high - bar.close) / atr, 0, 3) : 0;

    return {
      ...bar,
      supportLevel,
      resistanceLevel,
      isSupportTouch,
      isResistanceTouch,
      bounceStrength: Math.max(supportBounce, resistanceBounce),
    };
  });
}

export function addDeltaDivergence(bars: OrderFlowBar[]): OrderFlowBar[] {
  return bars.map((bar, index) => {
    const lookback = bars.slice(Math.max(0, index - 8), index);
    const previousLow = lookback.length ? Math.min(...lookback.map((item) => item.low)) : bar.low;
    const previousHigh = lookback.length ? Math.max(...lookback.map((item) => item.high)) : bar.high;
    const previousCvdLow = lookback.length ? Math.min(...lookback.map((item) => item.cumulativeDelta)) : bar.cumulativeDelta;
    const previousCvdHigh = lookback.length ? Math.max(...lookback.map((item) => item.cumulativeDelta)) : bar.cumulativeDelta;
    const bullish = bar.low <= previousLow && bar.cumulativeDelta > previousCvdLow;
    const bearish = bar.high >= previousHigh && bar.cumulativeDelta < previousCvdHigh;

    const deltaDivergence: OrderFlowBar["deltaDivergence"] = bullish
      ? "bullish"
      : bearish
        ? "bearish"
        : null;

    return {
      ...bar,
      deltaDivergence,
    };
  });
}

export function enhanceOrderFlowBars(
  data: OHLCVBar[],
  params: StrategyParams,
  method: DeltaMethod = "close_vs_prev",
): OrderFlowBar[] {
  return addDeltaDivergence(detectTouchesAndBounces(computeCVD(addBarDelta(data, method)), params));
}

export function generateEnhancedSignals(bars: OrderFlowBar[], params: StrategyParams): StrategySignal[] {
  const signals: StrategySignal[] = [];

  bars.forEach((bar, index) => {
    if (index < Math.max(params.levelLookback, params.volatilityLookback)) {
      return;
    }

    const atr = averageTrueRange(bars, index, params.volatilityLookback);
    const deltaConfirmation = normalizeDelta(bar.barDelta, bar.volume);
    const confirmedLongDelta =
      deltaConfirmation >= params.deltaThreshold ||
      (params.useDeltaDivergence && bar.deltaDivergence === "bullish");
    const confirmedShortDelta =
      deltaConfirmation <= -params.deltaThreshold ||
      (params.useDeltaDivergence && bar.deltaDivergence === "bearish");

    if (bar.isSupportTouch && confirmedLongDelta && bar.supportLevel !== undefined) {
      const entry = bar.close;
      const stopLoss = bar.supportLevel - atr * params.stopBufferAtr;
      const risk = Math.max(entry - stopLoss, Number.EPSILON);
      signals.push({
        id: `long-${bar.timestamp}-${index}`,
        timestamp: bar.timestamp,
        index,
        direction: "long",
        entry,
        stopLoss,
        takeProfit: entry + risk * params.riskReward,
        level: bar.supportLevel,
        deltaConfirmation,
        bounceStrength: bar.bounceStrength,
        reason: bar.deltaDivergence === "bullish" ? "Support bounce with bullish CVD divergence" : "Support bounce with positive bar delta",
      });
    }

    if (bar.isResistanceTouch && confirmedShortDelta && bar.resistanceLevel !== undefined) {
      const entry = bar.close;
      const stopLoss = bar.resistanceLevel + atr * params.stopBufferAtr;
      const risk = Math.max(stopLoss - entry, Number.EPSILON);
      signals.push({
        id: `short-${bar.timestamp}-${index}`,
        timestamp: bar.timestamp,
        index,
        direction: "short",
        entry,
        stopLoss,
        takeProfit: entry - risk * params.riskReward,
        level: bar.resistanceLevel,
        deltaConfirmation,
        bounceStrength: bar.bounceStrength,
        reason: bar.deltaDivergence === "bearish" ? "Resistance rejection with bearish CVD divergence" : "Resistance rejection with negative bar delta",
      });
    }
  });

  return signals;
}
