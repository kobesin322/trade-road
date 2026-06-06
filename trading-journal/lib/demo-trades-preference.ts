export const DEMO_TRADES_COOKIE = "traderoad_demo_trades";

export function parseDemoTradesCookie(value?: string) {
  if (value === "true") {
    return true;
  }
  if (value === "false") {
    return false;
  }
  return null;
}

export function demoTradesCookieValue(enabled: boolean) {
  return enabled ? "true" : "false";
}
