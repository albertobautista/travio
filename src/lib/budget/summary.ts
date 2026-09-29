import { BUDGET_CATEGORIES, type BudgetCategory } from "./categories";
import { convert, toCents } from "./money";

/**
 * The trip's budget in its own currency: planned costs (estimated) and
 * expenses (spent), per category. Amounts in a currency without an exchange
 * rate aren't guessed: they're reported apart in `unconverted`.
 * Pure, so it's easy to test.
 */

export type MoneyItem = { category: BudgetCategory; amount: number; currency: string };

export type BudgetSummary = {
  currency: string;
  budget: number | null;
  estimated: number;
  spent: number;
  byCategory: { category: BudgetCategory; estimated: number; spent: number }[];
  /** Cents per currency that couldn't be converted (no rate yet). */
  unconverted: { currency: string; estimated: number; spent: number }[];
  /** Every foreign currency in use, for the exchange-rate list. */
  currencies: string[];
};

export function summarizeBudget({
  tripCurrency,
  budgetAmount,
  rates,
  planned,
  expenses,
}: {
  tripCurrency: string;
  budgetAmount: number | null;
  rates: Map<string, number>;
  planned: MoneyItem[];
  expenses: MoneyItem[];
}): BudgetSummary {
  const cats = new Map(BUDGET_CATEGORIES.map((c) => [c, { category: c, estimated: 0, spent: 0 }]));
  const missing = new Map<string, { currency: string; estimated: number; spent: number }>();
  const add = (item: MoneyItem, field: "estimated" | "spent") => {
    const cents = toCents(item.amount);
    const converted = convert(cents, item.currency, tripCurrency, rates);
    if (converted === null) {
      const m = missing.get(item.currency) ?? { currency: item.currency, estimated: 0, spent: 0 };
      m[field] += cents;
      missing.set(item.currency, m);
    } else {
      cats.get(item.category)![field] += converted;
    }
  };
  planned.forEach((i) => add(i, "estimated"));
  expenses.forEach((i) => add(i, "spent"));

  const byCategory = [...cats.values()];
  return {
    currency: tripCurrency,
    budget: budgetAmount === null ? null : toCents(budgetAmount),
    estimated: byCategory.reduce((a, c) => a + c.estimated, 0),
    spent: byCategory.reduce((a, c) => a + c.spent, 0),
    byCategory,
    unconverted: [...missing.values()],
    currencies: [...new Set([...planned, ...expenses].map((i) => i.currency))].filter((c) => c !== tripCurrency).sort(),
  };
}
