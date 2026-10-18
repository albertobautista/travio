import { describe, expect, it } from "vitest";

import { settleUpText } from "./share-text";

const names = new Map([
  ["yo", "Alberto"],
  ["xi", "Ximena"],
]);

describe("settleUpText", () => {
  it("lists each person, who pays whom and past payments", () => {
    const text = settleUpText({
      tripName: "España 2026",
      currency: "USD",
      spent: 400_000,
      names,
      balances: [
        { travelerId: "yo", paid: 300_000, owed: 200_000, settled: 0, balance: 100_000 },
        { travelerId: "xi", paid: 100_000, owed: 200_000, settled: 0, balance: -100_000 },
      ],
      transfers: [{ from: "xi", to: "yo", amount: 100_000 }],
      settlements: [{ id: "s1", from_traveler: "xi", to_traveler: "yo", amount: 50, currency: "USD" }],
      alsoIn: (cents) => `≈ $${cents / 5} MXN`,
    });
    expect(text).toContain("*Cuentas · España 2026*");
    expect(text).toContain("• Alberto: pagó $3,000, le toca $2,000. Le deben $1,000 USD (≈ $20000 MXN).");
    expect(text).toContain("• Ximena: pagó $1,000, le toca $2,000. Debe $1,000 USD (≈ $20000 MXN).");
    expect(text).toContain("• Ximena le paga a Alberto $1,000 USD (≈ $20000 MXN)");
    expect(text).toContain("• Ximena le pagó a Alberto $50 USD");
  });

  it("says when everyone is even", () => {
    const text = settleUpText({
      tripName: "Viaje",
      currency: "MXN",
      spent: 0,
      names,
      balances: [],
      transfers: [],
      settlements: [],
      alsoIn: () => null,
    });
    expect(text).toContain("Ya están a mano.");
    expect(text).not.toContain("Pagos ya hechos");
  });
});
