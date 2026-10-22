import { describe, expect, it } from "vitest";

import { redactAnalyticsUrl } from "./redact";

describe("redactAnalyticsUrl", () => {
  it("hides the token of invitation, group and share links", () => {
    expect(redactAnalyticsUrl("https://travio.com.mx/invitacion/abc123")).toBe("https://travio.com.mx/invitacion/[token]");
    expect(redactAnalyticsUrl("https://travio.com.mx/unirse/abc123")).toBe("https://travio.com.mx/unirse/[token]");
    expect(redactAnalyticsUrl("https://travio.com.mx/v/XyZ9")).toBe("https://travio.com.mx/v/[token]");
  });

  it("drops the query string and hash", () => {
    expect(redactAnalyticsUrl("https://travio.com.mx/login?next=%2Fviajes%2F1&error=google#x")).toBe(
      "https://travio.com.mx/login",
    );
  });

  it("leaves other paths alone", () => {
    expect(redactAnalyticsUrl("https://travio.com.mx/viajes/1f0e/hoy")).toBe("https://travio.com.mx/viajes/1f0e/hoy");
    expect(redactAnalyticsUrl("https://travio.com.mx/viajes")).toBe("https://travio.com.mx/viajes");
  });
});
