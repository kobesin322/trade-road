export type PositionSide = "long" | "short";
export type PositionBookType = "core" | "tactical";

export const BOOK_TYPE_LABELS: Record<PositionBookType, string> = {
  core: "Core",
  tactical: "Tactical",
};

export type PortfolioDayCondition = {
  overtrading: boolean;
  over_focus: boolean;
  over_position: boolean;
  not_focusing: boolean;
  emotional_trading: boolean;
  market_confidence: number;
  self_confidence: number;
};

export const DAY_CONDITION_FLAGS = [
  { key: "overtrading" as const, label: "Overtrading" },
  { key: "over_focus" as const, label: "Over-focus on 1–2 stocks" },
  { key: "over_position" as const, label: "Over-position" },
  { key: "not_focusing" as const, label: "Not focusing" },
  { key: "emotional_trading" as const, label: "Emotional trading" },
];

export type Portfolio = PortfolioDayCondition & {
  id: string;
  user_id: string;
  snapshot_date: string;
  name: string;
  target_long_ratio: number;
  target_short_ratio: number;
  long_cash: number;
  short_cash: number;
  notes: string | null;
  created_at: string;
  updated_at: string;
};

export type Position = {
  id: string;
  portfolio_id: string;
  side: PositionSide;
  book_type: PositionBookType;
  symbol: string;
  quantity: number;
  avg_entry_price: number;
  current_price: number;
  stop_loss_price: number | null;
  target_price: number | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
};

export type PortfolioEvent = {
  id: string;
  portfolio_id: string;
  event_type: string;
  position_id: string | null;
  payload: Record<string, unknown> | null;
  created_at: string;
};

export type ComputedPosition = Position & {
  market_value: number;
  unrealized_pnl: number;
  pnl_percent: number;
  percent_of_pool: number;
  risk_dollars: number | null;
  risk_pct_of_pool: number | null;
  risk_reward_ratio: number | null;
};

export type BookSlice = {
  market_value: number;
  unrealized_pnl: number;
  position_count: number;
  total_risk_dollars: number;
  risk_positions_count: number;
};

export type BookAttribution = {
  core_long: BookSlice;
  core_short: BookSlice;
  tactical_long: BookSlice;
  tactical_short: BookSlice;
  long_total: BookSlice;
  short_total: BookSlice;
  core_total: BookSlice;
  tactical_total: BookSlice;
};

export type PortfolioRiskSummary = {
  total_risk_dollars: number;
  positions_with_stop: number;
  positions_without_stop: number;
  avg_risk_per_trade: number | null;
  max_risk_position: { symbol: string; side: PositionSide; risk_dollars: number } | null;
  risk_pct_of_total_pool: number;
};

export type RelativeStrengthRow = {
  position_id: string;
  symbol: string;
  side: PositionSide;
  book_type: PositionBookType;
  position_return_pct: number;
  benchmark_return_pct: number;
  rs_spread: number;
  rs_ratio: number | null;
};

export type RelativeStrengthSummary = {
  benchmark: string;
  range: string;
  benchmark_return_pct: number;
  rows: RelativeStrengthRow[];
  as_of: string;
};

export type PortfolioSummary = {
  pools: PortfolioPools;
  attribution: BookAttribution;
  risk: PortfolioRiskSummary;
  relative_strength: RelativeStrengthSummary | null;
  positions: ComputedPosition[];
};

export type PortfolioPools = {
  long_mv: number;
  short_mv: number;
  long_pool: number;
  short_pool: number;
  total_pool: number;
  current_long_pct: number;
  target_long_pct: number;
  drift: number;
  gross_exposure: number;
  net_exposure: number;
  total_unrealized_pnl: number;
};

export type PortfolioSnapshot = {
  portfolio: Portfolio;
  positions: Position[];
  events: PortfolioEvent[];
  snapshot_dates: string[];
};

export type TakeProfitPreview = {
  sell_qty: number;
  sell_pct: number;
  realized_pnl: number;
  cash_delta: number;
  remaining_qty: number;
  before: PortfolioPools;
  after: PortfolioPools;
};

export type RebalancePreview = {
  transfer_amount: number;
  direction: "long_to_short" | "short_to_long" | "none";
  before: PortfolioPools;
  after: PortfolioPools;
};
