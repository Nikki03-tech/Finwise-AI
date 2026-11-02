import { getMarketQuote } from "./market.service.js";
import { searchFinancialNews } from "./news.service.js";

const NEWS_INTENT = /\b(news|headlines|latest updates|recent updates|market updates|financial updates)\b/i;
const QUOTE_INTENT = /\b(stock price|share price|market price|latest price|price of|quote for|stock quote|share quote)\b/i;

function extractQuoteRequest(question) {
  const patterns = [
    /\b(?:stock\s+)?(?:share\s+)?price\s+(?:of\s+)?([A-Z0-9][A-Z0-9._-]{0,19})\s+(?:on|at)\s+(NSE|BSE)\b/i,
    /\b(?:quote|stock quote|share quote)\s+(?:for\s+)?([A-Z0-9][A-Z0-9._-]{0,19})\s+(?:on|at)\s+(NSE|BSE)\b/i,
    /\b([A-Z0-9][A-Z0-9._-]{0,19})\s+(NSE|BSE)\s+(?:stock\s+|share\s+)?(?:price|quote)\b/i,
  ];

  for (const pattern of patterns) {
    const match = question.match(pattern);
    if (match) return { symbol: match[1].toUpperCase(), exchange: match[2].toUpperCase() };
  }
  return null;
}

function extractNewsQuery(question) {
  const cleaned = question
    .replace(/^\s*(?:please\s+)?(?:show|find|get|give me|what are|what is|tell me about)\s+/i, "")
    .replace(/^the\s+/i, "")
    .replace(/\b(?:latest|recent|today'?s|current|top)\b/gi, "")
    .replace(/\b(?:financial|business|stock|market)\s+(?=news|headlines|updates)/gi, "")
    .replace(/\b(?:news|headlines|updates)\s*(?:about|on|for|regarding)?\s*/gi, " ")
    .replace(/[?!.]+$/g, "")
    .replace(/\s+/g, " ")
    .trim();

  return cleaned.length >= 2 ? cleaned : question.trim();
}

function unavailable(provider, message) {
  return { status: "unavailable", provider, message };
}

export function createFinancialContextService({
  quote = getMarketQuote,
  news = searchFinancialNews,
} = {}) {
  return async function getFinancialContext(question) {
    const context = {};

    if (QUOTE_INTENT.test(question)) {
      const request = extractQuoteRequest(question);
      if (!request) {
        context.market = {
          status: "needs_details",
          message: "Please provide the exact stock ticker and exchange, for example: TCS on NSE or INFY on BSE.",
        };
      } else {
        try {
          context.market = { status: "available", ...(await quote(request)) };
        } catch (error) {
          context.market = unavailable(
            "Twelve Data",
            error?.code === "MARKET_NOT_CONFIGURED"
              ? "Market data is not configured. Add TWELVE_DATA_API_KEY on the server to enable quotes."
              : "A verified market quote is not available right now. Please try again later.",
          );
        }
      }
    }

    if (NEWS_INTENT.test(question)) {
      try {
        context.news = {
          status: "available",
          ...(await news(extractNewsQuery(question), { max: 5 })),
        };
      } catch (error) {
        context.news = unavailable(
          "GNews",
          error?.code === "NEWS_NOT_CONFIGURED"
            ? "Financial news is not configured. Add GNEWS_API_KEY on the server to enable news search."
            : "Verified news results are not available right now. Please try again later.",
        );
      }
    }

    return context;
  };
}

const financialContextService = createFinancialContextService();
export const getFinancialContext = financialContextService;
