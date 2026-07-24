/**
 * OHLCV → proxy footprint cells, Bookmap-style heat trails, aggression bubbles,
 * and trapped buy/sell liquidity markers.
 *
 * Without true bid/ask / MBO tape we reconstruct research-grade order-flow visuals:
 * - Split bar volume across price bins in [low, high]
 * - Attribute bid (sell aggression) vs ask (buy aggression) from candle structure
 * - Persist residual heat so volume leaves denser horizontal trails (Bookmap-like)
 * - Score large aggressive prints (size + imbalance)
 * - Flag trapped buyside / sellside when aggression fails and price reverses
 */

import { binFloor, clamp, roundPrice } from "@/lib/orderflow/engine/math";
import type { DeltaMethod, OHLCVBar } from "@/lib/orderflow/types";

export type FootprintCell = {
  /** Bin floor price (inclusive). */
  price: number;
  /** Mid price of the bin. */
  mid: number;
  /** Proxy sell aggression (hits bids) — left side of footprint. */
  bidVolume: number;
  /** Proxy buy aggression (lifts offers) — right side of footprint. */
  askVolume: number;
  totalVolume: number;
  /** ask − bid */
  delta: number;
};

/** How aggressive a print is relative to the local series. */
export type AggressionTier = "normal" | "large" | "whale";

export type FootprintBubble = {
  barIndex: number;
  timestamp: number;
  price: number;
  volume: number;
  /** Net aggression: −1 sell … +1 buy */
  imbalance: number;
  side: "buy" | "sell" | "mixed";
  /** 0–1 combined volume + imbalance score */
  aggression: number;
  tier: AggressionTier;
};

/**
 * Trapped liquidity: aggressive side that lost the auction.
 * - buy  = trapped buyside (bought high / chased; price rejected lower)
 * - sell = trapped sellside (sold low / chased; price rejected higher)
 */
export type TrappedLiquidity = {
  barIndex: number;
  timestamp: number;
  price: number;
  side: "buy" | "sell";
  volume: number;
  /** 0–1 trap conviction */
  strength: number;
  reason: string;
  /** Absolute adverse excursion that confirmed the trap (price units). */
  adverseMove: number;
  /** How confirmation was earned. */
  confirm: "structure" | "cvd" | "rejection" | "structure+cvd";
};

/** Residual heat snapshot at one bar × price (for dense trails). */
export type HeatmapPoint = {
  barIndex: number;
  price: number;
  mid: number;
  heatBuy: number;
  heatSell: number;
  heatTotal: number;
};

export type FootprintBar = {
  index: number;
  timestamp: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
  /** Signed bar delta (ask − bid at bar level). */
  barDelta: number;
  /** Close location in bar range: 0 = low, 1 = high. */
  closePosition: number;
  cells: FootprintCell[];
  bubbles: FootprintBubble[];
  traps: TrappedLiquidity[];
};

export type FootprintParams = {
  tickSize: number;
  deltaMethod: DeltaMethod;
  /**
   * Minimum share of max cell volume to emit a bubble (0–1).
   * Lower = denser Bookmap dots.
   */
  bubbleMinShare: number;
  /** Soft cap on bubbles per bar (largest volume first). */
  maxBubblesPerBar: number;
  /** Residual heat decay per bar (0–1). Higher = longer trails. */
  heatDecay: number;
  /** Minimum residual heat (vs series max) to keep a trail point. */
  heatMinShare: number;
  /** Bars to look ahead when confirming a trap reversal. */
  trapLookahead: number;
  /** Minimum volume vs series avg to consider trap candidates. */
  trapMinVolumeRatio: number;
  /**
   * Minimum adverse move against the aggression as % of price (e.g. 0.18 = 0.18%).
   * Kills micro-bounce “noise traps” in trends.
   */
  trapMinAdversePercent: number;
  /** Floor on adverse move in ticks (tickSize × this). */
  trapMinAdverseTicks: number;
  /** Only large / whale aggression prints can seed a trap. */
  trapRequireLargePrint: boolean;
  /**
   * Minimum reverse through the aggression bar’s range (0–1).
   * Higher = fewer mid-trend micro-reversals.
   */
  trapMinRangeReverse: number;
  /**
   * Require structure break (HH after sell / LL after buy) and/or CVD flip
   * within the lookahead window.
   */
  trapRequireStructureOrCvd: boolean;
  /** Prefer traps where residual opposing heat still exists at the level. */
  trapPreferHeatContext: boolean;
  /** Soft-drop traps below this strength after scoring. */
  trapMinStrength: number;
  /** Cap markers kept (strongest first). */
  trapMaxCount: number;
};

