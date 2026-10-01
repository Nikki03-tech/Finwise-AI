import { runInvestmentAgent } from "./src/agents/investment.agent.js";

const result = await runInvestmentAgent({
  monthlyInvestment: 5000,
  years: 5,
  annualReturn: 12,
});

console.log("\n📊 FinWise Investment Agent\n");

console.log("Calculation:");
console.log(result.calculation);

console.log("\n🤖 AI Analysis:\n");
console.log(result.explanation);
