export type YahooSearchQuote = {
  symbol: string;
  shortname?: string;
  longname?: string;
  quoteType?: string;
  exchange?: string;
};

type YahooSearchResponse = {
  quotes?: YahooSearchQuote[];
};

const YAHOO_SEARCH_URL = "https://query1.finance.yahoo.com/v1/finance/search";

const ALLOWED_QUOTE_TYPES = new Set([
  "EQUITY",
  "ETF",
  "CRYPTOCURRENCY",
  "MUTUALFUND",
  "INDEX",
]);

export async function searchYahooSymbols(query: string, limit = 12): Promise<YahooSearchQuote[]> {
  const trimmed = query.trim();
  if (trimmed.length < 1) {
    return [];
  }

  const url = `${YAHOO_SEARCH_URL}?q=${encodeURIComponent(trimmed)}&quotesCount=${limit}`;
  const response = await fetch(url, {
    cache: "no-store",
    headers: {
      "User-Agent": "Mozilla/5.0 TradeRoad Market Data",
    },
  });

  if (!response.ok) {
    throw new Error(`Yahoo symbol search failed with ${response.status}.`);
  }

  const payload = (await response.json()) as YahooSearchResponse;
  const quotes = payload.quotes ?? [];

  return quotes.filter((quote) => {
    if (!quote.symbol?.trim()) {
      return false;
    }

    if (quote.quoteType && !ALLOWED_QUOTE_TYPES.has(quote.quoteType)) {
      return false;
    }

    if (quote.symbol.includes("=") || quote.symbol.includes("^")) {
      return false;
    }

    return true;
  });
}
