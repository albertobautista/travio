import { describe, expect, it } from "vitest";

import type { ActivityData } from "./activity-form";
import { buildRepeats, parseRepeatDates, tripDates } from "./repeat";

const trip = { start_date: "2026-04-06", end_date: "2026-04-10" };
const london = { id: "london", timezone: "Europe/London", arrives_on: "2026-04-06", departs_on: "2026-04-08" };
const krakow = { id: "krakow", timezone: "Europe/Warsaw", arrives_on: "2026-04-08", departs_on: "2026-04-10" };

const breakfast: ActivityData = {
  title: "Desayuno en el hotel",
  category: "food",
  trip_stop_id: "london",
  timezone: "Europe/London",
  starts_at: "2026-04-06T07:00:00.000Z",
  duration_minutes: 60,
  location_name: "Hotel Strand",
  address: "Strand 1",
  booking_status: "planned",
  reservation_ref: null,
  cost_amount: 15,
  cost_currency: "GBP",
  external_url: null,
  notes: null,
  google_place_id: "ChIJabcdefghij",
  lat: 51.5,
  lng: -0.12,
};

describe("tripDates", () => {
  it("lists every day of the trip", () => {
    expect(tripDates(trip)).toEqual(["2026-04-06", "2026-04-07", "2026-04-08", "2026-04-09", "2026-04-10"]);
  });

  it("is empty without dates", () => {
    expect(tripDates({ start_date: null, end_date: null })).toEqual([]);
  });
});

describe("parseRepeatDates", () => {
  it("keeps trip days other than the activity's own, sorted and once", () => {
    expect(parseRepeatDates(["2026-04-09", "2026-04-06", "2026-04-07", "2026-04-07"], trip, "2026-04-06")).toEqual([
      "2026-04-07",
      "2026-04-09",
    ]);
  });

  it("drops days outside the trip and junk", () => {
    expect(parseRepeatDates(["2026-04-11", "2026-04-05", "mañana"], trip, "2026-04-06")).toEqual([]);
  });
});

describe("buildRepeats", () => {
  it("copies the activity at the same local time each day", () => {
    const [copy] = buildRepeats(breakfast, "08:00", ["2026-04-07"], [london, krakow]);
    expect(copy).toEqual({ ...breakfast, starts_at: "2026-04-07T07:00:00.000Z" });
  });

  it("keeps the city on a travel day it still covers", () => {
    const [copy] = buildRepeats(breakfast, "08:00", ["2026-04-08"], [london, krakow]);
    expect(copy.trip_stop_id).toBe("london");
    expect(copy.location_name).toBe("Hotel Strand");
  });

  it("moves to the day's city and time zone, without the other city's place", () => {
    const [copy] = buildRepeats(breakfast, "08:00", ["2026-04-09"], [london, krakow]);
    expect(copy).toMatchObject({
      trip_stop_id: "krakow",
      timezone: "Europe/Warsaw",
      // 08:00 in Krakow (UTC+2 in April).
      starts_at: "2026-04-09T06:00:00.000Z",
      location_name: null,
      address: null,
      google_place_id: null,
      lat: null,
      lng: null,
      cost_amount: 15,
    });
  });

  it("leaves an activity without a city as it is", () => {
    const [copy] = buildRepeats({ ...breakfast, trip_stop_id: null }, "08:00", ["2026-04-09"], [london, krakow]);
    expect(copy).toMatchObject({ trip_stop_id: null, timezone: "Europe/London", location_name: "Hotel Strand" });
  });
});
