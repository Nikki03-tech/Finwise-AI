import { getAIResponse } from "../services/ai.service.js";

export async function runDecisionAgent({
  userQuestion,
  research,
  investment,
  risk,
  sipInputs,
}) {
  const prompt = `
You are the Decision Agent for FinWise AI, an educational financial assistant.

USER QUESTION:
${userQuestion}

RESEARCH AGENT CONTEXT (AI-generated general information; not live market data):
${research}

SIP INPUTS:
${JSON.stringify(sipInputs, null, 2)}

INVESTMENT ANALYSIS:
${investment ? JSON.stringify(investment, null, 2) : "Not calculated because the user has not supplied a clear monthly SIP amount and duration."}

RISK ANALYSIS:
${risk ? JSON.stringify(risk, null, 2) : "No specific SIP risk calculation was run."}

Instructions:
1. Answer the user's actual question directly in simple, beginner-friendly language.
2. Use only the calculation values supplied above; never invent or modify them.
3. If SIP details are missing, explain which details are needed and ask the user to provide them. Do not insert default amounts or durations.
4. If an annual return assumption is marked as assumed, clearly say that 12% is an illustrative assumption, not a prediction or guarantee.
5. Include the main risks when discussing investments.
6. Do not guarantee investment returns or present illustrative values as expected returns.
7. Do not make personalized buy, sell, or investment recommendations.
8. Do not claim to have accessed live prices, current news, or market data.
9. Use Indian Rupee formatting wherever appropriate.
10. Be concise and avoid repeating the same explanation.

Use helpful headings where they improve readability. End with a brief disclaimer that this is educational information, not personalized financial advice.
`;

  const answer = await getAIResponse(prompt);
  return { answer };
}
