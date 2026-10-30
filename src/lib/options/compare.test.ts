import { describe, expect, it } from "vitest";

import { cheapestId, fastestId, groupByRoute, perNight, priceInTripCurrency, routeKey } from "./compare";

const rates = new Map([["EUR", 21.5]]);

describe("cheapestId", () => {
  it("compares in the trip currency", () => {
    const options = [
      { id: "a", cost_amount: 9000, cost_currency: "MXN" },
      { id: "b", cost_amount: 400, cost_currency: "EUR" }, // 8,600 MXN
    ];
    expect(cheapestId(options, "MXN", rates)).toBe("b");
  });

  it("needs at least two prices it can compare", () => {
    expect(cheapestId([{ id: "a", cost_amount: 100, cost_currency: "MXN" }], "MXN", rates)).toBeNull();
    const noRate = [
      { id: "a", cost_amount: 100, cost_currency: "MXN" },
      { id: "b", cost_amount: 5, cost_currency: "GBP" },
      { id: "c", cost_amount: null, cost_currency: null },
    ];
    expect(cheapestId(noRate, "MXN", rates)).toBeNull();
  });

  it("names nobody on a tie", () => {
    const tie = [
      { id: "a", cost_amount: 100, cost_currency: "MXN" },
      { id: "b", cost_amount: 100, cost_currency: "MXN" },
    ];
    expect(cheapestId(tie, "MXN", rates)).toBeNull();
  });
});

describe("priceInTripCurrency", () => {
  it("returns cents, or null without a rate", () => {
    expect(priceInTripCurrency({ id: "a", cost_amount: 10, cost_currency: "EUR" }, "MXN", rates)).toBe(21_500);
    expect(priceInTripCurrency({ id: "a", cost_amount: 10, cost_currency: "USD" }, "MXN", rates)).toBeNull();
  });
});

describe("fastestId", () => {
  const leg = (id: string, departs: string, arrives: string) => ({
    id,
    departs_at: departs,
    arrives_at: arrives,
    departs_timezone: "Europe/London",
    arrives_timezone: "Europe/Warsaw",
  });

  it("uses real travel time, not local clock times", () => {
    // 08:10 London → 11:30 Krakow looks like 3 h 20 min on the clocks but is 2 h 20 min.
    const direct = leg("direct", "2027-04-09T07:10:00Z", "2027-04-09T09:30:00Z");
    const stop = leg("stop", "2027-04-09T06:00:00Z", "2027-04-09T11:00:00Z");
    expect(fastestId([stop, direct])).toBe("direct");
    expect(fastestId([direct])).toBeNull();
  });
});

describe("perNight", () => {
  it("splits the total over the nights", () => {
    expect(perNight(900_000, 3)).toBe(300_000);
    expect(perNight(100, 0)).toBeNull();
  });
});

describe("routes", () => {
  it("ignores accents, case and extra spaces", () => {
    expect(routeKey({ origin_name: "Ciudad de México ", destination_name: "Londres" })).toBe(
      routeKey({ origin_name: "ciudad  de mexico", destination_name: "londres" }),
    );
  });

  it("groups alternatives by route, earliest first", () => {
    const groups = groupByRoute([
      { id: "2", origin_name: "Viena", destination_name: "Budapest", departs_at: "2027-04-15T08:00:00Z" },
      { id: "1", origin_name: "Londres", destination_name: "Cracovia", departs_at: "2027-04-09T07:00:00Z" },
      { id: "3", origin_name: "Viena", destination_name: "Budapest", departs_at: "2027-04-14T08:00:00Z" },
    ]);
    expect(groups.map((g) => g.legs.map((l) => l.id))).toEqual([["1"], ["3", "2"]]);
  });
});
