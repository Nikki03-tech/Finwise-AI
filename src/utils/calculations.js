export function calculateSIP({
  monthlyInvestment,
  annualReturn = 12,
  years,
}) {
  if (
    !Number.isFinite(monthlyInvestment) ||
    monthlyInvestment <= 0
  ) {
    throw new Error("Monthly investment must be greater than 0");
  }

  if (!Number.isFinite(years) || years <= 0) {
    throw new Error("Investment duration must be greater than 0");
  }

  if (!Number.isFinite(annualReturn) || annualReturn < 0) {
    throw new Error("Annual return must be 0 or greater");
  }

  const months = Math.round(years * 12);
  const monthlyRate = annualReturn / 100 / 12;

  let futureValue;

  if (monthlyRate === 0) {
    futureValue = monthlyInvestment * months;
  } else {
    futureValue =
      monthlyInvestment *
      (((1 + monthlyRate) ** months - 1) / monthlyRate) *
      (1 + monthlyRate);
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
