import { describe, expect, it } from "vitest";

import { guessTimeZone, isKnownTimeZone, listTimeZones, searchTimeZones, timeZoneLabel } from "./time-zones";

// July: northern summer time, so offsets are the daylight ones.
const zones = listTimeZones(new Date("2026-07-01T12:00:00Z"));
const ids = (query: string) => searchTimeZones(zones, query).map((m) => m.option.id);

describe("searchTimeZones", () => {
  it("finds Miami, which has no zone of its own", () => {
    const [first] = searchTimeZones(zones, "miami");
    expect(first.option.id).toBe("America/New_York");
    expect(first.title).toBe("Miami");
  });

  it("ignores accents and case", () => {
    expect(ids("cancun")[0]).toBe("America/Cancun");
    expect(ids("LONDRES")[0]).toBe("Europe/London");
  });

  it("still finds zones by their English IANA city", () => {
    expect(ids("new york")[0]).toBe("America/New_York");
  });

  it("finds zones by generic name and by offset", () => {
    expect(ids("pacífico")).toContain("America/Los_Angeles");
    expect(ids("GMT-4")).toContain("America/New_York");
    expect(ids("gmt+2")).toContain("Europe/Madrid");
  });

  it("ranks well-known cities above small IANA places", () => {
    expect(ids("san")[0]).not.toMatch(/^America\/(Santarem|Santa_Isabel)$/);
  });

  it("returns nothing for an empty query", () => {
    expect(searchTimeZones(zones, "  ")).toEqual([]);
  });
});

describe("guessTimeZone", () => {
  it("recognizes a listed city inside a place name", () => {
    expect(guessTimeZone("Miami (MIA)")).toBe("America/New_York");
    expect(guessTimeZone("Aeropuerto de Cancún")).toBe("America/Cancun");
  });

  it("only matches whole words", () => {
    expect(guessTimeZone("Limassol")).toBeNull();
  });

  it("returns null when it doesn't know", () => {
    expect(guessTimeZone("Estación central")).toBeNull();
  });
});

describe("labels and validation", () => {
  it("labels a zone by its best-known city and offset", () => {
    const ny = zones.find((z) => z.id === "America/New_York")!;
    expect(timeZoneLabel(ny)).toBe("Nueva York · GMT-4");
    expect(ny.generic).toMatch(/^hora/);
  });

  it("accepts IANA names only", () => {
    expect(isKnownTimeZone("America/New_York")).toBe(true);
    expect(isKnownTimeZone("Miami")).toBe(false);
  });
});
