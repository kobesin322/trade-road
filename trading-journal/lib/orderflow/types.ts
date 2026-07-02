export type DeltaMethod = "close_vs_prev" | "close_vs_midpoint";

export type SignalDirection = "long" | "short";

export type TradeExitReason = "take_profit" | "stop_loss" | "end_of_data";

export type OHLCVBar = {
  timestamp: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
};

export type OrderBookSnapshot = {
  bidSize: number;
  askSize: number;
};

export type OrderFlowBar = OHLCVBar & {
  barDelta: number;
  cumulativeDelta: number;
  orderBookImbalance?: number;
  supportLevel?: number;
  resistanceLevel?: number;
  isSupportTouch: boolean;
  isResistanceTouch: boolean;
  bounceStrength: number;
  deltaDivergence: "bullish" | "bearish" | null;
};

export type StrategyParams = {
  minTouches: number;
  levelLookback: number;
  volatilityLookback: number;
  volatilityFactor: number;
  bounceConfirmationBars: number;
  deltaThreshold: number;
  useDeltaDivergence: boolean;
  riskReward: number;
  stopBufferAtr: number;
  startingEquity: number;
  riskPerTradePercent: number;
  commissionPerTrade: number;
  slippageBps: number;
};

export type StrategySignal = {
  id: string;
  timestamp: number;
  index: number;
  direction: SignalDirection;
  entry: number;
  stopLoss: number;
  takeProfit: number;
  level: number;
  deltaConfirmation: number;
  bounceStrength: number;
  reason: string;
};

export type Trade = StrategySignal & {
  exitTimestamp: number;
  exitIndex: number;
  exitPrice: number;
  exitReason: TradeExitReason;
  quantity: number;
  grossPnl: number;
  netPnl: number;
  returnPercent: number;
  equityAfter: number;
};

export type EquityCurvePoint = {
  timestamp: number;
  equity: number;
  drawdown: number;
};

export type PerformanceMetrics = {
  totalTrades: number;
  wins: number;
  losses: number;
  winRate: number;
  grossProfit: number;
  grossLoss: number;
  profitFactor: number;
  expectancy: number;
  maxDrawdown: number;
  netPnl: number;
  returnPercent: number;
};

export type BacktestResult = {
  trades: Trade[];
  metrics: PerformanceMetrics;
  equityCurve: EquityCurvePoint[];
};

export const DEFAULT_STRATEGY_PARAMS: StrategyParams = {
  minTouches: 2,
  levelLookback: 24,
  volatilityLookback: 14,
  volatilityFactor: 0.45,
  bounceConfirmationBars: 3,
  deltaThreshold: 0.12,
  useDeltaDivergence: true,
  riskReward: 1.8,
  stopBufferAtr: 0.35,
  startingEquity: 10_000,
  riskPerTradePercent: 1,
  commissionPerTrade: 0,
  slippageBps: 0,
};
