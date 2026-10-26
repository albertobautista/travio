import { describe, expect, it } from "vitest";

import { isDestination, routeOrder, routePath, stopForDate } from "./stops";

const stop = (name: string, position: number, kind: string, arrives_on: string | null = null, departs_on = arrives_on) => ({
  name,
  position,
  kind,
  arrives_on,
  departs_on,
});

describe("route order", () => {
  // The origin was added last, so it sits at the end by position.
  const stops = [
    stop("Ciudad de México", 1, "transit", "2027-04-06"),
    stop("Londres", 2, "destination", "2027-04-07", "2027-04-12"),
    stop("Guadalajara", 3, "origin"),
  ];

  it("shows the origin first", () => {
    expect(routeOrder(stops).map((s) => s.name)).toEqual(["Guadalajara", "Ciudad de México", "Londres"]);
  });

  it("draws the route back to the origin", () => {
    expect(routePath(stops).map((s) => s.name)).toEqual(["Guadalajara", "Ciudad de México", "Londres", "Guadalajara"]);
  });

  it("without an origin, the route is just the stops in order", () => {
    expect(routePath(stops.slice(0, 2)).map((s) => s.name)).toEqual(["Ciudad de México", "Londres"]);
  });

  it("treats stops without a kind as destinations", () => {
    expect(isDestination({})).toBe(true);
    expect(stops.filter(isDestination).map((s) => s.name)).toEqual(["Londres"]);
  });
});

describe("stopForDate", () => {
  it("prefers the destination over a connection the same day", () => {
    const stops = [stop("Ciudad de México", 1, "transit", "2027-04-07"), stop("Londres", 2, "destination", "2027-04-07", "2027-04-12")];
    expect(stopForDate(stops, "2027-04-07")?.name).toBe("Londres");
  });

  it("still gives up between two destinations on a travel day", () => {
    const stops = [stop("Madrid", 1, "destination", "2027-04-01", "2027-04-05"), stop("Sevilla", 2, "destination", "2027-04-05", "2027-04-08")];
    expect(stopForDate(stops, "2027-04-05")).toBeUndefined();
  });
});
