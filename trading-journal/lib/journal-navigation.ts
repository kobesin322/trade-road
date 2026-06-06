export function buildTradeJournalUrl(tradeId: string) {
  const params = new URLSearchParams({
    view: "Journal",
    tradeId,
  });
  return `/?${params.toString()}`;
}

export function openTradeJournalInNewTab(tradeId: string) {
  window.open(buildTradeJournalUrl(tradeId), "_blank", "noopener,noreferrer");
}
