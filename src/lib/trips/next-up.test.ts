import { describe, expect, it } from "vitest";

import { findNextUp } from "./next-up";

const now = new Date("2026-04-08T08:00:00Z");
const tz = "Europe/London";
const museum = { title: "Museo", category: "sightseeing", starts_at: "2026-04-08T14:00:00Z", timezone: tz };
const taxi = { title: "Taxi", category: "transfer", starts_at: "2026-04-08T09:00:00Z", timezone: tz };
const flight = { departs_at: "2026-04-08T11:00:00Z", departs_timezone: tz };
const hotel = { check_in_at: "2026-04-06T14:00:00Z", check_out_at: "2026-04-08T10:00:00Z", timezone: tz };

describe("findNextUp", () => {
  it("picks whatever comes first: here the check-out, before the flight and the museum", () => {
    expect(findNextUp([museum], [flight], [hotel], now)).toMatchObject({ kind: "check_out", item: hotel });
  });

  it("puts a flight ahead of a later activity", () => {
    expect(findNextUp([museum], [flight], [], now)).toMatchObject({ kind: "leg", at: flight.departs_at });
  });

  it("skips transfers and what already started", () => {
    const started = { ...museum, starts_at: "2026-04-08T07:00:00Z" };
    expect(findNextUp([taxi, started, museum], [], [], now)).toMatchObject({ kind: "activity", item: museum });
  });

  it("is undefined when nothing is left", () => {
    expect(findNextUp([], [], [hotel], new Date("2026-04-09T00:00:00Z"))).toBeUndefined();
  });
});
