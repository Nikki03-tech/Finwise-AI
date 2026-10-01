import { calculateSIP } from "../utils/calculations.js";

export function analyzeSIP({
  monthlyInvestment,
  years,
  annualReturn = 12,
}) {
  return calculateSIP({
    monthlyInvestment,
    years,
    annualReturn,
  });
}
