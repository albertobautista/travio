import { isBudgetCategory, plannedCategory } from "./categories";
import type { MoneyItem } from "./summary";

type Cost = { cost_amount: number | null; cost_currency: string | null };

/** Costs already entered on stays, legs and activities, as budget items. */
export function plannedItems({
  stays,
  legs,
  activities,
}: {
  stays: Cost[];
  legs: (Cost & { type: string })[];
  activities: (Cost & { category: string })[];
}): MoneyItem[] {
  const item = (c: Cost, category: MoneyItem["category"]): MoneyItem[] =>
    c.cost_amount !== null && c.cost_currency ? [{ category, amount: Number(c.cost_amount), currency: c.cost_currency }] : [];
  return [
    ...stays.flatMap((s) => item(s, plannedCategory({ kind: "stay" }))),
    ...legs.flatMap((l) => item(l, plannedCategory({ kind: "leg", type: l.type }))),
    ...activities.flatMap((a) => item(a, plannedCategory({ kind: "activity", category: a.category }))),
  ];
}

/** Expenses as budget items (unknown categories are skipped). */
export function spentItems(expenses: { category: string; amount: number; currency: string }[]): MoneyItem[] {
  return expenses.flatMap((e) => (isBudgetCategory(e.category) ? [{ category: e.category, amount: Number(e.amount), currency: e.currency }] : []));
}
