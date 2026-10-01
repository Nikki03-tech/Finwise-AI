import "dotenv/config";
import { getAIResponse } from "./src/services/ai.service.js";

const result = await getAIResponse(
  "Explain SIP in simple terms for a college student."
);

console.log("\n🤖 FinWise AI Test Response:\n");
console.log(result);
