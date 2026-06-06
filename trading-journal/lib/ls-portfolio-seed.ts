export const DEMO_LS_POSITIONS = [
  { side: "long" as const, symbol: "TSLA", quantity: 17, avg_entry_price: 250, current_price: 248 },
  { side: "long" as const, symbol: "COIN", quantity: 14, avg_entry_price: 120, current_price: 118 },
  { side: "long" as const, symbol: "SCCO", quantity: 48, avg_entry_price: 51.5, current_price: 52 },
  { side: "long" as const, symbol: "CRCL", quantity: 90, avg_entry_price: 12.2, current_price: 12.5 },
  { side: "long" as const, symbol: "IREN", quantity: 130, avg_entry_price: 9.05, current_price: 9.15 },
  { side: "short" as const, symbol: "SNDK", quantity: 3, avg_entry_price: 1380, current_price: 1410 },
  { side: "short" as const, symbol: "EWY", quantity: 48, avg_entry_price: 63.5, current_price: 64 },
];

export const DEMO_LS_PORTFOLIO = {
  name: "My L/S Portfolio",
  target_long_ratio: 0.6,
  target_short_ratio: 0.4,
  long_cash: 2500,
  short_cash: 1400,
};
