import { runResearchAgent } from "./src/agents/research.agent.js";

const result = await runResearchAgent(
  "Should I invest ₹5,000 per month in an SIP for 5 years?"
);

console.log("\n🔎 FinWise Research Agent:\n");
console.log(result);
