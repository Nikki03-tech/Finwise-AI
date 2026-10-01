import "dotenv/config";

const requiredEnv = ["GEMINI_API_KEY"];

for (const key of requiredEnv) {
  if (!process.env[key]) {
    throw new Error(`Missing required environment variable: ${key}`);
  }
}

export const env = {
  geminiApiKey: process.env.GEMINI_API_KEY,
};
