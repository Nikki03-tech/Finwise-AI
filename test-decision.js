import { runResearchAgent } from "./src/agents/research.agent.js";
import { runInvestmentAgent } from "./src/agents/investment.agent.js";
import { runRiskAgent } from "./src/agents/risk.agent.js";
import { runDecisionAgent } from "./src/agents/decision.agent.js";

const userQuestion =
  "Should I invest ₹5,000 per month in an SIP for 5 years?";

console.log("\n🔎 Running Research Agent...");
const research = await runResearchAgent({
  topic: userQuestion,
});

console.log("📊 Running Investment Agent...");
const investment = await runInvestmentAgent({
  monthlyInvestment: 5000,
  years: 5,
  annualReturn: 12,
});

console.log("⚠️ Running Risk Agent...");
const risk = await runRiskAgent({
  monthlyInvestment: 5000,
  years: 5,
  annualReturn: 12,
  investmentType: "equity mutual fund",
});

console.log("🤖 Running Decision Agent...");

const decision = await runDecisionAgent({
  userQuestion,
  research,
  investment,
  risk,
});

console.log("\n==============================");
console.log("🤖 FINWISE AI FINAL RESPONSE");
console.log("==============================\n");

console.log(decision.answer);
