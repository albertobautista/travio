import { describe, expect, it } from "vitest";

import { safeRedirectPath } from "./safe-redirect";

describe("safeRedirectPath", () => {
  it("keeps paths inside the app", () => {
    expect(safeRedirectPath("/invitacion/abc?x=1")).toBe("/invitacion/abc?x=1");
  });

  it.each(["https://evil.com", "//evil.com", "/\\evil.com", "javascript:alert(1)", "", null, undefined])(
    "refuses %s (open redirect)",
    (next) => {
      expect(safeRedirectPath(next)).toBe("/viajes");
    },
  );
});
