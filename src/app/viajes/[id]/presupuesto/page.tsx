import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { AlertTriangle, ChevronLeft, Plus } from "lucide-react";

import { BudgetAmountForm, ExpenseForm, RateForm } from "@/components/budget/budget-forms";
import { Button } from "@/components/ui/button";
import { getAccommodations } from "@/lib/accommodations/queries";
import { formatDayLabel } from "@/lib/activities/itinerary";
import { getActivities } from "@/lib/activities/queries";
import { BUDGET_META, isBudgetCategory, plannedCategory } from "@/lib/budget/categories";
import { suggestRates } from "@/lib/budget/ecb-rates";
import { convert, formatMoney, toCents } from "@/lib/budget/money";
import { getExchangeRates, getExpenses } from "@/lib/budget/queries";
import { summarizeBudget, type MoneyItem } from "@/lib/budget/summary";
import { getTransportations } from "@/lib/transportations/queries";
import { getTravelers } from "@/lib/travelers/queries";
import { canEdit, getMyTripRole, getStops, getTrip } from "@/lib/trips/queries";
import { resolveTripNow } from "@/lib/trips/today";

import { deleteExpense, saveExpense, setBudgetAmount, setExchangeRate } from "./actions";

export async function generateMetadata({ params }: PageProps<"/viajes/[id]/presupuesto">): Promise<Metadata> {
  const trip = await getTrip((await params).id);
  return { title: trip ? `Presupuesto · ${trip.name} · Travio` : "Presupuesto · Travio" };
}

/**
 * Budget vs planned costs (estimated) vs expenses (spent), in the trip's
 * currency, using the exchange rates the trip has confirmed.
 */