export const DEFAULT_FOOTPRINT_PARAMS: FootprintParams = {
  tickSize: 0.25,
  deltaMethod: "close_vs_prev",
  bubbleMinShare: 0.08,
  maxBubblesPerBar: 14,
  heatDecay: 0.91,
  heatMinShare: 0.04,
  trapLookahead: 8,
  trapMinVolumeRatio: 1.25,
  // Strict defaults: quality traps at inflections, not every tick bounce
  trapMinAdversePercent: 0.18,
  trapMinAdverseTicks: 4,
  trapRequireLargePrint: true,
  trapMinRangeReverse: 0.72,
  trapRequireStructureOrCvd: true,
  trapPreferHeatContext: true,
  trapMinStrength: 0.42,
  trapMaxCount: 28,
};

/** Looser trap params — more markers, more mid-trend noise. */
export const SENSITIVE_TRAP_PARAMS: Partial<FootprintParams> = {
  trapLookahead: 6,
  trapMinVolumeRatio: 1.05,
  trapMinAdversePercent: 0.08,
  trapMinAdverseTicks: 2,
  trapRequireLargePrint: false,
  trapMinRangeReverse: 0.5,
  trapRequireStructureOrCvd: false,
  trapPreferHeatContext: false,
  trapMinStrength: 0.28,
  trapMaxCount: 80,
};

export type FootprintModel = {
  series: FootprintBar[];
  heatmap: HeatmapPoint[];
  traps: TrappedLiquidity[];
  maxHeat: number;
  maxAggression: number;
};

function listBinFloors(low: number, high: number, tickSize: number): number[] {
  const start = binFloor(Math.min(low, high), tickSize);
  const end = binFloor(Math.max(low, high), tickSize);
  const keys: number[] = [];
  for (let p = start; p <= end + tickSize * 0.5; p = roundPrice(p + tickSize, tickSize)) {
    keys.push(p);
    if (p >= end) {
      break;
    }
  }
  if (!keys.length) {
    keys.push(start);
  }
  return keys;
}

/**
 * Bar-level buy fraction in [0, 1].
 * 0.5 = balanced; >0.5 buy-dominant; <0.5 sell-dominant.
 */
export function barBuyFraction(
  bar: OHLCVBar,
  previous: OHLCVBar | undefined,
  method: DeltaMethod,
): number {
  const midpoint = (bar.high + bar.low) / 2;
  const direction =
    method === "close_vs_midpoint"
      ? Math.sign(bar.close - midpoint)
      : Math.sign(bar.close - (previous?.close ?? bar.open));
  const fallback = Math.sign(bar.close - bar.open);
  const signed = direction || fallback;
  const range = Math.max(bar.high - bar.low, Number.EPSILON);
  const conviction = clamp(Math.abs(bar.close - bar.open) / range, 0.12, 1);
  // Map signed conviction → buy share: −1 → ~0.12, 0 → 0.5, +1 → ~0.88
  return clamp(0.5 + signed * conviction * 0.38, 0.12, 0.88);
}

/**
 * Per-bin weights along the bar range.
 * Body receives more volume than wicks; close bin is boosted.
 */
function binVolumeWeights(keys: number[], bar: OHLCVBar, tickSize: number): number[] {
  if (!keys.length) {
    return [];
  }

  const bodyLow = Math.min(bar.open, bar.close);
  const bodyHigh = Math.max(bar.open, bar.close);
  const closeBin = binFloor(bar.close, tickSize);

  const raw = keys.map((floor) => {
    const mid = floor + tickSize / 2;
    const inBody = mid >= bodyLow - tickSize * 0.01 && mid <= bodyHigh + tickSize * 0.01;
    let w = inBody ? 1.35 : 0.55;
    if (floor === closeBin) {
      w += 0.85;
    }
    // Slight emphasis near extremes (where absorption / breakout prints cluster)
    const range = Math.max(bar.high - bar.low, Number.EPSILON);
    const edge = Math.min(Math.abs(mid - bar.low), Math.abs(bar.high - mid)) / range;
    if (edge < 0.12) {
      w += 0.25;
    }
    return w;
  });

  const sum = raw.reduce((a, b) => a + b, 0) || 1;
  return raw.map((w) => w / sum);
}

