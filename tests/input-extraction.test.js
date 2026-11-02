import assert from "node:assert/strict";
import test from "node:test";
import { extractSIPInputs } from "../src/services/input-extraction.service.js";

test("extracts a rupee amount, duration, and explicit return", () => {
  assert.deepEqual(
    extractSIPInputs("Calculate an SIP of ₹5,000 per month for 5 years at 10%."),
    {
      isSIPRequest: true,
      canCalculate: true,
      monthlyInvestment: 5000,
      years: 5,
      annualReturn: 10,
      annualReturnIsAssumed: false,
      missingFields: [],
    },
  );
});

test("supports month-based duration", () => {
  const result = extractSIPInputs("SIP ₹3,000 monthly for 18 months");
  assert.equal(result.monthlyInvestment, 3000);
  assert.equal(result.years, 1.5);
  assert.equal(result.canCalculate, true);
});

test("does not invent missing monthly amount or duration", () => {
  const result = extractSIPInputs("Explain how an SIP works.");
  assert.equal(result.isSIPRequest, true);
  assert.equal(result.canCalculate, false);
  assert.equal(result.monthlyInvestment, null);
  assert.equal(result.years, null);
  assert.deepEqual(result.missingFields, ["monthly investment amount", "investment duration"]);
});

test("uses a clearly flagged illustrative 12% assumption when no rate is given", () => {
  const result = extractSIPInputs("Calculate SIP ₹5,000 per month for 5 years");
  assert.equal(result.annualReturn, 12);
  assert.equal(result.annualReturnIsAssumed, true);
});

test("does not classify an unrelated question as an SIP calculation", () => {
  assert.equal(extractSIPInputs("What is inflation?"), null);
});
