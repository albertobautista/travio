import { describe, expect, it } from "vitest";

import { previewLine, routeLine } from "./share-text";

describe("routeLine", () => {
  it("joins a short route", () => {
    expect(routeLine(["Londres", "Cracovia", "Viena"])).toBe("Londres → Cracovia → Viena");
  });

  it("shortens a long route", () => {
    expect(routeLine(["Londres", "Cracovia", "Viena", "Budapest", "Madrid"])).toBe("Londres → Cracovia → Viena y 2 más");
  });
});

describe("previewLine", () => {
  it("has dates and route", () => {
    expect(previewLine({ start_date: "2026-04-06", end_date: "2026-04-20", cities: ["Londres", "Madrid"] })).toBe(
      "6 – 20 abr 2026 · Londres → Madrid",
    );
  });

  it("skips what the trip doesn't have yet", () => {
    expect(previewLine({ start_date: null, end_date: null, cities: [] })).toBe("");
    expect(previewLine({ start_date: null, end_date: null, cities: ["Roma"] })).toBe("Roma");
  });
});
