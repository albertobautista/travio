import { convert, toCents } from "./money";

/**
 * Who owes whom. Pure, so it's easy to test.
 *
 * Every expense with a payer is converted to the trip's currency (with the
 * trip's rates) and divided among its travelers:
 *   - equal: same weight for each (no shares = every traveler);
 *   - amount / percent: the shares are the weights.
 * Dividing by weights (not copying the amounts) keeps it right even if the
 * amounts no longer add up, e.g. after a traveler was removed.
 *
 * Money is in integer cents. Splitting €100.00 in 3 gives 3334 + 3333 + 3333:
 * the leftover cents go to the largest remainders (then list order), so the
 * parts always add up to the total exactly.
 */

export type SplitMode = "equal" | "amount" | "percent";

export const SPLIT_MODES: Record<SplitMode, string> = {
  equal: "Partes iguales",
  amount: "Montos exactos",
  percent: "Porcentajes",
};

export function isSplitMode(value: unknown): value is SplitMode {
  return typeof value === "string" && value in SPLIT_MODES;
}

export type SplitExpense = {
  id: string;
  amount: number;
  currency: string;
  paid_by: string | null;
  split_mode: string;
  expense_shares: { traveler_id: string; share: number | null }[];
};

export type Settlement = { id: string; from_traveler: string; to_traveler: string; amount: number; currency: string };

export type PersonBalance = {
  travelerId: string;
  /** What they paid for the group, in cents of the trip currency. */
  paid: number;
  /** Their part of the expenses. */
  owed: number;
  /** Payments made (+) and received (−) to settle up. */
  settled: number;
  /** > 0: the group owes them; < 0: they owe. paid − owed + settled. */
  balance: number;
};

export type Transfer = { from: string; to: string; amount: number };

/** Divides `total` cents by `weights` so the parts add up to `total` exactly. */
export function allocate(total: number, weights: number[]): number[] {
  const sum = weights.reduce((a, w) => a + w, 0);
  if (sum <= 0 || weights.length === 0) return weights.map(() => 0);
  const exact = weights.map((w) => (total * w) / sum);
  const parts = exact.map(Math.floor);
  let left = total - parts.reduce((a, p) => a + p, 0);
  const order = exact.map((x, i) => ({ i, r: x - Math.floor(x) })).sort((a, b) => b.r - a.r || a.i - b.i);
  for (const { i } of order) {
    if (left <= 0) break;
    parts[i] += 1;
    left -= 1;
  }
  return parts;
}

/** Each traveler's part of one expense, in cents of `total`. */
export function expenseParts(expense: Pick<SplitExpense, "split_mode" | "expense_shares">, total: number, travelerIds: string[]) {
  const known = new Set(travelerIds);
  const shares = expense.expense_shares.filter((s) => known.has(s.traveler_id));
  const people = shares.length > 0 ? shares.map((s) => s.traveler_id) : travelerIds;
  const weights =
    expense.split_mode === "equal" || shares.length === 0 ? people.map(() => 1) : shares.map((s) => Number(s.share ?? 0));
  const parts = allocate(total, weights);
  return new Map(people.map((id, i) => [id, parts[i]]));
}

export function computeBalances({
  travelerIds,
  expenses,
  settlements,
  tripCurrency,
  rates,
}: {
  travelerIds: string[];
  expenses: SplitExpense[];
  settlements: Settlement[];
  tripCurrency: string;
  rates: Map<string, number>;
}) {
  const people = new Map<string, PersonBalance>(
    travelerIds.map((id) => [id, { travelerId: id, paid: 0, owed: 0, settled: 0, balance: 0 }]),
  );
  /** Expenses left out, and why. */
  let withoutPayer = 0;
  const unconverted = new Set<string>();

  for (const e of expenses) {
    const payer = e.paid_by ? people.get(e.paid_by) : undefined;
    if (!payer) {
      withoutPayer += 1;
      continue;
    }
    const total = convert(toCents(Number(e.amount)), e.currency, tripCurrency, rates);
    if (total === null) {
      unconverted.add(e.currency);
      continue;
    }
    payer.paid += total;
    for (const [id, part] of expenseParts(e, total, travelerIds)) people.get(id)!.owed += part;
  }

  for (const s of settlements) {
    const amount = convert(toCents(Number(s.amount)), s.currency, tripCurrency, rates);
    const from = people.get(s.from_traveler);
    const to = people.get(s.to_traveler);
    if (amount === null) {
      unconverted.add(s.currency);
      continue;
    }
    if (!from || !to) continue;
    from.settled += amount;
    to.settled -= amount;
  }

  const balances = [...people.values()].map((p) => ({ ...p, balance: p.paid - p.owed + p.settled }));
  return { balances, transfers: settleUp(balances), withoutPayer, unconverted: [...unconverted].sort() };
}

/**
 * The payments that settle everyone, few of them: the one who owes the most
 * pays the one owed the most, as much as possible, and repeat. At most n − 1
 * payments for n people (the fewest possible is a harder problem, and this
 * is what apps like Splitwise do in practice).
 */
export function settleUp(balances: { travelerId: string; balance: number }[]): Transfer[] {
  const debtors = balances.filter((b) => b.balance < 0).map((b) => ({ id: b.travelerId, left: -b.balance }));
  const creditors = balances.filter((b) => b.balance > 0).map((b) => ({ id: b.travelerId, left: b.balance }));
  const byLeft = (a: { left: number }, b: { left: number }) => b.left - a.left;
  const transfers: Transfer[] = [];
  while (debtors.length > 0 && creditors.length > 0) {
    debtors.sort(byLeft);
    creditors.sort(byLeft);
    const d = debtors[0];
    const c = creditors[0];
    const amount = Math.min(d.left, c.left);
    transfers.push({ from: d.id, to: c.id, amount });
    d.left -= amount;
    c.left -= amount;
    if (d.left === 0) debtors.shift();
    if (c.left === 0) creditors.shift();
  }
  return transfers;
}
