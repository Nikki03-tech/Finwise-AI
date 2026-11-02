# FinWise AI — Low-Level Design

## 1. Repository layout
```text
Finwise-AI/
├── public/                         # Existing browser UI; unchanged
├── src/
│   ├── agents/                     # decision, investment, research, risk
│   ├── config/env.js
│   ├── controllers/                # chat, investment, market
│   ├── middleware/rate-limit.js
│   ├── routes/                     # chat, investment, market
│   ├── services/                   # Gemini, financial context, market, news, SIP
│   ├── utils/                      # calculation and response helpers
│   └── app.js
├── tests/
└── server.js
```

## 2. HTTP contracts
### Chat — `POST /chat`
Request: `{ "message": "Calculate SIP ₹5,000 per month for 5 years at 10%." }`.

Success: `{ success, reply, data }`; `data` contains `research`, `investment`, `risk`, and `financialContext`. `investment`/`risk` are null when no complete SIP scenario exists. The frontend-critical `reply` and `data.investment.calculation` fields remain compatible.

### SIP calculator — `POST /investment/sip`
Request example: `{ "monthlyInvestment": 5000, "years": 5, "annualReturn": 10 }`.

Returns `data.calculation`, `data.annualReturnIsAssumed`, and an educational disclaimer. If `annualReturn` is omitted, 12% is used as a clearly flagged mathematical illustration. Monthly contribution and duration must be supplied.

### Symbol search — `GET /market/search?q=Tata%20Consultancy`
Returns symbol, company/instrument name, exchange, MIC, country, currency, instrument type, and plan access metadata when returned by the provider.

### Quote — `GET /market/quote?symbol=TCS&exchange=NSE`
Requires a ticker and NSE/BSE exchange. Returns provider, symbol, company name if supplied, exchange, currency, price, OHLC fields, percent change, volume, market timestamp, exchange time zone, market-open flag, retrieval timestamp, and freshness note.

### Historical series — `GET /market/history?symbol=TCS&exchange=NSE&interval=1day&outputsize=30`
Allowed intervals: `1day`, `1week`, `1month`. `outputsize` is 5–100. Returns timestamped OHLCV values and retrieval metadata.

### News — `GET /market/news?q=Reserve%20Bank%20of%20India&max=5`
Returns article title/description, publisher name/site, URL, publication timestamp, query, provider, retrieval timestamp, and freshness note. Requested result count is bounded to 1–10.

Errors use `{ success: false, error }`. Invalid input returns 400, missing keys 503, provider rate limit 429, unavailable symbol/history 404 where identifiable, and upstream errors 502. Provider stack traces and credentials are not sent to the client.

## 3. Financial Context Service
`getFinancialContext(question)` detects explicit financial-news intent and quote intent. A quote is fetched automatically only when both a ticker and NSE/BSE are clear in the question. If exchange/symbol details are missing, it returns `needs_details`; it does not guess the ticker.

News is queried through GNews only when the prompt asks for news, headlines, or updates. General educational prompts do not spend news/market API quota.

The service returns per-source status: `available`, `unavailable`, or `needs_details`. The Decision Agent must not use model memory to fill unavailable provider data.

## 4. Provider adapters
### Twelve Data
- REST base: `https://api.twelvedata.com`.
- Authentication: `Authorization: apikey ...` request header.
- Endpoints used: `/symbol_search`, `/quote`, `/time_series`.
- Request timeout: 10 seconds.
- Cache TTLs: quote 60 seconds; symbol search 10 minutes; history 5 minutes.
- Coverage and quote freshness depend on the selected symbol, exchange, and account entitlement.

### GNews
- REST base: `https://gnews.io/api/v4`.
- Search endpoint: `/search` with `q`, `lang=en`, `country=in`, `max`, `sortby=publishedAt`, and server-side `apikey` query parameter.
- Request timeout: 10 seconds; cache TTL: 15 minutes.
- Result count capped at 10 for a Free-plan-compatible maximum.
- GNews Free plan currently advertises a 12-hour delay; publication time and retrieval time are distinct.

## 5. SIP calculation
`calculateSIP({ monthlyInvestment, years, annualReturn })` uses monthly compounding and contribution at the beginning of each month. It validates positive monthly contribution, maximum ₹1,000,000,000 monthly amount, duration over 0 and at most 80 years, annual assumption 0–100%, and at least one whole month.

The annual assumption defaults to 12% only when the user omits a rate; the response flags this as assumed. The monthly amount and duration are never defaulted.

## 6. AI orchestration
- Non-SIP educational question: Research + Decision.
- Incomplete SIP question: Research + Decision; Decision asks for missing amount/duration.
- Complete SIP question: Research + Investment + Risk, then Decision.
- Explicit market/news question: fetch provider context in parallel and pass provider result/status to Decision.

Decision prompt rules prohibit invented current quotes, news, timestamps, publishers, article URLs, guaranteed returns, or personalized buy/sell recommendations. External article text is treated as untrusted reference material.

## 7. Configuration and operations
Environment variables: `GEMINI_API_KEY`, `GEMINI_MODEL`, `TWELVE_DATA_API_KEY`, `GNEWS_API_KEY`, `PORT`, `FRONTEND_ORIGIN`.

Missing Gemini key does not prevent liveness startup; chat returns 503. Missing optional provider keys mark only that feature unavailable; they do not take down chat or the server.

Per-IP limits: chat 12 per 5 minutes; investment and market/news 30 per 5 minutes. Caches and rate limiter are in-process memory and must be replaced by a shared store when running multiple instances.

## 8. Frontend compatibility
The existing `public/index.html`, `public/script.js`, and `public/style.css` are unchanged. Browser calls remain same-origin `POST /chat`, reads `reply`, and renders Chart.js when `data.investment.calculation` is present. Additional `financialContext` data is additive.

## 9. Testing strategy
`npm test` runs deterministic tests with injected agents and fake provider responses. It covers SIP calculations, input extraction, chat orchestration, standalone SIP API, provider authentication/normalization, caching, missing-key behavior, quote/news intent, rate limiting, and app health/static serving. Tests do not require live API credentials or consume provider quotas.
