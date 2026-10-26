import { describe, expect, it } from "vitest";

import { buildMapCities } from "./days";

const MX = "America/Mexico_City";
const LON = "Europe/London";

const stop = (id: string, name: string, position: number, kind: string, arrives_on: string | null = null, departs_on = arrives_on) => ({
  id,
  name,
  kind,
  position,
  arrives_on,
  departs_on,
  lat: 0,
  lng: 0,
});

const flight = (id: string, from: string, to: string, departs_at: string, arrives_at: string, fromZone = MX, toZone = MX) => ({
  id,
  type: "flight",
  origin_name: from,
  destination_name: to,
  departs_at,
  departs_timezone: fromZone,
  arrives_at,
  arrives_timezone: toZone,
  carrier: null,
  service_number: null,
});

describe("buildMapCities with home and connections", () => {
  // Guadalajara -> CDMX -> London, and back the same way. Home was added last.
  const stops = [
    stop("cdmx-1", "Ciudad de México", 1, "transit", "2027-04-06"),
    stop("lon", "Londres", 2, "destination", "2027-04-07", "2027-04-12"),
    stop("cdmx-2", "Ciudad de México", 3, "transit", "2027-04-12"),
    stop("gdl", "Guadalajara", 4, "origin"),
  ];
  const legs = [
    flight("out-1", "Guadalajara", "Ciudad de México", "2027-04-06T14:00:00Z", "2027-04-06T15:20:00Z"),
    flight("out-2", "Ciudad de México", "Londres", "2027-04-07T01:00:00Z", "2027-04-07T12:00:00Z", MX, LON),
    flight("back-1", "Londres", "Ciudad de México", "2027-04-12T10:00:00Z", "2027-04-12T21:00:00Z", LON, MX),
    flight("back-2", "Ciudad de México", "Guadalajara", "2027-04-13T02:00:00Z", "2027-04-13T03:20:00Z"),
  ];
  const cities = buildMapCities({ stops, activities: [], stays: [], legs, days: [] });

  it("puts home first and numbers only the destinations", () => {
    expect(cities.map((c) => [c.name, c.order])).toEqual([
      ["Guadalajara", null],
      ["Ciudad de México", null],
      ["Londres", 1],
      ["Ciudad de México", null],
    ]);
  });

  it("home: the first departure and the last arrival", () => {
    expect(cities[0].leaveBy?.text).toContain("a Ciudad de México");
    expect(cities[0].arriveBy?.text).toBe("Vuelo desde Ciudad de México");
  });

  it("a connection leaves on the next leg, not the one that brought you", () => {
    // 2027-04-06 local in CDMX: lands from Guadalajara 09:20, leaves for London 19:00.
    expect(cities[1].arriveBy?.text).toBe("Vuelo desde Guadalajara");
    expect(cities[1].leaveBy?.text).toContain("a Londres");
    // On the way back: lands from London, leaves for Guadalajara.
    expect(cities[3].arriveBy?.text).toBe("Vuelo desde Londres");
    expect(cities[3].leaveBy?.text).toContain("a Guadalajara");
  });
});
