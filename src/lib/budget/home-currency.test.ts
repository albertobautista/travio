import { describe, expect, it } from "vitest";

import { parseHomeCurrency, toHomeCurrency } from "./home-currency";

describe("parseHomeCurrency", () => {
  it("defaults to MXN", () => {
    expect(parseHomeCurrency(undefined)).toBe("MXN");
    expect(parseHomeCurrency("XYZ")).toBe("MXN");
  });

  it("keeps an offered currency, or none", () => {
    expect(parseHomeCurrency("EUR")).toBe("EUR");
    expect(parseHomeCurrency("none")).toBeNull();
  });
});

describe("toHomeCurrency", () => {
  it("divides by the trip's rate for that currency", () => {
    // 1 MXN = 0.055 USD, so US$100 ≈ $1,818.18 MXN.
    expect(toHomeCurrency(10_000, 0.055)).toBe(181_818);
  });
});
