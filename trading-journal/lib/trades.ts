import type { JournalStrategy, TradeScreenshot, TradeLevelPush } from "@/lib/journal-constants";

import { eachDayOfInterval, endOfMonth, format, startOfMonth } from "date-fns";

export type TradeOutcome = "WIN" | "LOSS";

export type Trade = {
  id: string;
  pair: string;
  date: string;
  outcome: TradeOutcome;
  profitPercent: number;
  profitAmount: number;
  strategy: JournalStrategy;
  position: "LONG" | "SHORT";
  notes?: string | null;
  stopLoss?: number | null;
  takeProfit?: number | null;
  riskRewardRatio?: number | null;
  levelPushes?: TradeLevelPush[];
  journalHtml?: string | null;
  screenshots?: TradeScreenshot[];
  chartData: {
    time: string;
    price: number;
  }[];
};

const buildChart = (base: number, moves: number[]) =>
  moves.map((move, index) => ({
    time: `${index + 1}`,
    price: Number((base + move).toFixed(2)),
  }));

export const sampleTrades: Trade[] = [
  {
    id: "tj-001",
    pair: "TRUMP/USDT",
    date: "2026-03-02",
    outcome: "WIN",
    profitPercent: 4.4,
    profitAmount: 44,
    strategy: "BouncyBall Breakout",
    position: "LONG",
    chartData: buildChart(18.4, [0, 0.2, -0.1, 0.45, 0.72, 1.1, 1.42, 1.31]),
  },
  {
    id: "tj-002",
    pair: "INJ/USDT",
    date: "2026-03-03",
    outcome: "WIN",
    profitPercent: 3.8,
    profitAmount: 38,
    strategy: "Backside trade",
    position: "LONG",
    chartData: buildChart(32.1, [0, -0.25, 0.15, 0.52, 0.8, 0.7, 1.16, 1.29]),
  },
  {
    id: "tj-003",
    pair: "XMR/USDT",
    date: "2026-03-04",
    outcome: "LOSS",
    profitPercent: -2.2,
    profitAmount: -22,
    strategy: "Support zone rebounce",
    position: "SHORT",
    chartData: buildChart(221, [0, 0.6, 0.3, -0.2, -0.7, -1.1, -1.5, -1.9]),
  },
  {
    id: "tj-004",
    pair: "ADA/USDT",
    date: "2026-03-05",
    outcome: "WIN",
    profitPercent: 3.1,
    profitAmount: 31,
    strategy: "BouncyBall Breakout",
    position: "LONG",
    chartData: buildChart(0.72, [0, 0.01, 0, 0.02, 0.04, 0.035, 0.055, 0.067]),
  },
  {
    id: "tj-005",
    pair: "CRV/USDT",
    date: "2026-03-06",
    outcome: "WIN",
    profitPercent: 2.8,
    profitAmount: 28,
    strategy: "Support zone rebounce",
    position: "LONG",
    chartData: buildChart(0.58, [0, 0.018, 0.01, 0.024, 0.035, 0.03, 0.052, 0.061]),
  },
  {
    id: "tj-006",
    pair: "XRP/USDT",
    date: "2026-03-07",
    outcome: "LOSS",
    profitPercent: -1.8,
    profitAmount: -18,
    strategy: "BouncyBall Breakout",
    position: "SHORT",
    chartData: buildChart(2.41, [0, 0.03, 0.02, -0.01, -0.025, -0.038, -0.044, -0.051]),
  },
  {
    id: "tj-007",
    pair: "ARB/USDT",
    date: "2026-03-09",
    outcome: "WIN",
    profitPercent: 3.3,
    profitAmount: 33,
    strategy: "Backside trade",
    position: "LONG",
    chartData: buildChart(1.11, [0, 0.02, 0.015, 0.036, 0.049, 0.063, 0.071, 0.082]),
  },
  {
    id: "tj-008",
    pair: "DOT/USDT",
    date: "2026-03-10",
    outcome: "WIN",
    profitPercent: 2.5,
    profitAmount: 25,
    strategy: "BouncyBall Breakout",
    position: "LONG",
    chartData: buildChart(5.72, [0, -0.04, 0.03, 0.1, 0.12, 0.18, 0.21, 0.26]),
  },
  {
    id: "tj-009",
    pair: "WIF/USDT",
    date: "2026-03-11",
    outcome: "LOSS",
    profitPercent: -1.5,
    profitAmount: -15,
    strategy: "Backside trade",
    position: "LONG",
    chartData: buildChart(1.89, [0, 0.01, -0.018, -0.035, -0.027, -0.046, -0.055, -0.071]),
  },
  {
    id: "tj-010",
    pair: "SOL/USDT",
    date: "2026-03-12",
    outcome: "WIN",
    profitPercent: 5.2,
    profitAmount: 52,
    strategy: "BouncyBall Breakout",
    position: "LONG",
    chartData: buildChart(151, [0, 0.9, 0.4, 1.7, 2.9, 3.4, 4.8, 5.5]),
  },
  {
    id: "tj-011",
    pair: "ETH/USDT",
    date: "2026-03-13",
    outcome: "WIN",
    profitPercent: 4.7,
    profitAmount: 47,
    strategy: "Support zone rebounce",
    position: "LONG",
    chartData: buildChart(3640, [0, -9, 18, 45, 69, 82, 103, 124]),
  },
  {
    id: "tj-012",
    pair: "BTC/USDT",
    date: "2026-03-14",
    outcome: "LOSS",
    profitPercent: -2.7,
    profitAmount: -27,
    strategy: "Backside trade",
    position: "SHORT",
    chartData: buildChart(94600, [0, 110, 90, -80, -190, -260, -310, -390]),
  },
  {
    id: "tj-013",
    pair: "PEPE/USDT",
    date: "2026-03-16",
    outcome: "WIN",
    profitPercent: 1.9,
    profitAmount: 19,
    strategy: "Support zone rebounce",
    position: "LONG",
    chartData: buildChart(0.000014, [0, 0.0000002, 0.0000001, 0.00000036, 0.00000045, 0.00000052, 0.0000006, 0.00000073]),
  },
  {
    id: "tj-014",
    pair: "LINK/USDT",
    date: "2026-03-17",
    outcome: "WIN",
    profitPercent: 3.6,
    profitAmount: 36,
    strategy: "BouncyBall Breakout",
    position: "LONG",
    chartData: buildChart(18.9, [0, 0.11, 0.02, 0.23, 0.36, 0.41, 0.55, 0.68]),
  },
  {
    id: "tj-015",
    pair: "SUI/USDT",
    date: "2026-03-18",
    outcome: "LOSS",
    profitPercent: -2.1,
    profitAmount: -21,
    strategy: "Backside trade",
    position: "LONG",
    chartData: buildChart(3.72, [0, -0.02, 0.01, -0.05, -0.09, -0.12, -0.16, -0.19]),
  },
  {
    id: "tj-016",
    pair: "APT/USDT",
    date: "2026-03-19",
    outcome: "WIN",
    profitPercent: 2.9,
    profitAmount: 29,
    strategy: "Support zone rebounce",
    position: "SHORT",
    chartData: buildChart(7.43, [0, 0.03, 0.1, 0.08, 0.19, 0.25, 0.31, 0.36]),
  },
  {
    id: "tj-017",
    pair: "OP/USDT",
    date: "2026-03-20",
    outcome: "WIN",
    profitPercent: 2.4,
    profitAmount: 24,
    strategy: "Backside trade",
    position: "LONG",
    chartData: buildChart(1.64, [0, 0.02, 0.014, 0.033, 0.041, 0.052, 0.059, 0.068]),
  },
  {
    id: "tj-018",
    pair: "TIA/USDT",
    date: "2026-03-21",
    outcome: "LOSS",
    profitPercent: -1.7,
    profitAmount: -17,
    strategy: "BouncyBall Breakout",
    position: "LONG",
    chartData: buildChart(5.14, [0, 0.04, -0.01, -0.03, -0.08, -0.1, -0.12, -0.16]),
  },
  {
    id: "tj-019",
    pair: "AVAX/USDT",
    date: "2026-03-23",
    outcome: "WIN",
    profitPercent: 4.2,
    profitAmount: 42,
    strategy: "Backside trade",
    position: "LONG",
    chartData: buildChart(44.7, [0, 0.19, 0.12, 0.55, 0.83, 0.98, 1.31, 1.55]),
  },
  {
    id: "tj-020",
    pair: "NEAR/USDT",
    date: "2026-03-24",
    outcome: "WIN",
    profitPercent: 3.5,
    profitAmount: 35,
    strategy: "Support zone rebounce",
    position: "LONG",
    chartData: buildChart(6.28, [0, 0.05, 0.02, 0.12, 0.19, 0.26, 0.32, 0.41]),
  },
  {
    id: "tj-021",
    pair: "DOGE/USDT",
    date: "2026-03-25",
    outcome: "LOSS",
    profitPercent: -2,
    profitAmount: -20,
    strategy: "Support zone rebounce",
    position: "SHORT",
    chartData: buildChart(0.18, [0, 0.003, 0.001, -0.002, -0.004, -0.006, -0.008, -0.011]),
  },
  {
    id: "tj-022",
    pair: "FET/USDT",
    date: "2026-03-27",
    outcome: "WIN",
    profitPercent: 3.2,
    profitAmount: 32,
    strategy: "Backside trade",
    position: "LONG",
    chartData: buildChart(2.04, [0, 0.03, 0.018, 0.065, 0.083, 0.1, 0.125, 0.143]),
  },
  {
    id: "tj-023",
    pair: "SEI/USDT",
    date: "2026-03-30",
    outcome: "WIN",
    profitPercent: 6.7,
    profitAmount: 67,
    strategy: "BouncyBall Breakout",
    position: "LONG",
    chartData: buildChart(0.49, [0, 0.018, 0.006, 0.032, 0.046, 0.061, 0.078, 0.096]),
  },
];

