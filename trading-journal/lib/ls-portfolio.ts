import type {
  ComputedPosition,
  Portfolio,
  PortfolioPools,
  Position,
  PositionSide,
  TakeProfitPreview,
  RebalancePreview,
} from "@/lib/ls-portfolio-types";

export function formatCurrency(value: number, compact = false) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    notation: compact && Math.abs(value) >= 10000 ? "compact" : "standard",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value);
}

export function formatPercent(value: number, digits = 2) {
  const sign = value > 0 ? "+" : "";
  return `${sign}${value.toFixed(digits)}%`;
}

export function formatQuantity(value: number) {
  return new Intl.NumberFormat("en-US", {
    maximumFractionDigits: value % 1 === 0 ? 0 : 2,
  }).format(value);
}

export function computeMarketValue(quantity: number, currentPrice: number) {
  return quantity * currentPrice;
}

export function computeUnrealizedPnl(
  side: PositionSide,
  quantity: number,
  avgEntryPrice: number,
  currentPrice: number,
) {
  if (side === "long") {
    return (currentPrice - avgEntryPrice) * quantity;
  }
  return (avgEntryPrice - currentPrice) * quantity;
}

export function computePnlPercent(
  side: PositionSide,
  avgEntryPrice: number,
  currentPrice: number,
) {
  if (avgEntryPrice <= 0) {
    return 0;
  }
  if (side === "long") {
    return ((currentPrice - avgEntryPrice) / avgEntryPrice) * 100;
  }
  return ((avgEntryPrice - currentPrice) / avgEntryPrice) * 100;
}

export function computePosition(position: Position, sidePool: number): ComputedPosition {
  const market_value = computeMarketValue(position.quantity, position.current_price);
  const unrealized_pnl = computeUnrealizedPnl(
    position.side,
    position.quantity,
    position.avg_entry_price,
    position.current_price,
  );
  const pnl_percent = computePnlPercent(
    position.side,
    position.avg_entry_price,
    position.current_price,
  );
  const percent_of_pool = sidePool > 0 ? (market_value / sidePool) * 100 : 0;

  return {
    ...position,
    market_value,
    unrealized_pnl,
    pnl_percent,
    percent_of_pool,
  };
}

export function computePools(positions: Position[], portfolio: Portfolio): PortfolioPools {
  const longPositions = positions.filter((p) => p.side === "long");
  const shortPositions = positions.filter((p) => p.side === "short");

  const long_mv = longPositions.reduce(
    (sum, p) => sum + computeMarketValue(p.quantity, p.current_price),
    0,
  );
  const short_mv = shortPositions.reduce(
    (sum, p) => sum + computeMarketValue(p.quantity, p.current_price),
    0,
  );

  const long_pool = long_mv + portfolio.long_cash;
  const short_pool = short_mv + portfolio.short_cash;
  const total_pool = long_pool + short_pool;
  const current_long_pct = total_pool > 0 ? long_pool / total_pool : 0;
  const target_long_pct = portfolio.target_long_ratio;
  const drift = current_long_pct - target_long_pct;

  const total_unrealized_pnl = positions.reduce(
    (sum, p) =>
      sum + computeUnrealizedPnl(p.side, p.quantity, p.avg_entry_price, p.current_price),
    0,
  );

  return {
    long_mv,
    short_mv,
    long_pool,
    short_pool,
    total_pool,
    current_long_pct,
    target_long_pct,
    drift,
    gross_exposure: long_mv + short_mv,
    net_exposure: long_mv - short_mv,
    total_unrealized_pnl,
  };
}

export function computeAllPositions(
  positions: Position[],
  portfolio: Portfolio,
): ComputedPosition[] {
  const pools = computePools(positions, portfolio);
  return positions.map((position) =>
    computePosition(
      position,
      position.side === "long" ? pools.long_pool : pools.short_pool,
    ),
  );
}

