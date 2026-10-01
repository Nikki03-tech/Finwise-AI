import { getAIResponse } from "../services/ai.service.js";

export async function runResearchAgent(input) {
  // Support both:
  // runResearchAgent("question")
  // runResearchAgent({ topic: "question" })

  const question =
    typeof input === "string"
      ? input
      : input?.topic || input?.question || "";

  if (!question.trim()) {
    throw new Error("Research Agent requires a financial question.");
  }

  const prompt = `
You are the Research Agent for FinWise AI, a financial education assistant.

Analyze the user's financial question and provide useful factual context.

User question:
${question}

Return your response with these sections:

1. Topic
2. Key financial concepts
3. Important factors to consider
4. Information the user should verify
5. Research summary

Rules:
- Do not make a personalized investment recommendation.
- Do not claim to have access to real-time market data unless it is explicitly provided.
- Do not invent user details.
- Do not change numbers, dates, investment amounts, or time periods from the user's question.
- If the question does not provide a specific investment amount, duration, or return assumption, do not invent one.
- Keep the explanation clear and suitable for a beginner.
- Focus specifically on the user's question.
`;

  return await getAIResponse(prompt);
}
