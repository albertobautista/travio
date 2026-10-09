import { describe, expect, it } from "vitest";

import { formatTripDates, getNights, getTripDayNumber, getTripLengthDays, getTripStatus, todayIn } from "./dates";

describe("getTripStatus", () => {
  it.each([
    ["2026-10-01", "upcoming"],
    ["2026-10-05", "active"],
    ["2026-10-19", "active"],
    ["2026-10-20", "past"],
  ] as const)("on %s the trip is %s", (today, status) => {
    expect(getTripStatus("2026-10-05", "2026-10-19", today)).toBe(status);
  });

  it("is undated without a start", () => {
    expect(getTripStatus(null, null, "2026-10-05")).toBe("undated");
  });

  it("treats a trip with only a start as one day", () => {
    expect(getTripStatus("2026-10-05", null, "2026-10-06")).toBe("past");
  });
});

describe("trip length and day number", () => {
  it("counts days inclusively: 6–20 Apr is 15 days", () => {
    expect(getTripLengthDays("2026-04-06", "2026-04-20")).toBe(15);
  });

  it("numbers today within the trip, only while it's on", () => {
    expect(getTripDayNumber("2026-09-27", "2026-10-19", "2026-10-03")).toBe(7);
    expect(getTripDayNumber("2026-09-27", "2026-10-19", "2026-10-30")).toBeNull();
  });

  it("arriving the 6th and leaving the 8th is 2 nights", () => {
    expect(getNights("2026-10-06", "2026-10-08")).toBe(2);
  });
});

describe("formatTripDates", () => {
  it.each([
    ["2026-04-06", "2026-04-20", "6 – 20 abr 2026"],
    ["2026-11-25", "2026-12-06", "25 nov – 6 dic 2026"],
    ["2026-02-17", "2027-03-03", "17 feb 2026 – 3 mar 2027"],
  ])("%s – %s", (start, end, expected) => {
    expect(formatTripDates(start, end)).toBe(expected);
  });

  it("says when there are no dates", () => {
    expect(formatTripDates(null, null)).toBe("Sin fechas");
  });
});

describe("todayIn", () => {
  it("is the calendar date in that time zone", () => {
    const lateNightInMexico = new Date("2026-10-06T05:30:00Z"); // 23:30 on the 5th in Mexico City
    expect(todayIn("America/Mexico_City", lateNightInMexico)).toBe("2026-10-05");
    expect(todayIn("Europe/Madrid", lateNightInMexico)).toBe("2026-10-06");
  });
});
