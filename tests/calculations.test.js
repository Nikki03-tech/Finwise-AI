import assert from "node:assert/strict";
import test from "node:test";
import { calculateSIP } from "../src/utils/calculations.js";

test("calculates a ₹5,000 monthly SIP for five years at 12%", () => {
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

test("handles a zero return assumption", () => {
  const result = calculateSIP({
    monthlyInvestment: 5000,
    years: 5,
    annualReturn: 0,
  });

  assert.equal(result.totalInvested, 300000);
  assert.equal(result.estimatedValue, 300000);
  assert.equal(result.estimatedGain, 0);
});

test("uses beginning-of-month SIP timing", () => {
  const result = calculateSIP({
    monthlyInvestment: 5000,
    years: 5,
    annualReturn: 12,
  });
  const rate = 0.12 / 12;
  const endOfMonth = 5000 * (((1 + rate) ** 60 - 1) / rate);

  assert.equal(result.estimatedValue, Math.round(endOfMonth * (1 + rate)));
  assert.notEqual(result.estimatedValue, Math.round(endOfMonth));
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

test("rejects invalid contribution, duration, and return values", () => {
  for (const monthlyInvestment of [0, -100, Number.NaN]) {
    assert.throws(
      () => calculateSIP({ monthlyInvestment, years: 5, annualReturn: 12 }),
      { code: "INVALID_SIP_INPUT" },
    );
  }

  for (const years of [0, -1, 81, 0.01]) {
    assert.throws(
      () => calculateSIP({ monthlyInvestment: 5000, years, annualReturn: 12 }),
      { code: "INVALID_SIP_INPUT" },
    );
  }

  for (const annualReturn of [-1, 101, Number.NaN]) {
    assert.throws(
      () => calculateSIP({ monthlyInvestment: 5000, years: 5, annualReturn }),
      { code: "INVALID_SIP_INPUT" },
    );
  }
});
