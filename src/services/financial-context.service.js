import { getMarketQuote } from "./market.service.js";
import { searchFinancialNews } from "./news.service.js";

const NEWS_INTENT = /\\b(news|headlines|latest updates|recent updates|market updates|financial updates)\\b/i;
const QUOTE_INTENT = /\\b(stock price|share price|market price|latest price|price of|quote for|stock quote|share quote)\\b/i;

function extractQuoteRequest(question) {
  const patterns = [
    /\\b(?:stock\\s+)?(?:share\\s+)?price\\s+(?:of\\s+)?([A-Z0-9][A-Z0-9._-]{0,19})\\s+(?:on|at)\\s+(NSE|BSE)\\b/i,
    /\\b(?:quote|stock quote|share quote)\\s+(?:for\\s+)?([A-Z0-9][A-Z0-9._-]{0,19})\\s+(?:on|at)\\s+(NSE|BSE)\\b/i,
    /\\b([A-Z0-9][A-Z0-9._-]{0,19})\\s+(?:stock|share)\\s+(?:price|quote)\\s+(?:on|at)\\s+(NSE|BSE)\\b/i,
    /\\b([A-Z0-9][A-Z0-9._-]{0,19})\\s+(NSE|BSE)\\s+(?:stock\\s+|share\\s+)?(?:price|quote)\\b/i,
  ];

  for (const pattern of patterns) {
    const match = question.match(pattern);
    if (match) return { symbol: match[1].toUpperCase(), exchange: match[2].toUpperCase() };
  }
  return null;
}

function extractNewsQuery(question) {
  let cleaned = String(question || "").trim();

  // Remove an optional UI/category label such as "Financial news" before
  // extracting the topic from the user's actual request.
  cleaned = cleaned.replace(
    /^(?:(?:financial|business|stock|market)\\s+)?(?:news|headlines|updates)\\s*[:—-]?\\s*/i,
    "",
  );

  cleaned = cleaned
    .replace(/^\\s*(?:please\\s+)?(?:show\\s+me|find\\s+me|find|show|get|give\\s+me|what\\s+are|what\\s+is|what's|tell\\s+me\\s+about|fetch)\\s+/i, "")
    .replace(/\\b(?:latest|recent|today'?s|current|top|available|newest)\\b/gi, " ")
    // Remove display requirements, not the actual topic being searched.
    .replace(/\\b(?:with|including|showing|along\\s+with)\\s+(?:the\\s+)?(?:article\\s+)?(?:sources?|publication\\s+dates?|dates?|links?|citations?).*$/i, " ")
    .replace(/\\b(?:financial|business)\\s+(?:news|headlines|updates)\\b/gi, " ")
    .replace(/\\b(?:news|headlines|updates)\\b/gi, " ")
    .replace(/[?!.]+$/g, " ")
    .replace(/\\s+/g, " ")
    .trim()
    .replace(/^(?:(?:the|about|on|for|from|regarding|in|of)\\s+)+/i, "")
    .replace(/\\s+/g, " ")
    .trim();

  return cleaned.length >= 2 ? cleaned : String(question || "").trim();
}

function unavailable(provider, message) {
  return { status: "unavailable", provider, message };
}

function marketUnavailableMessage(error) {
  if (error?.code === "MARKET_NOT_CONFIGURED") {
    return "Market data is not configured. Add TWELVE_DATA_API_KEY on the server to enable quotes.";
  }
  if (error?.code === "MARKET_ACCESS_DENIED") {
    return "Twelve Data denied access to this quote. Check that your plan includes NSE exchange coverage and that your API key has quote access.";
  }
  if (error?.code === "MARKET_RATE_LIMIT") {
    return "Twelve Data's request limit was reached. Please wait and try again.";
  }
  if (error?.code === "MARKET_QUOTE_UNAVAILABLE") {
    return "Twelve Data did not return a usable quote for this symbol and exchange. Check the exchange listing and data availability for your plan.";
  }
  if (typeof error?.providerMessage === "string" && error.providerMessage) {
    return `Twelve Data could not return this quote: ${error.providerMessage}`;
  }
  return "A verified market quote is not available right now. Please try again later.";
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
          context.market = unavailable("Twelve Data", marketUnavailableMessage(error));
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
