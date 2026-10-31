import { describe, expect, it } from "vitest";

import { offlineTripPages, tripPages } from "./trip-pages";

const trip = { id: "t1", start_date: "2026-10-05", end_date: "2026-10-07" };

describe("offlineTripPages", () => {
  it("saves the trip in progress: main pages, each remaining day and every ticket", () => {
    const pages = offlineTripPages(trip, "2026-10-06", ["f1"]);
    expect(pages).toContain("/viajes/t1/hoy");
    expect(pages).toContain("/viajes/t1/itinerario?dia=2026-10-06");
    expect(pages).toContain("/viajes/t1/itinerario?dia=2026-10-07");
    expect(pages).not.toContain("/viajes/t1/itinerario?dia=2026-10-05"); // already over
    expect(pages).toContain("/viajes/t1/ticket/f1");
  });

  it("also the night before it starts, from its first day", () => {
    expect(offlineTripPages(trip, "2026-10-04", [])).toContain("/viajes/t1/itinerario?dia=2026-10-05");
  });

  it("nothing for trips that are far away, over or undated", () => {
    expect(offlineTripPages(trip, "2026-09-01", [])).toEqual([]);
    expect(offlineTripPages(trip, "2026-10-08", [])).toEqual([]);
    expect(offlineTripPages({ id: "t2", start_date: null, end_date: null }, "2026-10-06", [])).toEqual([]);
  });
});

describe("tripPages", () => {
  it("saves a trip that is weeks away, from its first day", () => {
    const pages = tripPages(trip, "2026-09-01", ["f1"]);
    expect(pages).toContain("/viajes/t1/hoy");
    expect(pages).toContain("/viajes/t1/documentos");
    expect(pages).toContain("/viajes/t1/itinerario?dia=2026-10-05");
    expect(pages).toContain("/viajes/t1/itinerario?dia=2026-10-07");
    expect(pages).toContain("/viajes/t1/ticket/f1");
  });

  it("skips days already over", () => {
    expect(tripPages(trip, "2026-10-06", [])).not.toContain("/viajes/t1/itinerario?dia=2026-10-05");
  });

  it("undated trips: only the main pages", () => {
    const pages = tripPages({ id: "t2", start_date: null, end_date: null }, "2026-10-06", []);
    expect(pages).toContain("/viajes/t2/itinerario");
    expect(pages.some((p) => p.includes("?dia="))).toBe(false);
  });
});
