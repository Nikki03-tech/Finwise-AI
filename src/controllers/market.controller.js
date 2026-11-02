import {
  searchMarketSymbols,
  getMarketQuote,
  getMarketHistory,
} from "../services/market.service.js";
import { searchFinancialNews } from "../services/news.service.js";
import { sendError, sendSuccess } from "../utils/response.js";

function sendProviderError(res, error) {
  const status = error?.code?.startsWith("INVALID_") ? 400
    : error?.code?.endsWith("_NOT_CONFIGURED") ? 503
    : error?.code?.endsWith("_UNAVAILABLE") ? 404
    : error?.code?.endsWith("_RATE_LIMIT") ? 429
    : error?.code === "NEWS_ACCESS_DENIED" ? 403
    : 502;

  const publicMessages = {
    403: "The news provider denied access. Check the server-side API key and subscription.",
    404: "The requested market or news data is not available for that symbol or query.",
    429: "The provider rate limit was reached. Please try again later.",
    502: "The data provider is temporarily unavailable. Please try again later.",
    503: "This data provider is not configured on the server.",
  };

  return sendError(res, status, status === 400
    ? error.message
    : publicMessages[status] || publicMessages[502]);
}

export function createMarketController(services = {}) {
  const symbolSearch = services.searchMarketSymbols ?? searchMarketSymbols;
  const quote = services.getMarketQuote ?? getMarketQuote;
  const history = services.getMarketHistory ?? getMarketHistory;
  const news = services.searchFinancialNews ?? searchFinancialNews;

  return {
    search: async (req, res) => {
      try {
        return sendSuccess(res, await symbolSearch(req.query.q));
      } catch (error) {
        return sendProviderError(res, error);
      }
    },

    quote: async (req, res) => {
      try {
        return sendSuccess(res, await quote({
          symbol: req.query.symbol,
          exchange: req.query.exchange,
        }));
      } catch (error) {
        return sendProviderError(res, error);
      }
    },

    history: async (req, res) => {
      try {
        return sendSuccess(res, await history({
          symbol: req.query.symbol,
          exchange: req.query.exchange,
          interval: req.query.interval || "1day",
          outputsize: req.query.outputsize || 30,
        }));
      } catch (error) {
        return sendProviderError(res, error);
      }
    },

    news: async (req, res) => {
      try {
        return sendSuccess(res, await news(req.query.q, {
          max: req.query.max || 5,
        }));
      } catch (error) {
        return sendProviderError(res, error);
      }
    },
  };
}

const controller = createMarketController();
export const marketController = controller;
