import { describe, expect, it } from "vitest";

import { resolveTripNow } from "./today";

const stop = (name: string, arrives: string, departs: string, timezone = "Europe/Madrid") => ({
  name,
  timezone,
  arrives_on: arrives,
  departs_on: departs,
});

describe("resolveTripNow", () => {
  const stops = [stop("Madrid", "2026-10-02", "2026-10-05"), stop("Sevilla", "2026-10-05", "2026-10-08")];

  it("finds the city for today", () => {
    const now = resolveTripNow(stops, new Date("2026-10-03T10:00:00Z"));
    expect(now.today).toBe("2026-10-03");
    expect(now.stop?.name).toBe("Madrid");
  });

  it("on a travel day, picks the city you arrive in", () => {
    expect(resolveTripNow(stops, new Date("2026-10-05T10:00:00Z")).stop?.name).toBe("Sevilla");
  });

  it("uses the city's own clock, not the server's", () => {
    // 22:30 UTC on the 4th is already 00:30 on the 5th in Madrid.
    expect(resolveTripNow(stops, new Date("2026-10-04T22:30:00Z")).today).toBe("2026-10-05");
  });

  it("outside the stops, no city but the first stop's time zone", () => {
    const now = resolveTripNow(stops, new Date("2026-12-01T10:00:00Z"));
    expect(now.stop).toBeUndefined();
    expect(now.timeZone).toBe("Europe/Madrid");
  });
});
