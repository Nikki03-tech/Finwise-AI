function toNumber(value) {
  if (!value) return null;
  const number = Number(value.replace(/,/g, ""));
  return Number.isFinite(number) ? number : null;
}

function firstCapture(text, patterns) {
  for (const pattern of patterns) {
    const match = text.match(pattern);
    if (match) return toNumber(match[1]);
  }
  return null;
}

/**
 * Extracts only clearly stated SIP inputs.
 * A 12% annual return is used as an explicitly marked illustration when the
 * user does not provide a rate; amount and duration are never invented.
 */
export function extractSIPInputs(question) {
  const text = typeof question === "string" ? question.trim() : "";
  if (!text) return null;

  const monthlyInvestment = firstCapture(text, [
    /(?:₹|rs\.?|inr)?\s*([\d,]+(?:\.\d+)?)\s*(?:\/\s*month|per\s+month|each\s+month|monthly)\b/i,
    /\bmonthly\s+(?:sip|investment|contribution)\s*(?:of|is|:)?\s*(?:₹|rs\.?|inr)?\s*([\d,]+(?:\.\d+)?)/i,
  ]);

  const yearsValue = firstCapture(text, [
    /\b(\d+(?:\.\d+)?)\s*(?:years?|yrs?)\b/i,
  ]);
  const monthsValue = firstCapture(text, [
    /\b(\d+(?:\.\d+)?)\s*months?\b/i,
  ]);
  const years = yearsValue ?? (monthsValue !== null ? monthsValue / 12 : null);

  const returnValue = firstCapture(text, [
    /\b(\d+(?:\.\d+)?)\s*%/i,
    /\b(?:annual|yearly)\s+return\s+(?:of\s+)?(\d+(?:\.\d+)?)/i,
  ]);

  const mentionsSIP = /\b(?:sip|systematic investment plan)\b/i.test(text);
  const mentionsInvestment = /\b(?:invest(?:ment|ing)?|mutual fund)\b/i.test(text);
  const isSIPRequest = mentionsSIP ||
    (mentionsInvestment && monthlyInvestment !== null);

  if (!isSIPRequest) return null;

  const missingFields = [];
  if (monthlyInvestment === null || monthlyInvestment <= 0) {
    missingFields.push("monthly investment amount");
  }
  if (years === null || years <= 0) {
    missingFields.push("investment duration");
  }

  return {
    isSIPRequest: true,
    canCalculate: missingFields.length === 0,
    monthlyInvestment,
    years,
    annualReturn: returnValue ?? 12,
    annualReturnIsAssumed: returnValue === null,
    missingFields,
  };
}