/**
 * Within a bar, bid/ask share varies by price level:
 * - Up bars: asks (buys) concentrate toward the high; bids toward the low
 * - Down bars: bids (sells) concentrate toward the low; asks toward the high
 */
function levelBuyShare(mid: number, bar: OHLCVBar, barBuy: number): number {
  const range = Math.max(bar.high - bar.low, Number.EPSILON);
  const pos = clamp((mid - bar.low) / range, 0, 1); // 0 at low, 1 at high
  const tilt = (barBuy - 0.5) * 0.55 * (pos - 0.5) * 2;
  return clamp(barBuy + tilt, 0.08, 0.92);
}

function closePosition(bar: OHLCVBar): number {
  const range = Math.max(bar.high - bar.low, Number.EPSILON);
  return clamp((bar.close - bar.low) / range, 0, 1);
}

function averageVolume(bars: OHLCVBar[]): number {
  if (!bars.length) {
    return 0;
  }
  return bars.reduce((s, b) => s + b.volume, 0) / bars.length;
}

export function buildFootprintBar(
  bar: OHLCVBar,
  index: number,
  previous: OHLCVBar | undefined,
  params: FootprintParams,
): FootprintBar {
  const tickSize = params.tickSize > 0 ? params.tickSize : 0.25;
  const keys = listBinFloors(bar.low, bar.high, tickSize);
  const weights = binVolumeWeights(keys, bar, tickSize);
  const buyFrac = barBuyFraction(bar, previous, params.deltaMethod);

  const cells: FootprintCell[] = keys.map((floor, i) => {
    const totalVolume = bar.volume * (weights[i] ?? 0);
    const mid = roundPrice(floor + tickSize / 2, tickSize);
    const askShare = levelBuyShare(mid, bar, buyFrac);
    const askVolume = totalVolume * askShare;
    const bidVolume = totalVolume * (1 - askShare);
    return {
      price: floor,
      mid,
      bidVolume,
      askVolume,
      totalVolume,
      delta: askVolume - bidVolume,
    };
  });

  const maxCellVol = cells.reduce((m, c) => Math.max(m, c.totalVolume), 0);
  const threshold = maxCellVol * clamp(params.bubbleMinShare, 0, 1);

  const bubbleCandidates = cells
    .filter((c) => c.totalVolume >= threshold && c.totalVolume > 0)
    .sort((a, b) => b.totalVolume - a.totalVolume)
    .slice(0, Math.max(1, params.maxBubblesPerBar));

  // Provisional aggression; refined after series percentiles
  const bubbles: FootprintBubble[] = bubbleCandidates.map((cell) => {
    const denom = cell.totalVolume || 1;
    const imbalance = clamp((cell.askVolume - cell.bidVolume) / denom, -1, 1);
    const side: FootprintBubble["side"] =
      imbalance > 0.12 ? "buy" : imbalance < -0.12 ? "sell" : "mixed";
    const aggression = clamp(Math.abs(imbalance) * 0.55 + 0.45, 0, 1);
    return {
      barIndex: index,
      timestamp: bar.timestamp,
      price: cell.mid,
      volume: cell.totalVolume,
      imbalance,
      side,
      aggression,
      tier: "normal" as AggressionTier,
    };
  });

  const barAsk = cells.reduce((s, c) => s + c.askVolume, 0);
  const barBid = cells.reduce((s, c) => s + c.bidVolume, 0);

  return {
    index,
    timestamp: bar.timestamp,
    open: bar.open,
    high: bar.high,
    low: bar.low,
    close: bar.close,
    volume: bar.volume,
    barDelta: barAsk - barBid,
    closePosition: closePosition(bar),
    cells,
    bubbles,
    traps: [],
  };
}

/**
 * Rank bubbles by volume percentile within the series and tag aggression tiers.
 * Whale = top ~8% volume with meaningful imbalance; large = top ~25%.
 */
