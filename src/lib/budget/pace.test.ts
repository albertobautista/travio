import { describe, expect, it } from "vitest";

import { budgetPace } from "./pace";

const trip = { startDate: "2026-04-06", endDate: "2026-04-20" };

describe("budgetPace", () => {
  it("spreads what's left over the days left, today included", () => {
    expect(budgetPace({ ...trip, budget: 100_000, spent: 40_000, today: "2026-04-16" })).toEqual({
      kind: "left-per-day",
      perDay: 12_000,
      days: 5,
    });
  });

  it("before the trip, spreads what's left over the whole trip", () => {
    expect(budgetPace({ ...trip, budget: 150_000, spent: 0, today: "2026-03-01" })).toEqual({
      kind: "left-per-day",
      perDay: 10_000,
      days: 15,
    });
  });

  it("rounds down to whole units", () => {
    expect(budgetPace({ ...trip, budget: 100_000, spent: 1, today: "2026-04-18" })).toMatchObject({ perDay: 33_300 });
  });

  it("says nothing once the budget is used up", () => {
    expect(budgetPace({ ...trip, budget: 100_000, spent: 100_000, today: "2026-04-16" })).toBeNull();
  });

  it("without a budget, averages what was spent per day so far", () => {
    expect(budgetPace({ ...trip, budget: null, spent: 30_000, today: "2026-04-08" })).toEqual({
      kind: "spent-per-day",
      perDay: 10_000,
      days: 3,
    });
  });

  it("says nothing for past or undated trips", () => {
    expect(budgetPace({ ...trip, budget: 100_000, spent: 0, today: "2026-05-01" })).toBeNull();
    expect(budgetPace({ startDate: null, endDate: null, budget: 100_000, spent: 0, today: "2026-04-10" })).toBeNull();
  });

  it("treats a trip with only a start date as one day", () => {
    expect(budgetPace({ startDate: "2026-04-06", endDate: null, budget: 5_000, spent: 0, today: "2026-04-06" })).toEqual({
      kind: "left-per-day",
      perDay: 5_000,
      days: 1,
    });
  });
});
