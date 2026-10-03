// Regression tests for the offset-mortgage payoff line, exercised through computeOutput.
// Run from this directory with Node's built-in runner (no dependencies):
//   node --test calc.test.mjs
//
// All figures are synthetic round numbers. Only the loan keys are supplied, so the
// output is the payoff line alone: "MM-yy <years>y <months>m".
//
// NOW is mid-month at 12:00Z, so its local calendar month is January 2026 in every
// timezone, and it equals the projection start (sy=2026, sm=0). No months are
// subtracted for elapsed time, so the reported months equal the simulated months.

import { test } from "node:test";
import assert from "node:assert/strict";
import { computeOutput } from "./calc.js";

const NOW = new Date(Date.UTC(2026, 0, 15, 12));
const START = { sy: 2026, sm: 0, infl: 0 };

test("savings go to the offset only: at 0% the gap closes by pmt + monthly savings", () => {
  // Gap = loan - offset = 100,000. Each month the offset gains 1,000 (12,000 / 12) and
  // the loan falls by pmt = 1,000, so the gap closes by 2,000 a month and reaches 0
  // after exactly 50 months = 4y 2m. Jan 2026 + 50 months = Mar 2030.
  const p = { ...START, rate: 0, loan: 100000, offset: 0, pmt: 1000, sav: 12000 };
  assert.equal(computeOutput(p, NOW), "03-30 4y 2m");
});

test("no interest accrues once the offset covers the loan: paid off in the first month", () => {
  // Month 1 (Jan): offset 99,900 + 100 = 100,000 = loan, so loan - offset = 0 and no
  // interest accrues at any rate. pmt takes the loan to 99,900, which the offset
  // (100,000) covers: paid off after 1 month. Jan 2026 + 1 month = Feb 2026.
  const p = { ...START, rate: 0.07305, loan: 100000, offset: 99900, pmt: 100, sav: 1200 };
  assert.equal(computeOutput(p, NOW), "02-26 0y 1m");
});

test("interest is charged on loan minus offset while the loan exceeds the offset", () => {
  // Daily rate = 0.07305 / 365.25 = 0.0002.
  // Month 1 (Jan, 31 days): offset 98,900 + 100 = 99,000; loan - offset = 1,000;
  //   interest = 1,000 x 0.0002 x 31 = 6.20; loan = 100,000 + 6.20 - 1,000 = 99,006.20,
  //   still above the offset (99,000), so not yet paid off. (With no interest at all the
  //   loan would equal the offset here and the result would be 1 month.)
  // Month 2 (Feb 2026, 28 days): offset 99,100 exceeds the loan, so no interest;
  //   loan = 98,006.20, covered by the offset: paid off after 2 months = Mar 2026.
  const p = { ...START, rate: 0.07305, loan: 100000, offset: 98900, pmt: 1000, sav: 1200 };
  assert.equal(computeOutput(p, NOW), "03-26 0y 2m");
});
