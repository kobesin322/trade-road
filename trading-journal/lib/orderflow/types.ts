export type DeltaMethod = "close_vs_prev" | "close_vs_midpoint";

/** How OHLCV bar volume is painted into price bins (not tick-level prints). */
export type VolumeDistributionModel = "uniform" | "close_weighted";

export type ProfileMode = "developing" | "fixed_range" | "session" | "composite";

export type SessionPreset = "utc_day" | "america_new_york_day" | "rth_us_equities";

export type VolumeBin = {
  /** Bin low price (inclusive). */
  price: number;
  /** Mid price of the bin (for display / POC). */
  mid: number;
  volume: number;
};

export type VolumeProfileLevels = {
  poc: number;
  vah: number;
  val: number;
  valueAreaPercent: number;
  valueAreaVolume: number;
};

export type VolumeNode = {
  price: number;
  volume: number;
  kind: "hvn" | "lvn";
};

export type InitialBalance = {
  startTimestamp: number;
  endTimestamp: number;
  high: number;
  low: number;
  mid: number;
  barCount: number;
};

export type VolumeProfile = {
  mode: ProfileMode;
  bins: VolumeBin[];
  totalVolume: number;
  startTimestamp: number;
  endTimestamp: number;
  startIndex: number;
  endIndex: number;
  tickSize: number;
  levels: VolumeProfileLevels | null;
  nodes: VolumeNode[];
  initialBalance: InitialBalance | null;
  sessionKey?: string;
  sessionKeys?: string[];
};

export type VolumeProfileParams = {
  tickSize: number;
  valueAreaPercent: number;
  distribution: VolumeDistributionModel;
  /** HVN/LVN: standard deviations from mean (default 0.75). */
  nodeSigma: number;
  /** Minimum relative prominence vs max bin (0–1). */
  nodeMinProminence: number;
  /** Initial balance window in minutes from session open. */
  initialBalanceMinutes: number;
  sessionPreset: SessionPreset;
};

export const DEFAULT_VOLUME_PROFILE_PARAMS: VolumeProfileParams = {
  tickSize: 0.25,
  valueAreaPercent: 0.7,
  distribution: "uniform",
  nodeSigma: 0.75,
  nodeMinProminence: 0.08,
  initialBalanceMinutes: 60,
  sessionPreset: "america_new_york_day",
};

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
