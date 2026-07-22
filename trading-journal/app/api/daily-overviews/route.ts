import { revalidatePath } from "next/cache";
import { NextResponse } from "next/server";

import { tradeErrorResponse } from "@/lib/api/trade-route";
import {
  DailyOverviewServiceError,
  getPersonalDailyOverviewByDate,
  listPersonalDailyOverviews,
  removePersonalDailyOverview,
  requireDailyOverviewUser,
  savePersonalDailyOverview,
} from "@/lib/daily-overview-service";

export async function GET(request: Request) {
  try {
    const user = await requireDailyOverviewUser();
    const { searchParams } = new URL(request.url);
    const date = searchParams.get("date");

    if (date) {
      const overview = await getPersonalDailyOverviewByDate(user.id, date);
      return NextResponse.json({ overview });
    }

    const overviews = await listPersonalDailyOverviews(user.id);
    return NextResponse.json({ overviews });
  } catch (error) {
    if (error instanceof DailyOverviewServiceError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    return tradeErrorResponse(error);
  }
}

export async function POST(request: Request) {
  try {
    const user = await requireDailyOverviewUser();
    const overview = await savePersonalDailyOverview(user.id, await request.json());
    revalidatePath("/app");
    return NextResponse.json({ overview }, { status: 201 });
  } catch (error) {
    if (error instanceof DailyOverviewServiceError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    return tradeErrorResponse(error);
  }
}

export async function DELETE(request: Request) {
  try {
    const user = await requireDailyOverviewUser();
    const { searchParams } = new URL(request.url);
    const id = searchParams.get("id");
    if (!id) {
      return NextResponse.json({ error: "id is required." }, { status: 400 });
    }
    await removePersonalDailyOverview(user.id, id);
    revalidatePath("/app");
    return NextResponse.json({ ok: true });
  } catch (error) {
    if (error instanceof DailyOverviewServiceError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    return tradeErrorResponse(error);
  }
}
