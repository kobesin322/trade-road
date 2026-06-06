import { revalidatePath } from "next/cache";
import { NextResponse } from "next/server";

import {
  DailyOverviewServiceError,
  getPersonalDailyOverviewByDate,
  removePersonalDailyOverview,
  requireDailyOverviewUser,
  savePersonalDailyOverview,
} from "@/lib/daily-overview-service";
import { getDailyOverviewById } from "@/lib/daily-overview-db";

type RouteContext = {
  params: Promise<{ id: string }>;
};

export async function GET(_request: Request, context: RouteContext) {
  try {
    const user = await requireDailyOverviewUser();
    const { id } = await context.params;
    const overview = await getDailyOverviewById(user.id, id);
    if (!overview) {
      return NextResponse.json({ error: "Daily overview not found." }, { status: 404 });
    }
    const record = await getPersonalDailyOverviewByDate(user.id, overview.date);
    return NextResponse.json({ overview: record });
  } catch (error) {
    if (error instanceof DailyOverviewServiceError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    const message = error instanceof Error ? error.message : "Unexpected server error.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function PATCH(request: Request, context: RouteContext) {
  try {
    const user = await requireDailyOverviewUser();
    const { id } = await context.params;
    const existing = await getDailyOverviewById(user.id, id);
    if (!existing) {
      return NextResponse.json({ error: "Daily overview not found." }, { status: 404 });
    }

    const body = (await request.json()) as Record<string, unknown>;
    const overview = await savePersonalDailyOverview(user.id, {
      date: existing.date,
      tradePerformanceHtml:
        body.tradePerformanceHtml !== undefined
          ? (body.tradePerformanceHtml as string | null)
          : existing.tradePerformanceHtml,
      preTradeListHtml:
        body.preTradeListHtml !== undefined
          ? (body.preTradeListHtml as string | null)
          : existing.preTradeListHtml,
      marketAnalysisHtml:
        body.marketAnalysisHtml !== undefined
          ? (body.marketAnalysisHtml as string | null)
          : existing.marketAnalysisHtml,
      preTradeListScreenshots:
        body.preTradeListScreenshots !== undefined
          ? (body.preTradeListScreenshots as typeof existing.preTradeListScreenshots)
          : existing.preTradeListScreenshots,
      marketAnalysisScreenshots:
        body.marketAnalysisScreenshots !== undefined
          ? (body.marketAnalysisScreenshots as typeof existing.marketAnalysisScreenshots)
          : existing.marketAnalysisScreenshots,
      linkedTradeIds:
        body.linkedTradeIds !== undefined
          ? (body.linkedTradeIds as string[])
          : existing.linkedTradeIds,
    });

    revalidatePath("/");
    return NextResponse.json({ overview });
  } catch (error) {
    if (error instanceof DailyOverviewServiceError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    const message = error instanceof Error ? error.message : "Unexpected server error.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function DELETE(_request: Request, context: RouteContext) {
  try {
    const user = await requireDailyOverviewUser();
    const { id } = await context.params;
    await removePersonalDailyOverview(user.id, id);
    revalidatePath("/");
    return NextResponse.json({ ok: true });
  } catch (error) {
    if (error instanceof DailyOverviewServiceError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    const message = error instanceof Error ? error.message : "Unexpected server error.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
