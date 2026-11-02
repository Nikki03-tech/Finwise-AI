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

  const message = status === 400 || status === 404 || status === 429 || status === 403 || status === 503
    ? error.message
    : "The requested data provider is temporarily unavailable.";

  return sendError(res, status, message);
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