export function scoreBubbleAggression(series: FootprintBar[]): number {
  const volumes = series.flatMap((b) => b.bubbles.map((x) => x.volume)).sort((a, b) => a - b);
  if (!volumes.length) {
    return 1;
  }

  const pct = (v: number) => {
    // rank fraction
    let lo = 0;
    let hi = volumes.length - 1;
    while (lo < hi) {
      const mid = (lo + hi) >> 1;
      if (volumes[mid] < v) {
        lo = mid + 1;
      } else {
        hi = mid;
      }
    }
    return volumes.length <= 1 ? 1 : lo / (volumes.length - 1);
  };

  let maxAggression = 0;
  for (const bar of series) {
    for (const bubble of bar.bubbles) {
      const volPct = pct(bubble.volume);
      const imb = Math.abs(bubble.imbalance);
      const aggression = clamp(volPct * 0.62 + imb * 0.38, 0, 1);
      bubble.aggression = aggression;
      if (volPct >= 0.92 && imb >= 0.18) {
        bubble.tier = "whale";
      } else if (volPct >= 0.75 && imb >= 0.12) {
        bubble.tier = "large";
      } else if (volPct >= 0.75) {
        bubble.tier = "large";
      } else {
        bubble.tier = "normal";
      }
      maxAggression = Math.max(maxAggression, aggression);
    }
  }
  return maxAggression || 1;
}

/**
 * Build residual heat trails: each bar's volume paints into bins and decays
 * forward, creating dense horizontal Bookmap-like paths.
 */
export function buildHeatmapTrails(
  series: FootprintBar[],
  params: FootprintParams,
): { heatmap: HeatmapPoint[]; maxHeat: number } {
  const decay = clamp(params.heatDecay, 0.5, 0.99);
  const tickSize = params.tickSize > 0 ? params.tickSize : 0.25;
  const residualBuy = new Map<number, number>();
  const residualSell = new Map<number, number>();
  const heatmap: HeatmapPoint[] = [];
  let maxHeat = 0;

  for (const bar of series) {
    // Decay residual heat
    for (const [key, val] of residualBuy) {
      const next = val * decay;
      if (next < 1e-9) {
        residualBuy.delete(key);
      } else {
        residualBuy.set(key, next);
      }
    }
    for (const [key, val] of residualSell) {
      const next = val * decay;
      if (next < 1e-9) {
        residualSell.delete(key);
      } else {
        residualSell.set(key, next);
      }
    }

    // Inject this bar's footprint volume
    for (const cell of bar.cells) {
      residualBuy.set(cell.price, (residualBuy.get(cell.price) ?? 0) + cell.askVolume);
      residualSell.set(cell.price, (residualSell.get(cell.price) ?? 0) + cell.bidVolume);
    }

    const keys = new Set([...residualBuy.keys(), ...residualSell.keys()]);
    for (const price of keys) {
      const heatBuy = residualBuy.get(price) ?? 0;
      const heatSell = residualSell.get(price) ?? 0;
      const heatTotal = heatBuy + heatSell;
      if (heatTotal <= 0) {
        continue;
      }
      maxHeat = Math.max(maxHeat, heatTotal, heatBuy, heatSell);
      heatmap.push({
        barIndex: bar.index,
        price,
        mid: roundPrice(price + tickSize / 2, tickSize),
        heatBuy,
        heatSell,
        heatTotal,
      });
    }
  }

  // Prune tiny residuals relative to peak (keeps canvas dense but not noisy)
  const minHeat = (maxHeat || 1) * clamp(params.heatMinShare, 0, 0.5);
  const filtered = heatmap.filter((p) => p.heatTotal >= minHeat);

  return { heatmap: filtered, maxHeat: maxHeat || 1 };
}

/** Minimum absolute adverse excursion (price units) to count as a real trap. */
export function minAdverseDistance(
  price: number,
  tickSize: number,
  params: Pick<FootprintParams, "trapMinAdversePercent" | "trapMinAdverseTicks">,
): number {
  const byPct = Math.abs(price) * (Math.max(0, params.trapMinAdversePercent) / 100);
  const byTicks = Math.max(tickSize, Number.EPSILON) * Math.max(0, params.trapMinAdverseTicks);
  return Math.max(byPct, byTicks, tickSize);
}

function bestAggressiveBubble(
  bar: FootprintBar,
  side: "buy" | "sell",
  requireLarge: boolean,
): FootprintBubble | null {
  const candidates = bar.bubbles.filter((b) => {
    if (b.side !== side) {
      return false;
    }
    if (!requireLarge) {
      return true;
    }
    return b.tier === "large" || b.tier === "whale";
  });
  if (!candidates.length) {
    return null;
  }
  return [...candidates].sort((a, b) => b.volume - a.volume || b.aggression - a.aggression)[0];
}

