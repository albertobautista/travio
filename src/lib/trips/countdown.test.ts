import { describe, expect, it } from "vitest";

import { daysLeftLabel, timeLeft, tripCountdownTarget } from "./countdown";

const miami = { position: 1, timezone: "America/New_York" };
const flight = {
  type: "flight",
  carrier: "AA",
  service_number: "1234",
  origin_name: "México (MEX)",
  destination_name: "Miami",
  // 08:15 in Mexico City (UTC-6).
  departs_at: "2026-11-06T14:15:00Z",
  departs_timezone: "America/Mexico_City",
};

describe("tripCountdownTarget", () => {
  it("counts down to the first departure on the first day", () => {
    expect(tripCountdownTarget("2026-11-06", [miami], [flight])).toEqual({
      at: "2026-11-06T14:15:00.000Z",
      title: "Tu vuelo sale en",
      detail: "AA 1234 · México (MEX) 08:15 → Miami",
    });
  });

  it("also takes an overnight flight leaving the day before", () => {
    const redEye = { ...flight, departs_at: "2026-11-06T04:00:00Z" }; // 22:00 on the 5th in Mexico City
    expect(tripCountdownTarget("2026-11-06", [miami], [flight, redEye])?.at).toBe("2026-11-06T04:00:00.000Z");
  });

  it("ignores legs later in the trip and uses midnight in the first city", () => {
    const later = { ...flight, departs_at: "2026-11-09T14:15:00Z" };
    expect(tripCountdownTarget("2026-11-06", [miami], [later])).toEqual({
      at: "2026-11-06T05:00:00.000Z", // 00:00 in New York (UTC-5 after DST ends)
      title: "El viaje empieza en",
      detail: null,
    });
  });

  it("has nothing to count down to without dates", () => {
    expect(tripCountdownTarget(null, [miami], [flight])).toBeNull();
  });
});

describe("timeLeft", () => {
  it("splits into days, hours and minutes, rounding up", () => {
    const now = Date.parse("2026-10-09T12:00:30Z");
    expect(timeLeft("2026-10-11T15:30:00Z", now)).toEqual({ days: 2, hours: 3, minutes: 30, done: false });
  });

  it("stops at zero", () => {
    expect(timeLeft("2026-10-09T12:00:00Z", Date.parse("2026-10-09T13:00:00Z"))).toEqual({ days: 0, hours: 0, minutes: 0, done: true });
  });
});

describe("daysLeftLabel", () => {
  it.each([
    ["2026-10-09", "Hoy empieza"],
    ["2026-10-10", "¡Es mañana!"],
    ["2026-11-13", "Faltan 35 días"],
    ["2027-03-10", "Faltan 5 meses"],
  ])("%s -> %s", (start, label) => {
    expect(daysLeftLabel(start, "2026-10-09")).toBe(label);
  });
});
