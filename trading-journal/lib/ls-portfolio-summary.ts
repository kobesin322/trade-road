import { computeAllPositions, computePools, computeRiskDollars, computeRiskRewardRatio } from "@/lib/ls-portfolio";
import {
  fetchBenchmarkAndSymbolReturns,
  RS_BENCHMARK,
  RS_DEFAULT_RANGE,
} from "@/lib/ls-portfolio-relative-strength";
import {
  BOOK_TYPE_LABELS,
  type BookAttribution,
  type BookSlice,
  type ComputedPosition,
  type Portfolio,
  type PortfolioRiskSummary,
  type PortfolioSummary,
  type Position,
  type PositionBookType,
  type PositionSide,
  type RelativeStrengthRow,
  type RelativeStrengthSummary,
} from "@/lib/ls-portfolio-types";

function emptySlice(): BookSlice {
  return {
    market_value: 0,
    unrealized_pnl: 0,
    position_count: 0,
    total_risk_dollars: 0,
    risk_positions_count: 0,
  };
}

function addToSlice(slice: BookSlice, position: ComputedPosition) {
  slice.market_value += position.market_value;
  slice.unrealized_pnl += position.unrealized_pnl;
  slice.position_count += 1;
  if (position.risk_dollars !== null && position.risk_dollars > 0) {
    slice.total_risk_dollars += position.risk_dollars;
    slice.risk_positions_count += 1;
  }
}

export function computeBookAttribution(positions: ComputedPosition[]): BookAttribution {
  const attribution: BookAttribution = {
    core_long: emptySlice(),
    core_short: emptySlice(),
    tactical_long: emptySlice(),
    tactical_short: emptySlice(),
    long_total: emptySlice(),
    short_total: emptySlice(),
    core_total: emptySlice(),
    tactical_total: emptySlice(),
  };

  for (const position of positions) {
    const key = `${position.book_type}_${position.side}` as
      | "core_long"
      | "core_short"
      | "tactical_long"
      | "tactical_short";
    addToSlice(attribution[key], position);
    addToSlice(position.side === "long" ? attribution.long_total : attribution.short_total, position);
    addToSlice(
      position.book_type === "core" ? attribution.core_total : attribution.tactical_total,
      position,
    );
  }

  return attribution;
}

export function computePortfolioRiskSummary(
  positions: ComputedPosition[],
  totalPool: number,
): PortfolioRiskSummary {
  const withRisk = positions.filter((p) => p.risk_dollars !== null && p.risk_dollars > 0);
  const totalRisk = withRisk.reduce((sum, p) => sum + (p.risk_dollars ?? 0), 0);
  const maxRisk = withRisk.reduce<PortfolioRiskSummary["max_risk_position"]>((best, p) => {
    const risk = p.risk_dollars ?? 0;
    if (!best || risk > best.risk_dollars) {
      return { symbol: p.symbol, side: p.side, risk_dollars: risk };
    }
    return best;
  }, null);

  return {
    total_risk_dollars: totalRisk,
    positions_with_stop: withRisk.length,
    positions_without_stop: positions.length - withRisk.length,
    avg_risk_per_trade: withRisk.length > 0 ? totalRisk / withRisk.length : null,
    max_risk_position: maxRisk,
    risk_pct_of_total_pool: totalPool > 0 ? (totalRisk / totalPool) * 100 : 0,
  };
}

export function buildRelativeStrengthSummary(
  positions: ComputedPosition[],
  benchmarkReturnPct: number,
  symbolReturns: Map<string, number | null>,
  range: string,
): RelativeStrengthSummary {
  const rows: RelativeStrengthRow[] = positions.map((position) => {
    const positionReturn = symbolReturns.get(position.symbol.toUpperCase()) ?? position.pnl_percent;
    const rsSpread = positionReturn - benchmarkReturnPct;
    const rsRatio =
      benchmarkReturnPct !== 0 ? (1 + positionReturn / 100) / (1 + benchmarkReturnPct / 100) : null;

    return {
      position_id: position.id,
      symbol: position.symbol,
      side: position.side,
      book_type: position.book_type,
      position_return_pct: positionReturn,
      benchmark_return_pct: benchmarkReturnPct,
      rs_spread: rsSpread,
      rs_ratio: rsRatio,
    };
  });

  rows.sort((a, b) => b.rs_spread - a.rs_spread);

  return {
    benchmark: RS_BENCHMARK,
    range,
    benchmark_return_pct: benchmarkReturnPct,
    rows,
    as_of: new Date().toISOString(),
  };
}

export async function buildPortfolioSummary(
  positions: Position[],
  portfolio: Portfolio,
  options: { includeRelativeStrength?: boolean; rsRange?: string } = {},
): Promise<PortfolioSummary> {
  const pools = computePools(positions, portfolio);
  const computed = computeAllPositions(positions, portfolio);
  const attribution = computeBookAttribution(computed);
  const risk = computePortfolioRiskSummary(computed, pools.total_pool);

  let relative_strength: RelativeStrengthSummary | null = null;

  if (options.includeRelativeStrength !== false && computed.length > 0) {
    const range = options.rsRange ?? RS_DEFAULT_RANGE;
    try {
      const { benchmark, symbols } = await fetchBenchmarkAndSymbolReturns(
        computed.map((p) => p.symbol),
        range,
      );
      const returnMap = new Map(symbols.map((row) => [row.symbol, row.return_pct]));
      relative_strength = buildRelativeStrengthSummary(
        computed,
        benchmark.return_pct ?? 0,
        returnMap,
        range,
      );
    } catch {
      relative_strength = null;
    }
  }

  return {
    pools,
    attribution,
    risk,
    relative_strength,
    positions: computed,
  };
}

export function bookSliceLabel(book: PositionBookType, side: PositionSide) {
  return `${BOOK_TYPE_LABELS[book]} ${side === "long" ? "Long" : "Short"}`;
}

export function rsTone(spread: number) {
  if (spread >= 2) {
    return "outperform" as const;
  }
  if (spread <= -2) {
    return "underperform" as const;
  }
  return "neutral" as const;
}

// Re-export for convenience in UI
export { computeRiskDollars, computeRiskRewardRatio };