function pushTrap(
  traps: TrappedLiquidity[],
  trap: TrappedLiquidity,
  tickSize: number,
) {
  const nearDup = traps.some(
    (t) =>
      t.side === trap.side &&
      Math.abs(t.barIndex - trap.barIndex) <= 2 &&
      Math.abs(t.price - trap.price) <= tickSize * 2.5,
  );
  if (nearDup) {
    // Keep the stronger of near-duplicates
    const idx = traps.findIndex(
      (t) =>
        t.side === trap.side &&
        Math.abs(t.barIndex - trap.barIndex) <= 2 &&
        Math.abs(t.price - trap.price) <= tickSize * 2.5,
    );
    if (idx >= 0 && trap.strength > traps[idx].strength) {
      traps[idx] = trap;
    }
    return;
  }
  traps.push(trap);
}

/**
 * Detect trapped buy / sell liquidity from failed aggression + reverse.
 *
 * Strict filters (defaults) reduce mid-trend “noise traps”:
 * 1. Absolute adverse move (ticks and/or % of price) — not just a fraction of bar range
 * 2. Large/whale aggression only
 * 3. Structure break (HH after sell / LL after buy) and/or CVD flip in the window
 * 4. Optional residual heat context boost at the aggression level
 *
 * Same-bar rejection still allowed when the close itself travels enough adverse distance.
 */
