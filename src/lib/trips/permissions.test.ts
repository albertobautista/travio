import { describe, expect, it } from "vitest";

import { canAdd, canChange, toMemberPermissions, type TripAccess } from "./permissions";

const me = "00000000-0000-4000-a000-000000000002";
const other = "00000000-0000-4000-a000-000000000001";
const access = (role: TripAccess["role"], permissions: TripAccess["permissions"] = []): TripAccess => ({
  role,
  permissions,
  userId: me,
});

describe("canAdd", () => {
  it("lets owners and editors add anything", () => {
    expect(canAdd(access("owner"), "saved_places")).toBe(true);
    expect(canAdd(access("editor"), "expenses")).toBe(true);
  });

  it("lets a viewer add only what the owner allowed", () => {
    expect(canAdd(access("viewer"), "saved_places")).toBe(false);
    expect(canAdd(access("viewer", ["saved_places"]), "saved_places")).toBe(true);
    expect(canAdd(access("viewer", ["saved_places"]), "expenses")).toBe(false);
  });

  it("gives nothing to non-members", () => {
    expect(canAdd(access(null, ["saved_places"]), "saved_places")).toBe(false);
  });
});

describe("canChange", () => {
  it("lets editors change what anyone added", () => {
    expect(canChange(access("editor"), "saved_places", other)).toBe(true);
    expect(canChange(access("editor"), "saved_places", null)).toBe(true);
  });

  it("lets an allowed viewer change only their own", () => {
    const viewer = access("viewer", ["expenses"]);
    expect(canChange(viewer, "expenses", me)).toBe(true);
    expect(canChange(viewer, "expenses", other)).toBe(false);
    expect(canChange(viewer, "expenses", null)).toBe(false);
    expect(canChange(access("viewer"), "expenses", me)).toBe(false);
  });
});

describe("toMemberPermissions", () => {
  it("drops unknown values", () => {
    expect(toMemberPermissions(["expenses", "activities"])).toEqual(["expenses"]);
    expect(toMemberPermissions(null)).toEqual([]);
  });
});
