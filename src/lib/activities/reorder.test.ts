import { describe, expect, it } from "vitest";

import { dropActivity, startForDrop } from "./reorder";

const at = (iso: string) => new Date(iso).getTime();
// Madrid, 8 Apr: museum 10:00–12:00, tour 13:00–15:00 (UTC+2).
const museum = { start: at("2027-04-08T08:00:00Z"), end: at("2027-04-08T10:00:00Z") };
const tour = { start: at("2027-04-08T11:00:00Z"), end: at("2027-04-08T13:00:00Z") };

describe("startForDrop", () => {
  it("starts when the row before ends", () => {
    expect(startForDrop([museum, tour], 1, 60)).toBe(museum.end);
    expect(startForDrop([museum, tour], 2, 60)).toBe(tour.end);
  });

  it("dropped first, ends just as the next row begins", () => {
    expect(startForDrop([museum, tour], 0, 90)).toBe(museum.start - 90 * 60_000);
  });

  it("needs something to place it against", () => {
    expect(startForDrop([], 0, 60)).toBeNull();
    expect(startForDrop([museum], 2, 60)).toBeNull();
  });
});

describe("dropActivity", () => {
  const lunch = { starts_at: "2027-04-08T15:00:00Z", timezone: "Europe/Madrid", duration_minutes: 60 };

  it("gives the new start as an ISO instant", () => {
    expect(dropActivity(lunch, [museum, tour], 1)).toEqual({ startsAt: "2027-04-08T10:00:00.000Z" });
  });

  it("refuses a place that moves it to another day", () => {
    // A 9-hour activity first, before a 08:00 start, would begin the day before.
    const long = { ...lunch, duration_minutes: 9 * 60 };
    const early = { start: at("2027-04-08T06:00:00Z"), end: at("2027-04-08T07:00:00Z") };
    expect(dropActivity(long, [early, tour], 0)).toHaveProperty("error");
    // After something that ends past midnight local time.
    const night = { start: at("2027-04-08T20:00:00Z"), end: at("2027-04-08T23:00:00Z") };
    expect(dropActivity(lunch, [museum, night], 2)).toHaveProperty("error");
  });
});
