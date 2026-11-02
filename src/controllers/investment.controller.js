import { analyzeSIP } from "../services/investment.service.js";
import { sendError, sendSuccess } from "../utils/response.js";

export function createInvestmentController(service = analyzeSIP) {
  return {
    calculateSIP: (req, res) => {
      const monthlyInvestment = Number(req.body?.monthlyInvestment);
      const years = Number(req.body?.years);
      const rawAnnualReturn = req.body?.annualReturn;
      const annualReturnIsAssumed = rawAnnualReturn === undefined;
      const annualReturn = annualReturnIsAssumed ? 12 : Number(rawAnnualReturn);

      if (
        rawAnnualReturn === null ||
        !Number.isFinite(monthlyInvestment) ||
        !Number.isFinite(years) ||
        !Number.isFinite(annualReturn)
      ) {
        return sendError(res, 400, "Monthly investment, duration, and return assumption must be valid numbers.");
      }

      try {
        const calculation = service({
          monthlyInvestment,
          years,
          annualReturn,
        });

        return sendSuccess(res, {
          calculation,
          annualReturnIsAssumed,
          disclaimer: "Illustrative mathematical projection only. Returns are not guaranteed and this is not personalized financial advice.",
        });
      } catch (error) {
        if (error?.code === "INVALID_SIP_INPUT") {
          return sendError(res, 400, error.message);
        }
        console.error("SIP calculation failed:", error?.message || error);
        return sendError(res, 500, "The SIP calculation could not be completed.");
      }
    },
  };
}

export const investmentController = createInvestmentController();
