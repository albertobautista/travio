import { describe, expect, it } from "vitest";

import { activityDate, buildItineraryDays, pickDay } from "./itinerary";

describe("activityDate", () => {
  it("is the local date where the activity happens, not UTC", () => {
    // 21:30 UTC on 3 Oct is 23:30 in Madrid: still the 3rd.
    expect(activityDate({ starts_at: "2026-10-03T21:30:00Z", timezone: "Europe/Madrid" })).toBe("2026-10-03");
    // 00:30 in Madrid on the 4th is 22:30 UTC on the 3rd.
    expect(activityDate({ starts_at: "2026-10-03T22:30:00Z", timezone: "Europe/Madrid" })).toBe("2026-10-04");
  });
});

describe("buildItineraryDays", () => {
  it("lists every trip day with its number and counts activities", () => {
    const days = buildItineraryDays({ start_date: "2026-10-01", end_date: "2026-10-03" }, ["2026-10-02", "2026-10-02"]);
    expect(days.map((d) => [d.date, d.dayNumber, d.activityCount])).toEqual([
      ["2026-10-01", 1, 0],
      ["2026-10-02", 2, 2],
      ["2026-10-03", 3, 0],
    ]);
  });

  it("adds days outside the trip that have activities, without a number", () => {
    const days = buildItineraryDays({ start_date: "2026-10-01", end_date: "2026-10-01" }, ["2026-09-30"]);
    expect(days.map((d) => [d.date, d.dayNumber])).toEqual([
      ["2026-09-30", null],
      ["2026-10-01", 1],
    ]);
  });

  it("caps a mistyped range at 120 days", () => {
    expect(buildItineraryDays({ start_date: "2026-01-01", end_date: "2062-01-01" }, [])).toHaveLength(120);
  });
});

describe("pickDay", () => {
  const days = buildItineraryDays({ start_date: "2026-10-01", end_date: "2026-10-03" }, ["2026-10-02"]);

  it("prefers the requested day, then today, then the first with plans", () => {
    expect(pickDay(days, "2026-10-03", "2026-10-01")?.date).toBe("2026-10-03");
    expect(pickDay(days, undefined, "2026-10-01")?.date).toBe("2026-10-01");
    expect(pickDay(days, "nope", "2025-01-01")?.date).toBe("2026-10-02");
  });
});
