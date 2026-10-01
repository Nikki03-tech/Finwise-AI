import { GoogleGenAI } from "@google/genai";
import { env } from "../config/env.js";

const ai = new GoogleGenAI({
  apiKey: env.geminiApiKey,
});

const MODEL = "gemini-3.5-flash-lite";

export async function getAIResponse(prompt) {
  if (!prompt || !prompt.trim()) {
    throw new Error("Prompt cannot be empty");
  }

  const response = await ai.models.generateContent({
    model: MODEL,
    contents: prompt,
  });

  return response.text;
}