export function getMonthDays(referenceDate = new Date()) {
  const monthStart = startOfMonth(referenceDate);
  const monthEnd = endOfMonth(referenceDate);

  return eachDayOfInterval({ start: monthStart, end: monthEnd }).map((date) => ({
    date: format(date, "yyyy-MM-dd"),
    day: format(date, "d"),
    label: format(date, "MMM d"),
  }));
}

export function buildDailyProfit(trades: Trade[], referenceDate = new Date()) {
  return getMonthDays(referenceDate).map(({ date, day, label }) => {
    const profit = trades
      .filter((trade) => trade.date === date)
      .reduce((sum, trade) => sum + trade.profitAmount, 0);

    return {
      date,
      day,
      label,
      profit,
    };
  });
}

export function getTradeStats(trades: Trade[]) {
  const wins = trades.filter((trade) => trade.outcome === "WIN");
  const losses = trades.filter((trade) => trade.outcome === "LOSS");
  const totalProfit = trades.reduce((sum, trade) => sum + trade.profitAmount, 0);
  const winRate = trades.length ? Math.round((wins.length / trades.length) * 100) : 0;
  const biggestWin = wins.reduce<Trade | undefined>(
    (best, trade) => (!best || trade.profitAmount > best.profitAmount ? trade : best),
    undefined,
  );

  let currentType: TradeOutcome | undefined;
  let currentCount = 0;
  [...trades]
    .sort((a, b) => a.date.localeCompare(b.date))
    .forEach((trade) => {
      if (trade.outcome === currentType) {
        currentCount += 1;
      } else {
        currentType = trade.outcome;
        currentCount = 1;
      }
    });

  return {
    wins: wins.length,
    losses: losses.length,
    totalProfit,
    winRate,
    totalTrades: trades.length,
    currentStreak: currentType ? `${currentCount}${currentType === "WIN" ? "W" : "L"}` : "0W",
    biggestWin,
  };
}
