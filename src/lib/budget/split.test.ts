import { describe, expect, it } from "vitest";

import { allocate, computeBalances, expenseParts, settleUp, type SplitExpense } from "./split";

describe("allocate", () => {
  it("splits cents so the parts add up exactly", () => {
    const parts = allocate(1000, [1, 1, 1]);
    expect(parts.reduce((a, b) => a + b, 0)).toBe(1000);
    expect(parts.sort()).toEqual([333, 333, 334]);
  });

  it("follows the weights", () => {
    expect(allocate(1000, [70, 30])).toEqual([700, 300]);
  });

  it("gives nothing when there's nothing to weigh", () => {
    expect(allocate(1000, [0, 0])).toEqual([0, 0]);
  });
});

describe("expenseParts", () => {
  const people = ["ana", "leo", "sofia"];

  it("no shares means everyone, in equal parts", () => {
    const parts = expenseParts({ split_mode: "equal", expense_shares: [] }, 900, people);
    expect([...parts.values()]).toEqual([300, 300, 300]);
  });

  it("splits by percentages among the listed people only", () => {
    const parts = expenseParts(
      { split_mode: "percent", expense_shares: [{ traveler_id: "ana", share: 75 }, { traveler_id: "leo", share: 25 }] },
      1000,
      people,
    );
    expect(Object.fromEntries(parts)).toEqual({ ana: 750, leo: 250 });
  });

  it("ignores shares of people who left the trip", () => {
    const parts = expenseParts({ split_mode: "equal", expense_shares: [{ traveler_id: "ghost", share: null }] }, 900, people);
    expect(parts.size).toBe(3);
  });
});

describe("computeBalances", () => {
  const expense = (id: string, amount: number, currency: string, paid_by: string | null): SplitExpense => ({
    id,
    amount,
    currency,
    paid_by,
    split_mode: "equal",
    expense_shares: [],
  });

  it("works out who owes whom, converting with the trip's rates", () => {
    const { balances, transfers, withoutPayer, unconverted } = computeBalances({
      travelerIds: ["ana", "leo"],
      expenses: [expense("cena", 100, "EUR", "ana"), expense("taxi", 9, "USD", "leo"), expense("x", 50, "MXN", null)],
      settlements: [],
      tripCurrency: "MXN",
      rates: new Map([["EUR", 20]]),
    });
    // 100 EUR = 2000 MXN, split in two: Leo owes Ana 1000 MXN (100000 cents).
    expect(balances.find((b) => b.travelerId === "ana")?.balance).toBe(100000);
    expect(transfers).toEqual([{ from: "leo", to: "ana", amount: 100000 }]);
    // No payer, and no rate for USD: both left out and reported.
    expect(withoutPayer).toBe(1);
    expect(unconverted).toEqual(["USD"]);
  });

  it("a recorded payment settles the debt", () => {
    const { transfers } = computeBalances({
      travelerIds: ["ana", "leo"],
      expenses: [expense("cena", 1000, "MXN", "ana")],
      settlements: [{ id: "s", from_traveler: "leo", to_traveler: "ana", amount: 500, currency: "MXN" }],
      tripCurrency: "MXN",
      rates: new Map(),
    });
    expect(transfers).toEqual([]);
  });
});

describe("settleUp", () => {
  it("uses at most n − 1 payments and clears every balance", () => {
    const balances = [
      { travelerId: "ana", balance: 600 },
      { travelerId: "leo", balance: -400 },
      { travelerId: "sofia", balance: -200 },
    ];
    const transfers = settleUp(balances);
    expect(transfers.length).toBeLessThanOrEqual(2);
    const net = new Map(balances.map((b) => [b.travelerId, b.balance]));
    for (const t of transfers) {
      net.set(t.from, net.get(t.from)! + t.amount);
      net.set(t.to, net.get(t.to)! - t.amount);
    }
    expect([...net.values()]).toEqual([0, 0, 0]);
  });
});
