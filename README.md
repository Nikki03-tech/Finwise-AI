# FinWise AI — Personal Financial Copilot

FinWise AI is an educational finance assistant prototype built with Node.js, Express, Google Gemini, and Chart.js. It combines a chat interface with an illustrative SIP growth chart.

> **Important:** FinWise AI is an educational prototype, not a licensed financial adviser. Its outputs are AI-generated and may be inaccurate. Verify important information independently. It does not provide personalized investment advice or live market prices/news.

## Features
- Chat-based explanations of common financial concepts
- Multi-agent response workflow: research, investment, risk, and decision synthesis
- SIP future-value calculation using a deterministic backend formula
- Chart.js visualisation based on the backend calculation returned by the API
- Health and readiness endpoints
- Automated tests for calculations, input extraction, and chat API behavior

## Current capabilities and limitations
- The research agent generates general educational context. It does **not** fetch live news, stock prices, or market feeds.
- The investment chart is an illustrative SIP projection, not a forecast or guarantee.
- When an SIP amount or duration is missing, FinWise asks for the missing details rather than silently inserting an amount or duration.
- When the annual return is omitted, 12% is used only as a clearly identified mathematical assumption.
- Market and separate investment endpoints are not currently connected to the browser interface.

## Architecture
See [High-Level Design](docs/HLD.md) and [Low-Level Design](docs/LLD.md).

```text
Browser UI (public/)
   │  POST /chat
   ▼
Express API (src/app.js)
   │
   ├── Input extraction and validation
   ├── Research Agent
   ├── Investment Agent → SIP math
   ├── Risk Agent
   └── Decision Agent
          │
          ▼
   JSON response → chat + Chart.js
```

## Tech stack
- **Runtime:** Node.js 20+
- **Backend:** Express.js
- **AI:** Google GenAI SDK / Gemini
- **Frontend:** HTML, CSS, browser JavaScript
- **Charts:** Chart.js
- **Tests:** Node.js built-in test runner

## Run locally
1. Install Node.js 20 or later.
2. Clone and install dependencies:
   ```bash
   git clone https://github.com/Nikki03-tech/Finwise-AI.git
   cd Finwise-AI
   npm ci
   ```
3. Copy .env.example to .env and add your Gemini API key:
   ```env
   GEMINI_API_KEY=your_real_key
   GEMINI_MODEL=gemini-3.5-flash-lite
   PORT=3000
   ```
   Never commit the real .env file.
4. Start the application:
   ```bash
   npm start
   ```
5. Open http://localhost:3000.

The server can start without a Gemini key so that health checks still work. Chat requests return HTTP 503 until GEMINI_API_KEY is configured.

## API
### GET /health
Liveness endpoint. Confirms the Express process is running.

### GET /health/ready
Readiness endpoint. Returns HTTP 200 when a Gemini key is configured and HTTP 503 otherwise.

### POST /chat
Request body:
```json
{
  "message": "Calculate SIP ₹5,000 per month for 5 years at 10%."
}
```
Successful responses retain the browser contract: success, reply, and data containing research, investment, and risk. The investment object is null when there is no complete SIP scenario. When it exists, its calculation includes monthlyInvestment, annualReturn, years, months, totalInvested, estimatedValue, and estimatedGain.

Validation errors use HTTP 400 or 413. Missing Gemini configuration returns HTTP 503. AI provider failures return HTTP 502. Error responses do not expose provider internals or API keys.

## Deployment on Render
For the existing Node web service, use:
- **Build command:** npm ci
- **Start command:** npm start
- **Health check path:** /health
- **Environment:** set GEMINI_API_KEY; optionally set GEMINI_MODEL

Keep the existing service and domain. A commit to GitHub does not by itself prove that Render has finished deploying; verify the deployment status in Render and check /health after it completes.

## Run tests
```bash
npm test
```
Tests use stubbed agents and deterministic calculations; they do not require a Gemini API key or make paid AI requests.

## Screenshots
| Chat interface | Chart visualisation |
| --- | --- |
| ![FinWise AI chat interface](chat.png) | ![FinWise AI chart visualisation](chart.png) |

## Author
**Nikitha Singh Raj Purohit** · B.Tech CSE & IT, Class of 2027
- [GitHub](https://github.com/Nikki03-tech)
- [LinkedIn](https://www.linkedin.com/in/nikitha-singh-raj-purohit-862317301/)
