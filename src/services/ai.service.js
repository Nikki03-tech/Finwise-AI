import { GoogleGenAI } from "@google/genai";
import { getGeminiConfig } from "../config/env.js";

let client;
let configuredKey;

function getAIClient(apiKey) {
  if (!client || configuredKey !== apiKey) {
    client = new GoogleGenAI({ apiKey });
    configuredKey = apiKey;
  }

  return client;
}

export async function getAIResponse(prompt) {
  if (typeof prompt !== "string" || !prompt.trim()) {
    throw new Error("Prompt cannot be empty.");
  }

  // Resolve configuration only when an AI request is made. This allows the
  // web server and its health endpoint to start even before a key is added.
  const { apiKey, model } = getGeminiConfig();

  try {
    const response = await getAIClient(apiKey).models.generateContent({
      model,
      contents: prompt,
    });

    const text = response.text?.trim();
    if (!text) {
      const error = new Error("The AI provider returned an empty response.");
      error.code = "AI_EMPTY_RESPONSE";
      throw error;
    }

    return text;
  } catch (cause) {
    if (cause?.code === "AI_EMPTY_RESPONSE") {
      throw cause;
    }

    const error = new Error("The AI provider request failed.");
    error.code = "AI_PROVIDER_ERROR";
    error.cause = cause;
    throw error;
  }
}
