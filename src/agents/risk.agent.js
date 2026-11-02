import { getAIResponse } from "../services/ai.service.js";

export async function runRiskAgent({
  monthlyInvestment,
  years,
  annualReturn = 12,
  investmentType = "equity mutual fund",
}) {
  const months = Math.round(years * 12);
  const totalInvested = monthlyInvestment * months;

  const prompt = `
You are the Risk Analysis Agent for FinWise AI, an educational financial assistant.

Analyze this illustrative scenario:
Investment type: ${investmentType}
Monthly investment: ₹${monthlyInvestment}
Investment duration: ${years} years
Illustrative annual return assumption: ${annualReturn}%
Total amount contributed: ₹${totalInvested}

Cover:
1. Market and volatility risk
2. Time-horizon risk
3. Inflation risk
4. Liquidity considerations
5. Return uncertainty, including the possibility of a loss
6. Important details a user should independently verify

Do not guarantee returns. Do not tell the user to buy, sell, or definitely invest.
Do not present this as personalized financial advice. Be concise and beginner-friendly.
`;

  const analysis = await getAIResponse(prompt);

  return {
    investmentType,
    monthlyInvestment,
    years,
    annualReturn,
    totalInvested,
    analysis,
  };
}
