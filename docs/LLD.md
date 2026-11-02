# FinWise AI — Low-Level Design

## 1. Repository layout
```text
Finwise-AI/
├── public/                 # Existing browser UI (kept unchanged)
├── src/
│   ├── agents/             # Decision, investment, research, risk
│   ├── config/env.js
│   ├── controllers/chat.controller.js
│   ├── routes/chat.routes.js
│   ├── services/            # Gemini, input extraction, investment
│   ├── utils/calculations.js
│   └── app.js
├── tests/
├── server.js
└── package.json
```

## 2. HTTP contract
### GET /health
Returns HTTP 200 with process status and whether a Gemini key is configured. It is a liveness check, not proof that the AI provider is reachable.

### GET /health/ready
Returns HTTP 200 if the Gemini key is configured, otherwise HTTP 503.

### POST /chat
Request body: { "message": "Calculate SIP ₹5,000 per month for 5 years at 10%." }

Successful response fields:
- success: boolean
- reply: final educational explanation
- data.research: research-agent text
- data.investment: investment result, or null if no complete SIP scenario is present
- data.risk: risk-agent result, or null if no complete SIP scenario is present

Error response: { "success": false, "error": "Client-safe explanation" }

Status codes: 400 for invalid/empty chat or calculation inputs; 413 for oversized input; 502 for Gemini provider errors or empty provider response; 503 when the Gemini key is not configured; 500 for unexpected server errors.

## 3. SIP input extraction
extractSIPInputs(question) returns null when the question is not recognized as an SIP request.

For SIP-related questions it returns monthlyInvestment (or null), years (month durations are converted), annualReturn (explicit rate or illustrative 12%), annualReturnIsAssumed, canCalculate, and missingFields.

It never supplies a default monthly amount or duration.

## 4. SIP calculation
calculateSIP({ monthlyInvestment, years, annualReturn }) validates inputs and calculates a future value for regular monthly contributions.
- Months = rounded duration in years multiplied by 12.
- Monthly rate = annual rate divided by 12 and 100.
- The formula models contributions at the **beginning** of each month.
- Total invested = monthly contribution multiplied by number of months.
- Estimated gain = estimated future value minus total invested.

Guardrails: monthly contribution must be greater than zero and no more than ₹1,000,000,000; duration must be greater than zero and no more than 80 years; annual return assumption must be 0–100%; at least one month must be represented.

These limits protect the calculation and chart from invalid or excessively large inputs; they are not financial suitability limits.

## 5. Agent responsibilities
- **Research:** produces general educational context; does not retrieve current news or market prices.
- **Investment:** runs deterministic SIP calculation and asks Gemini to explain it.
- **Risk:** describes general scenario risks and uncertainty.
- **Decision:** answers the actual question and combines available context. It must not invent missing figures or guarantee returns.

For non-SIP questions, the controller calls Research and Decision only. For an SIP question with missing details, it returns the missing context to the Decision Agent without creating an investment or risk calculation. For a complete SIP scenario, Investment and Risk are also called.

## 6. Gemini configuration and errors
Environment variables:
- GEMINI_API_KEY — required only for AI requests.
- GEMINI_MODEL — optional; defaults to gemini-3.5-flash-lite.
- PORT — optional; defaults to 3000.
- FRONTEND_ORIGIN — optional; only needed if a separate browser origin is introduced.

The Gemini client is created lazily when the first AI request arrives. This prevents missing credentials from crashing the HTTP process during startup.

Error codes: AI_NOT_CONFIGURED, AI_EMPTY_RESPONSE, AI_PROVIDER_ERROR, INVALID_SIP_INPUT. Provider details and stack traces are not returned to the browser.

## 7. Frontend compatibility
The existing public/index.html, public/script.js, and public/style.css remain unchanged. The browser continues to send POST /chat with a message property, reads reply, and reads data.investment.calculation before rendering the chart.

The controller retains these response fields. For questions without an SIP calculation, data.investment is null, which the existing browser code already handles through optional chaining.

## 8. Testing strategy
Run npm test. Tests cover SIP formula and zero-return behavior, contribution timing and fractional duration, invalid calculation ranges, input extraction and assumed-return labeling, chat validation and HTTP response behavior using stubbed agents, and no fabricated SIP calculation for general questions.

No test requires a real Gemini API key or incurs a live model request.
