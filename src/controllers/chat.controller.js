import { runResearchAgent } from "../agents/research.agent.js";
import { runInvestmentAgent } from "../agents/investment.agent.js";
import { runRiskAgent } from "../agents/risk.agent.js";
import { runDecisionAgent } from "../agents/decision.agent.js";
import { extractSIPInputs } from "../services/input-extraction.service.js";
import { getFinancialContext } from "../services/financial-context.service.js";
import { calculateSIP } from "../utils/calculations.js";

export function createChatController(agents = {}) {
  const researchAgent = agents.runResearchAgent ?? runResearchAgent;
  const investmentAgent = agents.runInvestmentAgent ?? runInvestmentAgent;
  const riskAgent = agents.runRiskAgent ?? runRiskAgent;
  const decisionAgent = agents.runDecisionAgent ?? runDecisionAgent;
  const financialContextService = agents.getFinancialContext ?? getFinancialContext;

  return async function chatController(req, res) {
    const message = req.body?.message;

    if (typeof message !== "string" || !message.trim()) {
      return res.status(400).json({
        success: false,
        error: "Please enter a financial question.",
      });
    }

    const userQuestion = message.trim();
    if (userQuestion.length > 4000) {
      return res.status(413).json({
        success: false,
        error: "Please keep your question under 4,000 characters.",
      });
    }

    try {
      const sipInputs = extractSIPInputs(userQuestion);
      let investment = null;
      let risk = null;

      if (sipInputs?.canCalculate) {
        // Validate the scenario before making any external AI requests.
        calculateSIP({
          monthlyInvestment: sipInputs.monthlyInvestment,
          years: sipInputs.years,
          annualReturn: sipInputs.annualReturn,
        });

        const [research, investmentResult, riskResult, financialContext] =
          await Promise.all([
            researchAgent({ topic: userQuestion }),
            investmentAgent({
              monthlyInvestment: sipInputs.monthlyInvestment,
              years: sipInputs.years,
              annualReturn: sipInputs.annualReturn,
            }),
            riskAgent({
              monthlyInvestment: sipInputs.monthlyInvestment,
              years: sipInputs.years,
              annualReturn: sipInputs.annualReturn,
              investmentType: "equity mutual fund",
            }),
            financialContextService(userQuestion),
          ]);

        investment = {
          ...investmentResult,
          annualReturnIsAssumed: sipInputs.annualReturnIsAssumed,
        };
        risk = riskResult;

        const decision = await decisionAgent({
          userQuestion,
          research,
          investment,
          risk,
          sipInputs,
          financialContext,
        });

        return res.json({
          success: true,
          reply: decision.answer,
          data: { research, investment, risk, financialContext },
        });
      }

      const [research, financialContext] = await Promise.all([
        researchAgent({ topic: userQuestion }),
        financialContextService(userQuestion),
      ]);
      const decision = await decisionAgent({
        userQuestion,
        research,
        investment,
        risk,
        sipInputs,
        financialContext,
      });

      return res.json({
        success: true,
        reply: decision.answer,
        data: { research, investment, risk, financialContext },
      });
    } catch (error) {
      console.error("FinWise chat request failed:", {
        code: error?.code || "INTERNAL_ERROR",
        message: error?.message || "Unknown error",
      });

      if (error?.code === "INVALID_SIP_INPUT") {
        return res.status(400).json({
          success: false,
          error: error.message,
        });
      }

      if (error?.code === "AI_NOT_CONFIGURED") {
        return res.status(503).json({
          success: false,
          error: "FinWise AI is not configured yet. Please try again later.",
        });
      }

      if (
        error?.code === "AI_PROVIDER_ERROR" ||
        error?.code === "AI_EMPTY_RESPONSE"
      ) {
        return res.status(502).json({
          success: false,
          error: "FinWise AI could not get a response from its AI provider. Please try again.",
        });
      }

      return res.status(500).json({
        success: false,
        error: "FinWise AI could not process your request. Please try again.",
      });
    }
  };
}

export const chatController = createChatController();
