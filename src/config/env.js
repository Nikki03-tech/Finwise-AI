export function isGeminiConfigured() {
  const apiKey = process.env.GEMINI_API_KEY?.trim();
  return Boolean(apiKey && apiKey !== "your_gemini_api_key_here");
}

export function getGeminiConfig() {
  const apiKey = process.env.GEMINI_API_KEY?.trim();

  if (!apiKey || apiKey === "your_gemini_api_key_here") {
    const error = new Error("GEMINI_API_KEY is not configured.");
    error.code = "AI_NOT_CONFIGURED";
    throw error;
  }

  return {
    apiKey,
    model: process.env.GEMINI_MODEL?.trim() || "gemini-3.5-flash-lite",
  };
}
