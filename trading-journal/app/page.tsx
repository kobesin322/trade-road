import { redirect } from "next/navigation";

import { TradingDashboard } from "@/components/trading-dashboard";
import { getSessionUser, isAdminDemoUser } from "@/lib/auth";
import { listDailyOverviewsForUser } from "@/lib/daily-overview-db";
import { listTradesForUser } from "@/lib/trade-db";
import { getDemoTradesEnabled } from "@/lib/user-preferences";

export const dynamic = "force-dynamic";

type HomeProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export default async function Home({ searchParams }: HomeProps) {
  const user = await getSessionUser();
  if (!user) {
    redirect("/login");
  }

  const params = await searchParams;
  const initialTradeId = typeof params.tradeId === "string" ? params.tradeId : undefined;
  const initialView = typeof params.view === "string" ? params.view : undefined;

  const demoTradesEnabled = await getDemoTradesEnabled(user.id);
  const canUsePersonalJournal = Boolean(process.env.DATABASE_URL) && !isAdminDemoUser(user);
  const personalTrades =
    canUsePersonalJournal ? await listTradesForUser(user.id) : [];
  const personalDailyOverviews =
    canUsePersonalJournal ? await listDailyOverviewsForUser(user.id) : [];

  return (
    <TradingDashboard
      canUsePersonalJournal={canUsePersonalJournal}
      demoTradesEnabled={demoTradesEnabled}
      initialTradeId={initialTradeId}
      initialView={initialView}
      personalDailyOverviews={personalDailyOverviews}
      personalTrades={personalTrades}
      userEmail={user.email ?? ""}
      userId={user.id}
    />
  );
}
