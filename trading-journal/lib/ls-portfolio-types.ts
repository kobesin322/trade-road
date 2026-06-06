export type PositionSide = "long" | "short";

export type Portfolio = {
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
