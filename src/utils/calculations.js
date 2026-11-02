export function calculateSIP({
  monthlyInvestment,
  annualReturn = 12,
  years,
}) {
  if (!Number.isFinite(monthlyInvestment) || monthlyInvestment <= 0) {
    const error = new Error("Monthly investment must be greater than 0.");
    error.code = "INVALID_SIP_INPUT";
    throw error;
  }

  if (monthlyInvestment > 1_000_000_000) {
    const error = new Error("Monthly investment is above the supported calculation limit.");
    error.code = "INVALID_SIP_INPUT";
    throw error;
  }

  if (!Number.isFinite(years) || years <= 0 || years > 80) {
    const error = new Error("Investment duration must be greater than 0 and no more than 80 years.");
    error.code = "INVALID_SIP_INPUT";
    throw error;
  }

  if (!Number.isFinite(annualReturn) || annualReturn < 0 || annualReturn > 100) {
    const error = new Error("Annual return assumption must be between 0% and 100%.");
    error.code = "INVALID_SIP_INPUT";
    throw error;
  }

  const months = Math.round(years * 12);
  if (months < 1) {
    const error = new Error("Investment duration must cover at least one month.");
    error.code = "INVALID_SIP_INPUT";
    throw error;
  }

  const monthlyRate = annualReturn / 100 / 12;
  const futureValue = monthlyRate === 0
    ? monthlyInvestment * months
    : monthlyInvestment *
      (((1 + monthlyRate) ** months - 1) / monthlyRate) *
      (1 + monthlyRate);

  if (!Number.isFinite(futureValue)) {
    const error = new Error("These inputs are outside the supported calculation range.");
    error.code = "INVALID_SIP_INPUT";
    throw error;
  }

  const totalInvested = monthlyInvestment * months;
  const estimatedGain = futureValue - totalInvested;

  return {
    monthlyInvestment,
    annualReturn,
    years,
    months,
    totalInvested: Math.round(totalInvested),
    estimatedValue: Math.round(futureValue),
    estimatedGain: Math.round(estimatedGain),
  };
}
