export type DailyOverview = {
  id: string;
  date: string;
  tradePerformanceHtml: string | null;
  preTradeListHtml: string | null;
  marketAnalysisHtml: string | null;
  preTradeListScreenshots: import("@/lib/journal-constants").TradeScreenshot[];
  marketAnalysisScreenshots: import("@/lib/journal-constants").TradeScreenshot[];
  linkedTradeIds: string[];
  createdAt: string;
  updatedAt: string;
};

export type DailyOverviewInput = {
  date: string;
  tradePerformanceHtml?: string | null;
  preTradeListHtml?: string | null;
  marketAnalysisHtml?: string | null;
  preTradeListScreenshots?: import("@/lib/journal-constants").TradeScreenshot[];
  marketAnalysisScreenshots?: import("@/lib/journal-constants").TradeScreenshot[];
  linkedTradeIds?: string[];
};

export type DailyOverviewScreenshotUploads = {
  preTradeList?: import("@/lib/journal-constants").JournalScreenshotUpload[];
  marketAnalysis?: import("@/lib/journal-constants").JournalScreenshotUpload[];
};

export type DailyOverviewRecord = DailyOverview & {
  linkedTrades: import("@/lib/trades").Trade[];
};
