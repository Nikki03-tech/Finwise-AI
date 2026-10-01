import { getAIResponse } from "../services/ai.service.js";

export async function runRiskAgent({
  monthlyInvestment,
  years,
  annualReturn = 12,
  investmentType = "equity mutual fund",
}) {
  const totalInvested = monthlyInvestment * years * 12;

  const prompt = `
You are the Risk Analysis Agent for FinWise AI.

Analyze the following investment scenario:

Investment type: ${investmentType}
Monthly investment: ₹${monthlyInvestment}
Investment duration: ${years} years
Illustrative annual return assumption: ${annualReturn}%
Total amount contributed: ₹${totalInvested}

Identify the major risks relevant to this scenario.

Cover:
1. Market risk
2. Time-horizon risk
3. Inflation risk
4. Liquidity considerations
5. Return uncertainty
6. Important factors the investor should verify

Do not guarantee returns.
Do not make a personalized investment recommendation.
Do not tell the user to definitely invest or not invest.
Clearly distinguish educational information from personalized financial advice.

Return a concise, beginner-friendly risk assessment.
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
