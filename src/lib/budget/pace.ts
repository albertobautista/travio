import { getTripLengthDays, getTripStatus } from "@/lib/trips/dates";

/**
 * "How much can we spend per day?" for the budget's summary card, in cents
 * of the trip currency. Pure, so it's easy to test.
 *
 * - During the trip, with a budget: what's left, spread over the days left
 *   (today included).
 * - Before the trip, with a budget: what's left, spread over the whole trip.
 * - During the trip, without a budget: the average spent per day so far.
 * Null when there's nothing useful to say (no dates, trip over, overspent).
 * Rounded to whole units (still in cents): it's a guide, not an account.
 */
export type BudgetPace =
  | { kind: "left-per-day"; perDay: number; days: number }
  | { kind: "spent-per-day"; perDay: number; days: number };

export function budgetPace({
  budget,
  spent,
  startDate,
  endDate,
  today,
}: {
  budget: number | null;
  spent: number;
  startDate: string | null;
  endDate: string | null;
  today: string;
}): BudgetPace | null {
  const status = getTripStatus(startDate, endDate, today);
  if (status !== "active" && status !== "upcoming") return null;
  const end = endDate ?? startDate!;

  if (budget !== null) {
    const left = budget - spent;
    if (left <= 0) return null;
    const days = getTripLengthDays(status === "active" ? today : startDate, end)!;
    return { kind: "left-per-day", perDay: Math.floor(left / days / 100) * 100, days };
  }

  if (status === "active" && spent > 0) {
    const days = getTripLengthDays(startDate, today)!;
    return { kind: "spent-per-day", perDay: Math.round(spent / days / 100) * 100, days };
  }
  return null;
}
