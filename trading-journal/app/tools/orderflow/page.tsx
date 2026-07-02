import type { Metadata } from "next";

import { OrderFlowTerminal } from "@/components/tools/order-flow-terminal";

export const metadata: Metadata = {
  title: "Order Flow | Trading Tools",
  description: "Level 3 order flow and market microstructure workspace.",
};

export default function OrderFlowToolPage() {
  return <OrderFlowTerminal />;
}
