import { getAIResponse } from "../services/ai.service.js";
import { analyzeSIP } from "../services/investment.service.js";

export async function runInvestmentAgent({
  monthlyInvestment,
  years,
  annualReturn = 12,
}) {
  const calculation = analyzeSIP({
    monthlyInvestment,
    years,
    annualReturn,
  });

  const prompt = `
You are the Investment Analysis Agent for FinWise AI.

Analyze the following SIP calculation for educational purposes:

Monthly investment: ₹${calculation.monthlyInvestment}
Duration: ${calculation.years} years
Illustrative annual return assumption: ${calculation.annualReturn}%
Total invested: ₹${calculation.totalInvested}
Illustrative estimated value: ₹${calculation.estimatedValue}
Illustrative estimated gain: ₹${calculation.estimatedGain}

Provide a concise, beginner-friendly explanation with these sections:

### 1. What These Numbers Mean
Explain the monthly investment, duration, total amount invested, illustrative estimated value, and illustrative estimated gain.

### 2. How the Investment Grows
Explain regular contributions, compounding, and rupee-cost averaging in simple language.

### 3. Important Risks
Explain market risk, volatility, inflation risk, and the possibility of receiving less than the amount invested.

### 4. Why the Assumed Return Is NOT Guaranteed
Clearly explain that the ${calculation.annualReturn}% annual return is ONLY a hypothetical mathematical assumption.
Do not present it as an expected, promised, or likely return.

IMPORTANT FORMATTING RULES:
- Use Indian number formatting wherever possible.
- ₹5000 should be written as ₹5,000.
- ₹300000 should be written as ₹3,00,000.
- ₹412432 should be written as ₹4,12,432.
- Never write values such as ₹3,000,000.
- Never write phrases such as "correction based on your math".
- Do not invent or modify any of the calculated values.
- Do not make personalized investment recommendations.
- Keep the response concise and educational.
`;

  const explanation = await getAIResponse(prompt);

  return {
    calculation,
    explanation,
  };
}
