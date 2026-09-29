import { BedDouble, MoreHorizontal, Plane, Ticket, TrainFront, Utensils, type LucideIcon } from "lucide-react";

/** Mirrors the check constraint on expenses.category (the six in CLAUDE.md). */
export const BUDGET_CATEGORIES = ["flights", "accommodation", "transportation", "activities", "food", "other"] as const;
export type BudgetCategory = (typeof BUDGET_CATEGORIES)[number];

export const BUDGET_META: Record<BudgetCategory, { label: string; icon: LucideIcon }> = {
  flights: { label: "Vuelos", icon: Plane },
  accommodation: { label: "Hospedaje", icon: BedDouble },
  transportation: { label: "Transporte", icon: TrainFront },
  activities: { label: "Actividades", icon: Ticket },
  food: { label: "Comida", icon: Utensils },
  other: { label: "Otros", icon: MoreHorizontal },
};

export function isBudgetCategory(value: string): value is BudgetCategory {
  return (BUDGET_CATEGORIES as readonly string[]).includes(value);
}

/** Where a planned cost lands: stays, legs (flights apart) and activities by their category. */
export function plannedCategory(item: { kind: "stay" } | { kind: "leg"; type: string } | { kind: "activity"; category: string }): BudgetCategory {
  if (item.kind === "stay") return "accommodation";
  if (item.kind === "leg") return item.type === "flight" ? "flights" : "transportation";
  if (item.category === "food") return "food";
  if (item.category === "transfer") return "transportation";
  return "activities";
}
