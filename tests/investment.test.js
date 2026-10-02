import assert from "node:assert/strict";
import test from "node:test";
import { calculateSIP } from "../src/utils/calculations.js";

test("calculates SIP for ₹5,000/month for 5 years at 12%", () => {
  const result = calculateSIP({
    monthlyInvestment: 5000,
    years: 5,
    annualReturn: 12,
  });

  assert.equal(result.months, 60);
  assert.equal(result.totalInvested, 300000);
  assert.equal(result.estimatedValue, 412432);
  assert.equal(result.estimatedGain, 112432);
});

test("calculates SIP correctly when return is 0%", () => {
  const result = calculateSIP({
    monthlyInvestment: 5000,
    years: 5,
    annualReturn: 0,
  });

  assert.equal(result.months, 60);
  assert.equal(result.totalInvested, 300000);
  assert.equal(result.estimatedValue, 300000);
  assert.equal(result.estimatedGain, 0);
});

test("rejects zero monthly investment", () => {
  assert.throws(
    () =>
      calculateSIP({
        monthlyInvestment: 0,
        years: 5,
        annualReturn: 12,
      }),
    /Monthly investment must be greater than 0/
  );
});

test("rejects negative monthly investment", () => {
  assert.throws(
    () =>
      calculateSIP({
        monthlyInvestment: -5000,
        years: 5,
        annualReturn: 12,
      }),
    /Monthly investment must be greater than 0/
  );
});

test("rejects zero investment duration", () => {
  assert.throws(
    () =>
      calculateSIP({
        monthlyInvestment: 5000,
        years: 0,
        annualReturn: 12,
      }),
    /Investment duration must be greater than 0/
  );
});

test("rejects negative annual return", () => {
  assert.throws(
    () =>
      calculateSIP({
        monthlyInvestment: 5000,
        years: 5,
        annualReturn: -1,
      }),
    /Annual return must be 0 or greater/
  );
});
test("uses beginning-of-month SIP timing", () => {
  const result = calculateSIP({
    monthlyInvestment: 5000,
    years: 5,
    annualReturn: 12,
  });

  const monthlyRate = 0.12 / 12;
  const endOfMonthValue =
    5000 *
    (((1 + monthlyRate) ** 60 - 1) / monthlyRate);

  assert.equal(
    result.estimatedValue,
    Math.round(endOfMonthValue * (1 + monthlyRate))
  );

  assert.notEqual(
    result.estimatedValue,
    Math.round(endOfMonthValue)
  );
});
test("rounds fractional years to the nearest month", () => {
  const result = calculateSIP({
    monthlyInvestment: 5000,
    years: 2.5,
    annualReturn: 12,
  });

  assert.equal(result.months, 30);
  assert.equal(result.totalInvested, 150000);
});
