import type { Metadata } from "next";

import { TradeRoadLanding } from "@/components/landing/trade-road-landing";

export const metadata: Metadata = {
  title: "Trade Road — Your trading journey, mapped",
  description:
    "Futuristic trading journal and auction cockpit: trade journal, portfolio snapshots, volume profile, and risk-to-reward tools on one road.",
  openGraph: {
    title: "Trade Road",
    description:
      "Process infrastructure for discretionary traders—journal, portfolio, volume profile, and risk.",
    type: "website",
  },
};

export default function LandingPage() {
  return <TradeRoadLanding />;
}
