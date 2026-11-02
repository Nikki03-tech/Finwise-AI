import express from "express";
import cors from "cors";
import path from "node:path";
import { fileURLToPath } from "node:url";
import chatRoutes from "./routes/chat.routes.js";
import investmentRoutes from "./routes/investment.routes.js";
import marketRoutes from "./routes/market.routes.js";
import { isGeminiConfigured } from "./config/env.js";
import { createRateLimiter } from "./middleware/rate-limit.js";

const app = express();
const currentDir = path.dirname(fileURLToPath(import.meta.url));
const publicDir = path.resolve(currentDir, "../public");

app.disable("x-powered-by");
app.set("trust proxy", 1);

// The current browser UI is served by this same Express application.
// Cross-origin access is disabled unless a specific frontend origin is configured.
const frontendOrigin = process.env.FRONTEND_ORIGIN?.trim();
app.use(cors(frontendOrigin ? { origin: frontendOrigin } : { origin: false }));
app.use(express.json({ limit: "32kb" }));

app.use("/chat", createRateLimiter({ limit: 12, windowMs: 5 * 60_000 }));
app.use("/investment", createRateLimiter({ limit: 30, windowMs: 5 * 60_000 }));
app.use("/market", createRateLimiter({ limit: 30, windowMs: 5 * 60_000 }));

// Only the Supabase project URL and publishable/anon key are sent to the browser.
 // These values are designed to be public; Row Level Security protects user data.
app.get("/config", (_req, res) => {
  res.set("Cache-Control", "no-store");
  res.json({
    supabaseUrl: process.env.SUPABASE_URL?.trim() || null,
    supabaseAnonKey:
      process.env.SUPABASE_ANON_KEY?.trim() ||
      process.env.SUPABASE_PUBLISHABLE_KEY?.trim() ||
      null,
  });
});

app.get("/health", (_req, res) => {
  const marketKey = process.env.TWELVE_DATA_API_KEY?.trim();
  const newsKey = process.env.GNEWS_API_KEY?.trim();
  res.json({
    status: "ok",
    service: "FinWise AI",
    aiConfigured: isGeminiConfigured(),
    marketDataConfigured: Boolean(marketKey && marketKey !== "replace_with_your_twelve_data_api_key"),
    newsConfigured: Boolean(newsKey && newsKey !== "replace_with_your_gnews_api_key"),
  });
});

app.get("/health/ready", (_req, res) => {
  const ready = isGeminiConfigured();
  res.status(ready ? 200 : 503).json({
    status: ready ? "ready" : "not_ready",
    service: "FinWise AI",
    aiConfigured: ready,
  });
});

app.use("/chat", chatRoutes);
app.use("/investment", investmentRoutes);
app.use("/market", marketRoutes);
app.use(express.static(publicDir));

app.use((error, _req, res, next) => {
  if (res.headersSent) return next(error);

  if (error?.type === "entity.too.large") {
    return res.status(413).json({
      success: false,
      error: "Request body is too large.",
    });
  }

  if (error instanceof SyntaxError && error.status === 400 && "body" in error) {
    return res.status(400).json({
      success: false,
      error: "Request body must contain valid JSON.",
    });
  }

  console.error("FinWise server error:", error?.message || error);
  return res.status(500).json({
    success: false,
    error: "An unexpected server error occurred.",
  });
});

export default app;
