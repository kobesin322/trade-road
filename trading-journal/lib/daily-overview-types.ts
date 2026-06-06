export type DailyOverview = {
  id: string;
  date: string;
  tradePerformanceHtml: string | null;
  preTradeListHtml: string | null;
  marketAnalysisHtml: string | null;
  linkedTradeIds: string[];
  createdAt: string;
  updatedAt: string;
};

export type DailyOverviewInput = {
  date: string;
  tradePerformanceHtml?: string | null;
  preTradeListHtml?: string | null;
  marketAnalysisHtml?: string | null;
  linkedTradeIds?: string[];
};

export type DailyOverviewRecord = DailyOverview & {
  linkedTrades: import("@/lib/trades").Trade[];
};
