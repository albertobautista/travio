import { fileURLToPath } from "node:url";

import { defineConfig } from "vitest/config";

/**
 * Unit tests for pure logic (src/lib/**). They run in Node, with no
 * database or browser: whatever touches Supabase is covered by the database
 * tests in supabase/tests (pgTAP, `supabase test db`).
 */
export default defineConfig({
  resolve: {
    alias: { "@": fileURLToPath(new URL("./src", import.meta.url)) },
  },
  test: {
    include: ["src/**/*.test.ts"],
    environment: "node",
    // Dates in tests are explicit instants; this only matters for code that
    // reads "now" or formats without a time zone.
    env: { TZ: "UTC" },
  },
});