export function detectTrappedLiquidity(
  series: FootprintBar[],
  bars: OHLCVBar[],
  params: FootprintParams,
): TrappedLiquidity[] {
  if (series.length < 2) {
    return [];
  }

  // Ensure aggression tiers exist (large/whale filter depends on them)
  scoreBubbleAggression(series);

  const avgVol = averageVolume(bars) || 1;
  const traps: TrappedLiquidity[] = [];
  const lookahead = Math.max(2, params.trapLookahead);
  const tickSize = params.tickSize > 0 ? params.tickSize : 0.25;
  const minRangeRev = clamp(params.trapMinRangeReverse, 0.35, 1);

  // Running proxy CVD for confirmation
  const cvd: number[] = [];
  let running = 0;
  for (const bar of series) {
    running += bar.barDelta;
    cvd.push(running);
  }

  // Residual heat maps for context (same decay as trails)
  const residualBuy = new Map<number, number>();
  const residualSell = new Map<number, number>();
  const decay = clamp(params.heatDecay, 0.5, 0.99);

  for (let i = 0; i < series.length; i += 1) {
    const bar = series[i];

    // Decay + inject heat before evaluating this bar's residual context
    for (const [key, val] of residualBuy) {
      const next = val * decay;
      if (next < 1e-9) {
        residualBuy.delete(key);
      } else {
        residualBuy.set(key, next);
      }
    }
    for (const [key, val] of residualSell) {
      const next = val * decay;
      if (next < 1e-9) {
        residualSell.delete(key);
      } else {
        residualSell.set(key, next);
      }
    }
    for (const cell of bar.cells) {
      residualBuy.set(cell.price, (residualBuy.get(cell.price) ?? 0) + cell.askVolume);
      residualSell.set(cell.price, (residualSell.get(cell.price) ?? 0) + cell.bidVolume);
    }

    if (bar.volume < avgVol * params.trapMinVolumeRatio) {
      continue;
    }

    const range = Math.max(bar.high - bar.low, Number.EPSILON);
    const buyVol = bar.cells.reduce((s, c) => s + c.askVolume, 0);
    const sellVol = bar.cells.reduce((s, c) => s + c.bidVolume, 0);
    const total = buyVol + sellVol || 1;
    const buyShare = buyVol / total;
    const sellShare = sellVol / total;
    const pos = bar.closePosition;
    const midPrice = (bar.high + bar.low) / 2;
    const minAdverse = minAdverseDistance(midPrice, tickSize, params);

    const buyPrint = bestAggressiveBubble(bar, "buy", params.trapRequireLargePrint);
    const sellPrint = bestAggressiveBubble(bar, "sell", params.trapRequireLargePrint);

    // If large-print required and bar has neither, skip (unless extreme side share + volume)
    const buyEligible =
      Boolean(buyPrint) ||
      (!params.trapRequireLargePrint && buyShare >= 0.6) ||
      (buyShare >= 0.68 && bar.volume >= avgVol * params.trapMinVolumeRatio * 1.4);
    const sellEligible =
      Boolean(sellPrint) ||
      (!params.trapRequireLargePrint && sellShare >= 0.6) ||
      (sellShare >= 0.68 && bar.volume >= avgVol * params.trapMinVolumeRatio * 1.4);

    // --- Same-bar rejection (must still clear absolute adverse distance) ---
    // Buy aggression but close weak: adverse = how far close sits below high
    if (buyEligible && buyShare >= 0.58 && pos <= 0.32) {
      const adverse = bar.high - bar.close;
      if (adverse >= minAdverse) {
        const peak =
          buyPrint ??
          [...bar.cells]
            .filter((c) => c.mid >= bar.low + range * 0.5)
            .sort((a, b) => b.askVolume - a.askVolume)[0];
        if (peak) {
          const price = "price" in peak && "aggression" in peak ? peak.price : (peak as FootprintCell).mid;
          const volume =
            "volume" in peak && "aggression" in peak
              ? peak.volume
              : (peak as FootprintCell).askVolume;
          const heatBoost = residualBuy.get(binFloor(price, tickSize)) ?? 0;
          const heatFactor = params.trapPreferHeatContext
            ? 1 + clamp(heatBoost / (avgVol + 1), 0, 0.35)
            : 1;
          const strength = clamp(
            ((buyShare - 0.5) * 2 * (1 - pos) * (bar.volume / (avgVol * 2)) +
              adverse / (midPrice * 0.01 + Number.EPSILON) * 0.08) *
              heatFactor,
            0.2,
            1,
          );
          pushTrap(
            traps,
            {
              barIndex: bar.index,
              timestamp: bar.timestamp,
              price,
              side: "buy",
              volume,
              strength,
              adverseMove: adverse,
              confirm: "rejection",
              reason: `TB rejection: buy aggression, closed weak (−${adverse.toFixed(2)} abs)`,
            },
            tickSize,
          );
        }
      }
    }

    if (sellEligible && sellShare >= 0.58 && pos >= 0.68) {
      const adverse = bar.close - bar.low;
      if (adverse >= minAdverse) {
        const peak =
          sellPrint ??
          [...bar.cells]
            .filter((c) => c.mid <= bar.low + range * 0.5)
            .sort((a, b) => b.bidVolume - a.bidVolume)[0];
        if (peak) {
          const price = "price" in peak && "aggression" in peak ? peak.price : (peak as FootprintCell).mid;
          const volume =
            "volume" in peak && "aggression" in peak
              ? peak.volume
              : (peak as FootprintCell).bidVolume;
          const heatBoost = residualSell.get(binFloor(price, tickSize)) ?? 0;
          const heatFactor = params.trapPreferHeatContext
            ? 1 + clamp(heatBoost / (avgVol + 1), 0, 0.35)
            : 1;
          const strength = clamp(
            ((sellShare - 0.5) * 2 * pos * (bar.volume / (avgVol * 2)) +
              adverse / (midPrice * 0.01 + Number.EPSILON) * 0.08) *
              heatFactor,
            0.2,
            1,
          );
          pushTrap(
            traps,
            {
              barIndex: bar.index,
              timestamp: bar.timestamp,
              price,
              side: "sell",
              volume,
              strength,
              adverseMove: adverse,
              confirm: "rejection",
              reason: `TS rejection: sell aggression, closed strong (+${adverse.toFixed(2)} abs)`,
            },
            tickSize,
          );
        }
      }
    }

    // --- Forward confirmation window ---
    const end = Math.min(series.length - 1, i + lookahead);
    if (end <= i) {
      continue;
    }

    let futureHigh = bar.high;
    let futureLow = bar.low;
    let maxCvd = cvd[i];
    let minCvd = cvd[i];
    for (let j = i + 1; j <= end; j += 1) {
      futureHigh = Math.max(futureHigh, series[j].high);
      futureLow = Math.min(futureLow, series[j].low);
      maxCvd = Math.max(maxCvd, cvd[j]);
      minCvd = Math.min(minCvd, cvd[j]);
    }

    const cvdUp = maxCvd - cvd[i];
    const cvdDown = cvd[i] - minCvd;
    // CVD move significant vs recent average |barDelta|
    const avgAbsDelta =
      series
        .slice(Math.max(0, i - 20), i + 1)
        .reduce((s, b) => s + Math.abs(b.barDelta), 0) / Math.min(21, i + 1) || 1;
    const cvdSignificantUp = cvdUp >= avgAbsDelta * 1.25;
    const cvdSignificantDown = cvdDown >= avgAbsDelta * 1.25;

    // TB: buy push then meaningful downside reverse
    if (buyEligible && buyShare >= 0.54 && (bar.barDelta > 0 || Boolean(buyPrint))) {
      const anchor = buyPrint?.price ?? bar.high;
      const adverse = anchor - futureLow;
      const rangeReverse = (bar.high - futureLow) / range;
      const structureBreak = futureLow < bar.low; // lower low after buy push
      const cvdFlip = cvdSignificantDown;

      if (
        adverse >= minAdverse &&
        rangeReverse >= minRangeRev &&
        futureLow < bar.close
      ) {
        const confirmOk =
          !params.trapRequireStructureOrCvd || structureBreak || cvdFlip;
        if (confirmOk) {
          const peakVol = buyPrint?.volume ?? buyVol;
          const heatBoost = residualBuy.get(binFloor(anchor, tickSize)) ?? 0;
          const heatFactor = params.trapPreferHeatContext
            ? 1 + clamp(heatBoost / (avgVol + 1), 0, 0.4)
            : 1;
          // Prefer heat context: if enabled and no residual buy heat, soft-penalize
          const heatPenalty =
            params.trapPreferHeatContext && heatBoost < avgVol * 0.05 ? 0.85 : 1;
          const confirm: TrappedLiquidity["confirm"] =
            structureBreak && cvdFlip
              ? "structure+cvd"
              : structureBreak
                ? "structure"
                : cvdFlip
                  ? "cvd"
                  : "rejection";
          const strength = clamp(
            (rangeReverse * 0.45 +
              buyShare * 0.25 +
              (bar.volume / (avgVol * 2)) * 0.2 +
              (structureBreak ? 0.12 : 0) +
              (cvdFlip ? 0.1 : 0) +
              (buyPrint?.tier === "whale" ? 0.1 : buyPrint?.tier === "large" ? 0.05 : 0)) *
              heatFactor *
              heatPenalty,
            0.15,
            1,
          );
          pushTrap(
            traps,
            {
              barIndex: bar.index,
              timestamp: bar.timestamp,
              price: anchor,
              side: "buy",
              volume: peakVol,
              strength,
              adverseMove: adverse,
              confirm,
              reason: `TB: buy print reversed ${adverse.toFixed(2)} (${Math.round(rangeReverse * 100)}% range) · ${confirm}`,
            },
            tickSize,
          );
        }
      }
    }

    // TS: sell push then meaningful upside reverse
    if (sellEligible && sellShare >= 0.54 && (bar.barDelta < 0 || Boolean(sellPrint))) {
      const anchor = sellPrint?.price ?? bar.low;
      const adverse = futureHigh - anchor;
      const rangeReverse = (futureHigh - bar.low) / range;
      const structureBreak = futureHigh > bar.high; // higher high after sell push
      const cvdFlip = cvdSignificantUp;

      if (
        adverse >= minAdverse &&
        rangeReverse >= minRangeRev &&
        futureHigh > bar.close
      ) {
        const confirmOk =
          !params.trapRequireStructureOrCvd || structureBreak || cvdFlip;
        if (confirmOk) {
          const peakVol = sellPrint?.volume ?? sellVol;
          const heatBoost = residualSell.get(binFloor(anchor, tickSize)) ?? 0;
          const heatFactor = params.trapPreferHeatContext
            ? 1 + clamp(heatBoost / (avgVol + 1), 0, 0.4)
            : 1;
          const heatPenalty =
            params.trapPreferHeatContext && heatBoost < avgVol * 0.05 ? 0.85 : 1;
          const confirm: TrappedLiquidity["confirm"] =
            structureBreak && cvdFlip
              ? "structure+cvd"
              : structureBreak
                ? "structure"
                : cvdFlip
                  ? "cvd"
                  : "rejection";
          const strength = clamp(
            (rangeReverse * 0.45 +
              sellShare * 0.25 +
              (bar.volume / (avgVol * 2)) * 0.2 +
              (structureBreak ? 0.12 : 0) +
              (cvdFlip ? 0.1 : 0) +
              (sellPrint?.tier === "whale" ? 0.1 : sellPrint?.tier === "large" ? 0.05 : 0)) *
              heatFactor *
              heatPenalty,
            0.15,
            1,
          );
          pushTrap(
            traps,
            {
              barIndex: bar.index,
              timestamp: bar.timestamp,
              price: anchor,
              side: "sell",
              volume: peakVol,
              strength,
              adverseMove: adverse,
              confirm,
              reason: `TS: sell print reversed ${adverse.toFixed(2)} (${Math.round(rangeReverse * 100)}% range) · ${confirm}`,
            },
            tickSize,
          );
        }
      }
    }
  }

  const filtered = traps
    .filter((t) => t.strength >= params.trapMinStrength)
    .sort((a, b) => b.strength - a.strength);

  const maxCount = Math.max(4, params.trapMaxCount);
  return filtered.slice(0, maxCount);
}

