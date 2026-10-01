import { runResearchAgent } from "../agents/research.agent.js";
import { runInvestmentAgent } from "../agents/investment.agent.js";
import { runRiskAgent } from "../agents/risk.agent.js";
import { runDecisionAgent } from "../agents/decision.agent.js";

export async function chatController(req, res) {
  try {
    const { message } = req.body;

    if (!message || !message.trim()) {
      return res.status(400).json({
        error: "Message is required",
      });
    }

    const userQuestion = message.trim();

    // For now, use these defaults for the investment scenario.
    // Later we will extract these values from the user's question.
    const monthlyInvestment = 5000;
    const years = 5;
    const annualReturn = 12;

    console.log("🔎 Research Agent...");
    const research = await runResearchAgent({
      topic: userQuestion,
    });

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
      data: {
        research,
        investment,
        risk,
      },
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
