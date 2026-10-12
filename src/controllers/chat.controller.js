import { runResearchAgent } from "../agents/research.agent.js";
import { runInvestmentAgent } from "../agents/investment.agent.js";
import { runRiskAgent } from "../agents/risk.agent.js";
import { runDecisionAgent } from "../agents/decision.agent.js";

function extractInvestmentInputs(question) {
  const text = question.replace(/,/g, "").replace(/₹/g, " ");
  const monthlyMatch =
    text.match(/(?:₹?\s*)?(\d+(?:\.\d+)?)\s*(?:per\s+month|\/\s*month|monthly)\b/i) ||
    text.match(/monthly\s+(?:investment\s+of\s+)?(?:₹?\s*)?(\d+(?:\.\d+)?)/i);
  const yearsMatch = text.match(/(\d+(?:\.\d+)?)\s*years?\b/i);
  const returnMatch =
    text.match(/(\d+(?:\.\d+)?)\s*%\s*(?:annual|yearly|per\s+year)?/i) ||
    text.match(/(?:annual|yearly)\s+return\s+(?:of\s+)?(\d+(?:\.\d+)?)/i);

  return {
    monthlyInvestment: monthlyMatch ? Number(monthlyMatch[1]) : 5000,
    years: yearsMatch ? Number(yearsMatch[1]) : 5,
    annualReturn: returnMatch ? Number(returnMatch[1]) : 12,
  };
}

export async function chatController(req, res) {
  try {
    const { message } = req.body;

    if (typeof message !== "string" || !message.trim()) {
      return res.status(400).json({ error: "Message is required" });
    }

    const userQuestion = message.trim();
    const { monthlyInvestment, years, annualReturn } =
      extractInvestmentInputs(userQuestion);

    console.log("🔎 Research Agent...");
    const research = await runResearchAgent({ topic: userQuestion });

    console.log("📊 Investment Agent...");
    const investment = await runInvestmentAgent({
      monthlyInvestment,
      years,
      annualReturn,
    });

    console.log("⚠️ Risk Agent...");
    const risk = await runRiskAgent({
      monthlyInvestment,
      years,
      annualReturn,
      investmentType: "equity mutual fund",
    });

    console.log("🤖 Decision Agent...");
    const decision = await runDecisionAgent({
      userQuestion,
      research,
      investment,
      risk,
    });

    return res.json({
      success: true,
      reply: decision.answer,
      data: { research, investment, risk },
    });
  } catch (error) {
    console.error("❌ Chat error:", error);
    return res.status(500).json({
      success: false,
      error: "FinWise AI could not process your request.",
      details: error.message,
    });
  }
}
