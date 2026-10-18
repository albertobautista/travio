import { BedDouble, MoreHorizontal, Plane, Ticket, TrainFront, Utensils, type LucideIcon } from "lucide-react";

/** Mirrors the check constraint on expenses.category (the six in CLAUDE.md). */
export const BUDGET_CATEGORIES = ["flights", "accommodation", "transportation", "activities", "food", "other"] as const;
export type BudgetCategory = (typeof BUDGET_CATEGORIES)[number];

/** `dot` and `stroke` are the category's chart color (theme tokens, so dark mode follows). */
export const BUDGET_META: Record<BudgetCategory, { label: string; icon: LucideIcon; dot: string; stroke: string }> = {
  flights: { label: "Vuelos", icon: Plane, dot: "bg-chart-1", stroke: "stroke-chart-1" },
  accommodation: { label: "Hospedaje", icon: BedDouble, dot: "bg-chart-2", stroke: "stroke-chart-2" },
  transportation: { label: "Transporte", icon: TrainFront, dot: "bg-chart-4", stroke: "stroke-chart-4" },
  activities: { label: "Actividades", icon: Ticket, dot: "bg-chart-3", stroke: "stroke-chart-3" },
  food: { label: "Comida", icon: Utensils, dot: "bg-chart-6", stroke: "stroke-chart-6" },
  other: { label: "Otros", icon: MoreHorizontal, dot: "bg-chart-5", stroke: "stroke-chart-5" },
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
