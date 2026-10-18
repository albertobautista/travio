import { describe, expect, it } from "vitest";

import { hotelReturn } from "./travel";

const hotel = { point: { lat: 41.3851, lng: 2.1734 } };

describe("hotelReturn", () => {
  it("estimates the way back, rounded up to 5 minutes", () => {
    // About 1 km away: walking.
    const last = { category: "food", point: { lat: 41.3941, lng: 2.1734 } };
    expect(hotelReturn(last, hotel)).toEqual({ minutes: 20 });
  });

  it("uses transit time when it's far", () => {
    const last = { category: "sightseeing", point: { lat: 41.4036, lng: 2.1744 } };
    const result = hotelReturn(last, hotel);
    expect(result?.minutes).toBeGreaterThan(0);
    expect(result!.minutes % 5).toBe(0);
  });

  it("falls back to 30 minutes without coordinates", () => {
    expect(hotelReturn({ category: "tour", point: null }, hotel)).toEqual({ minutes: 30 });
    expect(hotelReturn({ category: "tour", point: hotel.point }, { point: null })).toEqual({ minutes: 30 });
  });

  it("offers nothing when the day already ends with a transfer or at the hotel", () => {
    expect(hotelReturn({ category: "transfer", point: null }, hotel)).toBeNull();
    expect(hotelReturn({ category: "food", point: { lat: 41.3852, lng: 2.1735 } }, hotel)).toBeNull();
  });
});
