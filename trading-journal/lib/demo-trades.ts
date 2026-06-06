import { sampleTrades } from "@/lib/trades";

export function getDemoTrades() {
  return sampleTrades;
}

export function isDemoTradeId(id: string) {
  return id.startsWith("tj-");
}
