import { redirect } from "next/navigation";

import { TradingDashboard } from "@/components/trading-dashboard";
import { getSessionUser } from "@/lib/auth";
import { listTradesForUser } from "@/lib/trade-db";

export const dynamic = "force-dynamic";

export default async function Home() {
  const user = await getSessionUser();
  if (!user) {
    redirect("/login");
  }

  const initialTrades = process.env.DATABASE_URL
    ? await listTradesForUser(user.id)
    : [];

  return (
    <TradingDashboard
      initialTrades={initialTrades}
      userEmail={user.email ?? ""}
      userId={user.id}
    />
  );
}