export function buildFootprintSeries(
  bars: OHLCVBar[],
  partial?: Partial<FootprintParams>,
): FootprintBar[] {
  const params: FootprintParams = {
    ...DEFAULT_FOOTPRINT_PARAMS,
    ...partial,
  };

  return bars.map((bar, index) => buildFootprintBar(bar, index, bars[index - 1], params));
}

/**
 * Full footprint model: series + denser heat trails + aggression + traps.
 */
export function buildFootprintModel(
  bars: OHLCVBar[],
  partial?: Partial<FootprintParams>,
): FootprintModel {
  const params: FootprintParams = {
    ...DEFAULT_FOOTPRINT_PARAMS,
    ...partial,
  };

  const series = bars.map((bar, index) => buildFootprintBar(bar, index, bars[index - 1], params));
  const maxAggression = scoreBubbleAggression(series);
  const { heatmap, maxHeat } = buildHeatmapTrails(series, params);
  const traps = detectTrappedLiquidity(series, bars, params);

  // Attach traps to bars for easy tooltip grouping
  const trapsByBar = new Map<number, TrappedLiquidity[]>();
  for (const trap of traps) {
    const list = trapsByBar.get(trap.barIndex) ?? [];
    list.push(trap);
    trapsByBar.set(trap.barIndex, list);
  }
  for (const bar of series) {
    bar.traps = trapsByBar.get(bar.index) ?? [];
  }

  return {
    series,
    heatmap,
    traps,
    maxHeat,
    maxAggression,
  };
}

