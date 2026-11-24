import { describe, expect, it } from "vitest";

import { cabinRows, parseSeat, resolveSeatLayout, sameSeat, seatPosition, visibleRows } from "./seat-map";

describe("parseSeat", () => {
  it("reads row and letter however they were typed", () => {
    expect(parseSeat("14A")).toEqual({ row: 14, letter: "A" });
    expect(parseSeat(" 3 c ")).toEqual({ row: 3, letter: "C" });
  });

  it("ignores train coaches, blanks and impossible rows", () => {
    expect(parseSeat("coche 7, 42")).toBeNull();
    expect(parseSeat("")).toBeNull();
    expect(parseSeat(null)).toBeNull();
    expect(parseSeat("0A")).toBeNull();
    expect(parseSeat("120A")).toBeNull();
  });

  it("compares seats case-insensitively", () => {
    expect(sameSeat("14a", "14A")).toBe(true);
    expect(sameSeat("14A", "15A")).toBe(false);
    expect(sameSeat("coche 7", "coche 7")).toBe(false);
  });
});

describe("resolveSeatLayout", () => {
  it("keeps the layout that was chosen", () => {
    expect(resolveSeatLayout("2-2", ["14K"])).toBe("2-2");
  });

  it("guesses from the letters when none was chosen", () => {
    expect(resolveSeatLayout(null, [])).toBe("3-3");
    expect(resolveSeatLayout(null, ["14A", "14F"])).toBe("3-3");
    expect(resolveSeatLayout(null, ["30H", "30J"])).toBe("3-3-3");
    expect(resolveSeatLayout(null, ["30H", "30K"])).toBe("2-4-2");
    expect(resolveSeatLayout(null, ["30B", "30K"])).toBe("3-4-3");
    expect(resolveSeatLayout("bogus", ["coche 7"])).toBe("3-3");
  });
});

describe("cabinRows", () => {
  it("grows when a seat is further back than the default size", () => {
    expect(cabinRows("3-3", ["14A"])).toBe(32);
    expect(cabinRows("3-3", ["41C"])).toBe(41);
  });
});

describe("visibleRows", () => {
  it("shows the taken rows with one around each, collapsing the rest", () => {
    expect(visibleRows([3, 30], 32)).toEqual([2, 3, 4, "gap", 29, 30, 31]);
  });

  it("merges nearby rows and stays inside the cabin", () => {
    expect(visibleRows([1, 3], 32)).toEqual([1, 2, 3, 4]);
    expect(visibleRows([32, 32], 32)).toEqual([31, 32]);
    expect(visibleRows([], 32)).toEqual([]);
  });
});

describe("seatPosition", () => {
  it("tells window, aisle and middle seats apart", () => {
    expect(seatPosition("3-3", "A")).toBe("ventana");
    expect(seatPosition("3-3", "F")).toBe("ventana");
    expect(seatPosition("3-3", "C")).toBe("pasillo");
    expect(seatPosition("3-3", "B")).toBe("en medio");
    expect(seatPosition("3-4-3", "G")).toBe("pasillo");
    expect(seatPosition("3-4-3", "E")).toBe("en medio");
    expect(seatPosition("2-2", "B")).toBeNull();
  });
});