export function calculateTakeProfitPreview(
  position: Position,
  portfolio: Portfolio,
  allPositions: Position[],
  input: { sell_qty?: number; sell_pct?: number },
): TakeProfitPreview {
  const sell_qty = clampSellQty(
    position,
    input.sell_qty ?? (position.quantity * (input.sell_pct ?? 30)) / 100,
  );
  const sell_pct = position.quantity > 0 ? (sell_qty / position.quantity) * 100 : 0;
  const realized_pnl = computeUnrealizedPnl(
    position.side,
    sell_qty,
    position.avg_entry_price,
    position.current_price,
  );

  const cash_delta =
    position.side === "long"
      ? sell_qty * position.current_price
      : -(sell_qty * position.current_price);

  const before = computePools(allPositions, portfolio);

  const updatedPositions = allPositions.map((p) =>
    p.id === position.id ? { ...p, quantity: Math.max(0, p.quantity - sell_qty) } : p,
  );
  const filtered = updatedPositions.filter((p) => p.quantity > 0);

  const updatedPortfolio: Portfolio = {
    ...portfolio,
    long_cash:
      position.side === "long" ? portfolio.long_cash + cash_delta : portfolio.long_cash,
    short_cash:
      position.side === "short" ? portfolio.short_cash + cash_delta : portfolio.short_cash,
  };

  const after = computePools(filtered, updatedPortfolio);

  return {
    sell_qty,
    sell_pct,
    realized_pnl,
    cash_delta,
    remaining_qty: Math.max(0, position.quantity - sell_qty),
    before,
    after,
  };
}

export function calculateRebalancePreview(
  portfolio: Portfolio,
  positions: Position[],
): RebalancePreview {
  const before = computePools(positions, portfolio);
  const targetLongPool = before.total_pool * portfolio.target_long_ratio;
  const targetShortPool = before.total_pool * portfolio.target_short_ratio;

  let transfer_amount = 0;
  let direction: RebalancePreview["direction"] = "none";

  if (before.long_pool > targetLongPool + 0.01) {
    transfer_amount = before.long_pool - targetLongPool;
    direction = "long_to_short";
  } else if (before.short_pool > targetShortPool + 0.01) {
    transfer_amount = before.short_pool - targetShortPool;
    direction = "short_to_long";
  }

  const afterPortfolio: Portfolio =
    direction === "long_to_short"
      ? {
          ...portfolio,
          long_cash: portfolio.long_cash - transfer_amount,
          short_cash: portfolio.short_cash + transfer_amount,
        }
      : direction === "short_to_long"
        ? {
            ...portfolio,
            long_cash: portfolio.long_cash + transfer_amount,
            short_cash: portfolio.short_cash - transfer_amount,
          }
        : portfolio;

  return {
    transfer_amount,
    direction,
    before,
    after: computePools(positions, afterPortfolio),
  };
}

function clampSellQty(position: Position, rawQty: number) {
  const qty = Math.max(0, Math.min(position.quantity, rawQty));
  return Math.round(qty * 10000) / 10000;
}

export function formatEventSummary(event: {
  event_type: string;
  payload: Record<string, unknown> | null;
}): string {
  const payload = event.payload ?? {};
  switch (event.event_type) {
    case "TAKE_PROFIT":
      return `Took ${formatPercent(Number(payload.sell_pct ?? 0), 0)} profit on ${payload.symbol ?? "position"} → ${formatCurrency(Number(payload.realized_pnl ?? 0))} realized`;
    case "REBALANCE_CASH":
      return `Rebalanced ${formatCurrency(Number(payload.transfer_amount ?? 0))} ${payload.direction === "long_to_short" ? "Long → Short" : "Short → Long"}`;
    case "ADD_POSITION":
      return `Added ${formatQuantity(Number(payload.quantity ?? 0))} ${payload.symbol ?? ""} @ ${formatCurrency(Number(payload.avg_entry_price ?? 0))}`;
    case "DELETE_POSITION":
      return `Removed ${payload.symbol ?? "position"}`;
    case "PRICE_UPDATE":
      return `Updated ${payload.symbol ?? "position"} price to ${formatCurrency(Number(payload.current_price ?? 0))}`;
    case "MANUAL_EDIT":
      return `Edited ${payload.symbol ?? "position"}`;
    case "CASH_ADJUST":
      return `Adjusted ${payload.pool ?? "cash"} by ${formatCurrency(Number(payload.amount ?? 0))}`;
    default:
      return event.event_type.replaceAll("_", " ").toLowerCase();
  }
}

// TODO: live price sync via edge function + Polygon/Yahoo