export function footprintVolumeExtents(series: FootprintBar[]) {
  let maxCellVolume = 0;
  let maxBubbleVolume = 0;
  let maxAbsDelta = 0;

  for (const bar of series) {
    for (const cell of bar.cells) {
      maxCellVolume = Math.max(maxCellVolume, cell.totalVolume, cell.bidVolume, cell.askVolume);
      maxAbsDelta = Math.max(maxAbsDelta, Math.abs(cell.delta));
    }
    for (const bubble of bar.bubbles) {
      maxBubbleVolume = Math.max(maxBubbleVolume, bubble.volume);
    }
  }

  return {
    maxCellVolume: maxCellVolume || 1,
    maxBubbleVolume: maxBubbleVolume || 1,
    maxAbsDelta: maxAbsDelta || 1,
  };
}

/** Suggest tick size from price magnitude when user leaves auto. */
export function suggestTickSize(bars: OHLCVBar[]): number {
  if (!bars.length) {
    return 0.25;
  }
  const sample = bars.slice(-Math.min(bars.length, 80));
  const avgPrice =
    sample.reduce((s, b) => s + (b.high + b.low) / 2, 0) / sample.length;
  const avgRange =
    sample.reduce((s, b) => s + Math.max(b.high - b.low, 0), 0) / sample.length;

  if (avgPrice >= 10_000) {
    return Math.max(0.25, roundNice(avgRange / 12));
  }
  if (avgPrice >= 500) {
    return Math.max(0.05, roundNice(avgRange / 10));
  }
  if (avgPrice >= 50) {
    return Math.max(0.01, roundNice(avgRange / 10));
  }
  if (avgPrice >= 1) {
    return Math.max(0.001, roundNice(avgRange / 10));
  }
  return Math.max(0.0001, roundNice(avgRange / 10));
}

function roundNice(value: number): number {
  if (!Number.isFinite(value) || value <= 0) {
    return 0.25;
  }
  const exp = Math.floor(Math.log10(value));
  const base = 10 ** exp;
  const mantissa = value / base;
  const nice = mantissa <= 1 ? 1 : mantissa <= 2 ? 2 : mantissa <= 5 ? 5 : 10;
  return nice * base;
}
