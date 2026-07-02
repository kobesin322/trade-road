import type { Metadata } from "next";

import { OrderFlowBacktester } from "@/components/tools/order-flow-backtester";
import { OrderFlowTerminal } from "@/components/tools/order-flow-terminal";

export const metadata: Metadata = {
  title: "Order Flow | Trading Tools",
  description: "Level 3 order flow and market microstructure workspace.",
};

export default function OrderFlowToolPage() {
  return (
    <>
      <OrderFlowTerminal />
      <OrderFlowBacktester />
    </>
  );
}