export default async function BudgetPage({ params }: PageProps<"/viajes/[id]/presupuesto">) {
  const { id } = await params;
  const [trip, role, stops, activities, stays, legs, expenses, rates, travelers] = await Promise.all([
    getTrip(id),
    getMyTripRole(id),
    getStops(id),
    getActivities(id),
    getAccommodations(id),
    getTransportations(id),
    getExpenses(id),
    getExchangeRates(id),
    getTravelers(id),
  ]);
  if (!trip) notFound();
  const editable = canEdit(role);
  const cur = trip.currency;
  const money = (cents: number) => formatMoney(cents, cur);

  // Planned costs already entered on stays, legs and activities.
  const planned: MoneyItem[] = [
    ...stays.flatMap((s) =>
      s.cost_amount !== null && s.cost_currency ? [{ category: plannedCategory({ kind: "stay" }), amount: Number(s.cost_amount), currency: s.cost_currency }] : [],
    ),
    ...legs.flatMap((l) =>
      l.cost_amount !== null && l.cost_currency
        ? [{ category: plannedCategory({ kind: "leg", type: l.type }), amount: Number(l.cost_amount), currency: l.cost_currency }]
        : [],
    ),
    ...activities.flatMap((a) =>
      a.cost_amount !== null && a.cost_currency
        ? [{ category: plannedCategory({ kind: "activity", category: a.category }), amount: Number(a.cost_amount), currency: a.cost_currency }]
        : [],
    ),
  ];
  const spentItems: MoneyItem[] = expenses.flatMap((e) =>
    isBudgetCategory(e.category) ? [{ category: e.category, amount: Number(e.amount), currency: e.currency }] : [],
  );

  const summary = summarizeBudget({
    tripCurrency: cur,
    budgetAmount: trip.budget_amount === null ? null : Number(trip.budget_amount),
    rates,
    planned,
    expenses: spentItems,
  });
  const suggestions = editable ? await suggestRates(summary.currencies, cur) : new Map();

  const budget = summary.budget;
  // Real percentage for labels; bars are capped at 100%.
  const pct = (cents: number) => (budget ? Math.round((cents / budget) * 100) : 0);
  const bar = (cents: number) => Math.min(100, pct(cents));
  const today = resolveTripNow(stops).today;
  const travelerName = new Map(travelers.map((t) => [t.id, t.name.split(" ")[0]]));
  const defaultCurrency = summary.currencies.find((c) => rates.has(c)) ?? cur;

  // Expenses by day, newest first.
  const byDay = new Map<string, typeof expenses>();
  for (const e of expenses) byDay.set(e.spent_on, [...(byDay.get(e.spent_on) ?? []), e]);

  return (
    <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col gap-5 px-4 py-6">
      <header className="flex items-start gap-2">
        <Button asChild variant="ghost" size="icon" className="-ml-2 size-11 shrink-0">
          <Link href={`/viajes/${trip.id}`} aria-label={`Volver a ${trip.name}`}>
            <ChevronLeft aria-hidden="true" />
          </Link>
        </Button>
        <div className="min-w-0 flex-1">
          <h1 className="text-2xl font-bold tracking-tight">Presupuesto</h1>
          <p className="text-sm text-muted-foreground">Todo en {cur}, con los tipos de cambio del viaje.</p>
        </div>
      </header>

      {/* Summary */}
      <section aria-labelledby="summary" className="flex flex-col gap-3 rounded-2xl border bg-card p-4">
        <h2 id="summary" className="sr-only">
          Resumen
        </h2>
        <div className="flex items-end justify-between gap-3">
          <div>
            <p className="text-sm text-muted-foreground">Gastado</p>
            <p className="font-mono text-3xl font-bold">{money(summary.spent)}</p>
          </div>
          {budget !== null && (
            <p className="text-right text-sm text-muted-foreground">
              de <span className="font-mono font-semibold text-foreground">{money(budget)}</span>
              <br />
              {budget - summary.spent >= 0 ? `quedan ${money(budget - summary.spent)}` : `te pasaste ${money(summary.spent - budget)}`}
            </p>
          )}
        </div>

        {budget !== null && (
          <div className="flex flex-col gap-1.5">
            {/* Spent (solid) over estimated (light), against the budget. */}
            <div
              className="relative h-3 overflow-hidden rounded-full bg-muted"
              role="img"
              aria-label={`Gastado ${pct(summary.spent)}% y estimado ${pct(summary.estimated)}% del presupuesto`}
            >
              <div className="absolute inset-y-0 left-0 bg-primary/25" style={{ width: `${bar(summary.estimated)}%` }} />
              <div
                className={"absolute inset-y-0 left-0 " + (summary.spent > budget ? "bg-destructive" : "bg-success")}
                style={{ width: `${bar(summary.spent)}%` }}
              />
            </div>
            <div className="flex justify-between text-xs text-muted-foreground">
              <span className="flex items-center gap-1.5">
                <span className="size-2 rounded-full bg-success" aria-hidden="true" />
                Gastado {pct(summary.spent)}%
              </span>
              <span className="flex items-center gap-1.5">
                <span className="size-2 rounded-full bg-primary/40" aria-hidden="true" />
                Estimado {money(summary.estimated)} ({pct(summary.estimated)}%)
              </span>
            </div>
          </div>
        )}

        {budget !== null && summary.estimated > budget && (
          <p className="flex items-start gap-2 rounded-lg bg-warning-soft p-2 text-sm text-warning-foreground">
            <AlertTriangle className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
            Lo planeado ({money(summary.estimated)}) ya supera el presupuesto.
          </p>
        )}

        {budget === null && (
          <p className="text-sm text-muted-foreground">
            Estimado de lo planeado: <span className="font-mono font-semibold text-foreground">{money(summary.estimated)}</span>
            {editable ? ". Define un presupuesto para compararlo." : "."}
          </p>
        )}

        {editable && (
          <details className="group">
            <summary className="cursor-pointer text-sm font-medium text-primary">{budget === null ? "Definir presupuesto" : "Cambiar presupuesto"}</summary>
            <div className="pt-3">
              <BudgetAmountForm
                action={setBudgetAmount.bind(null, trip.id)}
                currency={cur}
                initial={budget === null ? "" : String(budget / 100)}
              />
            </div>
          </details>
        )}
      </section>

      {summary.unconverted.length > 0 && (
        <p className="flex items-start gap-2 rounded-xl border border-warning-border bg-warning-soft p-3 text-sm text-warning-foreground">
          <AlertTriangle className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
          <span>
            Sin tipo de cambio, fuera de los totales:{" "}
            {summary.unconverted.map((u) => formatMoney(u.estimated + u.spent, u.currency)).join(" · ")}.{" "}
            <a href="#tipos-de-cambio" className="font-semibold underline">
              Agregar tipo de cambio
            </a>
          </span>
        </p>
      )}

      {/* By category */}
      <section aria-labelledby="by-category" className="flex flex-col gap-2">
        <h2 id="by-category" className="font-semibold">
          Por categoría
        </h2>
        <ul className="flex flex-col gap-2 rounded-2xl border bg-card p-3">
          {summary.byCategory.map((c) => {
            const Icon = BUDGET_META[c.category].icon;
            const top = Math.max(c.estimated, c.spent, 1);
            return (
              <li key={c.category} className="flex items-center gap-3 py-1">
                <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-secondary text-primary">
                  <Icon className="size-4" aria-hidden="true" />
                </span>
                <div className="flex min-w-0 flex-1 flex-col gap-1">
                  <div className="flex items-baseline justify-between gap-2 text-sm">
                    <span className="font-medium">{BUDGET_META[c.category].label}</span>
                    <span className="font-mono text-xs text-muted-foreground">
                      <span className="text-foreground">{money(c.spent)}</span> / {money(c.estimated)}
                    </span>
                  </div>
                  <div className="relative h-1.5 overflow-hidden rounded-full bg-muted" aria-hidden="true">
                    <div className="absolute inset-y-0 left-0 bg-primary/25" style={{ width: `${(c.estimated / top) * 100}%` }} />
                    <div className="absolute inset-y-0 left-0 bg-success" style={{ width: `${(c.spent / top) * 100}%` }} />
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
        <p className="text-xs text-muted-foreground">Gastado / estimado. El estimado sale de los costos de hospedajes, trayectos y actividades.</p>
      </section>

      {/* Expenses */}
      <section aria-labelledby="expenses" className="flex flex-col gap-3">
        <h2 id="expenses" className="font-semibold">
          Gastos ({expenses.length})
        </h2>
        {editable && (
          <details className="rounded-2xl border bg-card p-4" open={expenses.length === 0}>
            <summary className="flex cursor-pointer items-center gap-2 font-medium text-primary">
              <Plus className="size-4" aria-hidden="true" />
              Agregar gasto
            </summary>
            <div className="pt-4">
              <ExpenseForm
                action={saveExpense.bind(null, trip.id, null)}
                travelers={travelers}
                submitLabel="Guardar gasto"
                initial={{
                  description: "",
                  amount: "",
                  currency: defaultCurrency,
                  category: "food",
                  spent_on: today,
                  paid_by: travelers.find((t) => t.user_id)?.id ?? "",
                  notes: "",
                }}
              />
            </div>
          </details>
        )}
        {expenses.length === 0 ? (
          <p className="rounded-2xl border border-dashed bg-card p-4 text-center text-sm text-muted-foreground">
            Aún no hay gastos. {editable ? "Anota lo que gastas para compararlo con lo planeado." : ""}
          </p>
        ) : (
          [...byDay].map(([date, items]) => (
            <div key={date} className="flex flex-col gap-1.5">
              <h3 className="text-sm font-medium text-muted-foreground first-letter:uppercase">{formatDayLabel(date)}</h3>
              <ul className="flex flex-col gap-1.5">
                {items.map((e) => {
                  const cat = isBudgetCategory(e.category) ? e.category : "other";
                  const Icon = BUDGET_META[cat].icon;
                  const cents = toCents(Number(e.amount));
                  const inTrip = convert(cents, e.currency, cur, rates);
                  const row = (
                    <>
                      <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-secondary text-primary">
                        <Icon className="size-4" aria-hidden="true" />
                      </span>
                      <span className="flex min-w-0 flex-1 flex-col">
                        <span className="truncate text-sm font-medium">{e.description}</span>
                        <span className="truncate text-xs text-muted-foreground">
                          {BUDGET_META[cat].label}
                          {e.paid_by && travelerName.get(e.paid_by) ? ` · pagó ${travelerName.get(e.paid_by)}` : ""}
                        </span>
                      </span>
                      <span className="flex shrink-0 flex-col items-end">
                        <span className="font-mono text-sm font-semibold">{formatMoney(cents, e.currency)}</span>
                        {e.currency !== cur && (
                          <span className="font-mono text-xs text-muted-foreground">{inTrip === null ? "sin tipo de cambio" : `≈ ${money(inTrip)}`}</span>
                        )}
                      </span>
                    </>
                  );
                  return (
                    <li key={e.id}>
                      {editable ? (
                        <details className="rounded-xl border bg-card">
                          <summary className="flex min-h-14 cursor-pointer list-none items-center gap-3 px-3 py-2">{row}</summary>
                          <div className="border-t p-3">
                            <ExpenseForm
                              action={saveExpense.bind(null, trip.id, e.id)}
                              onDelete={deleteExpense.bind(null, trip.id, e.id)}
                              travelers={travelers}
                              submitLabel="Guardar cambios"
                              initial={{
                                description: e.description,
                                amount: String(e.amount),
                                currency: e.currency,
                                category: cat,
                                spent_on: e.spent_on,
                                paid_by: e.paid_by ?? "",
                                notes: e.notes ?? "",
                              }}
                            />
                          </div>
                        </details>
                      ) : (
                        <div className="flex min-h-14 items-center gap-3 rounded-xl border bg-card px-3 py-2">{row}</div>
                      )}
                    </li>
                  );
                })}
              </ul>
            </div>
          ))
        )}
      </section>

      {/* Exchange rates */}
      {summary.currencies.length > 0 && (
        <section id="tipos-de-cambio" aria-labelledby="rates" className="flex scroll-mt-4 flex-col gap-2">
          <h2 id="rates" className="font-semibold">
            Tipos de cambio
          </h2>
          <p className="text-xs text-muted-foreground">
            Los fija el viaje, así los totales no cambian solos. La sugerencia es la referencia del Banco Central Europeo.
          </p>
          {editable ? (
            summary.currencies.map((c) => (
              <RateForm
                key={c}
                action={setExchangeRate.bind(null, trip.id, c)}
                currency={c}
                tripCurrency={cur}
                current={rates.get(c) ?? null}
                suggestion={suggestions.get(c) ?? null}
              />
            ))
          ) : (
            <ul className="flex flex-col gap-1 rounded-xl border bg-card p-3 font-mono text-sm">
              {summary.currencies.map((c) => (
                <li key={c}>
                  1 {c} = {rates.has(c) ? `${rates.get(c)} ${cur}` : "sin definir"}
                </li>
              ))}
            </ul>
          )}
        </section>
      )}
    </main>
  );
}
