import { GoogleGenAI } from "@google/genai";
import { env } from "../config/env.js";

const ai = new GoogleGenAI({
  apiKey: env.geminiApiKey,
});

// Current model ID documented by Google's Gemini API model catalogue.
const MODEL = "gemini-3.5-flash-lite";

export async function getAIResponse(prompt) {
  if (!prompt || !prompt.trim()) {
    throw new Error("Prompt cannot be empty");
  }

  const response = await ai.models.generateContent({
    model: MODEL,
    contents: prompt,
  });

  const text = response.text?.trim();
  if (!text) {
    throw new Error("The AI service returned an empty response. Please try again.");
  }

  return text;
}
