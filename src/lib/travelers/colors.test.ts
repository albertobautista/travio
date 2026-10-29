import { describe, expect, it } from "vitest";

import { colorForId, TRAVELER_COLORS } from "./colors";

describe("colorForId", () => {
  it("always gives the same color for the same id", () => {
    const id = "6f1c2a4e-3b7d-4e8f-9a0b-1c2d3e4f5a6b";
    expect(colorForId(id)).toBe(colorForId(id));
  });

  it("spreads different ids across the palette", () => {
    const ids = Array.from({ length: 60 }, (_, i) => `00000000-0000-4000-8000-${String(i).padStart(12, "0")}`);
    const used = new Set(ids.map(colorForId));
    expect(used.size).toBe(TRAVELER_COLORS.length);
  });
});
