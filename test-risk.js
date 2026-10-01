import { runRiskAgent } from "./src/agents/risk.agent.js";

const result = await runRiskAgent({
  monthlyInvestment: 5000,
  years: 5,
  annualReturn: 12,
  investmentType: "equity mutual fund",
});

console.log("\n⚠️ FinWise Risk Agent\n");

console.log("Scenario:");
console.log({
  monthlyInvestment: result.monthlyInvestment,
  years: result.years,
  annualReturn: result.annualReturn,
  totalInvested: result.totalInvested,
});

console.log("\n🤖 Risk Analysis:\n");
console.log(result.analysis);
