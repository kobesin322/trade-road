import type { DailyOverview } from "@/lib/daily-overview-types";

export function overviewHasContent(overview: DailyOverview | null | undefined) {
  if (!overview) {
    return false;
  }
  return Boolean(
    overview.tradePerformanceHtml?.replace(/<[^>]*>/g, "").trim() ||
      overview.preTradeListHtml?.replace(/<[^>]*>/g, "").trim() ||
      overview.marketAnalysisHtml?.replace(/<[^>]*>/g, "").trim() ||
      overview.preTradeListScreenshots.length ||
      overview.marketAnalysisScreenshots.length ||
      overview.mistakeFlags.length ||
      overview.mistakesNotes?.trim() ||
      overview.linkedTradeIds.length,
  );
}

export function buildOverviewsByDate(overviews: DailyOverview[]) {
  return overviews.reduce<Record<string, DailyOverview>>((map, overview) => {
    map[overview.date] = overview;
    return map;
  }, {});
}
