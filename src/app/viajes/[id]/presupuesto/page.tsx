import type { Metadata } from "next";
import { cookies } from "next/headers";
import Link from "next/link";
import { notFound } from "next/navigation";
import { AlertTriangle, CalendarDays, Users } from "lucide-react";

import { Balances } from "@/components/budget/balances";
import { BudgetAmountForm, ExpenseForm, RateForm } from "@/components/budget/budget-forms";
import { CategoryDonut } from "@/components/budget/category-donut";
import { ExpenseSheet } from "@/components/budget/expense-sheet";
import { getAccommodations } from "@/lib/accommodations/queries";
import { formatDayLabel } from "@/lib/activities/itinerary";
import { getActivities } from "@/lib/activities/queries";
import { BUDGET_META, isBudgetCategory } from "@/lib/budget/categories";
import { suggestRates } from "@/lib/budget/ecb-rates";
import { convert, formatMoney, toCents } from "@/lib/budget/money";
import { HOME_CURRENCY_COOKIE, parseHomeCurrency, toHomeCurrency } from "@/lib/budget/home-currency";
import { budgetPace } from "@/lib/budget/pace";
import { getExchangeRates, getExpenses, getSettlements } from "@/lib/budget/queries";
import { plannedItems, spentItems } from "@/lib/budget/planned";
import { computeBalances, isSplitMode } from "@/lib/budget/split";
import { summarizeBudget } from "@/lib/budget/summary";
import { getTransportations } from "@/lib/transportations/queries";
import { getTravelers } from "@/lib/travelers/queries";
import { canEdit, getMyTripRole, getStops, getTrip } from "@/lib/trips/queries";
import { resolveTripNow } from "@/lib/trips/today";

import { deleteExpense, saveExpense, setBudgetAmount, setExchangeRate } from "./actions";

export async function generateMetadata({ params }: PageProps<"/viajes/[id]/presupuesto">): Promise<Metadata> {
  const trip = await getTrip((await params).id);
  return { title: trip ? `Presupuesto · ${trip.name} · Travio` : "Presupuesto · Travio" };
}

const TABS = { resumen: "Resumen", gastos: "Gastos", cuentas: "Cuentas" } as const;
type Tab = keyof typeof TABS;

/**
 * Budget vs planned costs (estimated) vs expenses (spent), in the trip's
 * currency, using the exchange rates the trip has confirmed. Split in tabs
 * (?vista=), like Alberto's design: Resumen, Gastos and, when there's a
 * group to split with, Cuentas.
 */
export default async function BudgetPage({ params, searchParams }: PageProps<"/viajes/[id]/presupuesto">) {
  const { id } = await params;
  const { vista } = await searchParams;
  const [trip, role, stops, activities, stays, legs, expenses, rates, travelers, settlements] = await Promise.all([
    getTrip(id),
    getMyTripRole(id),
    getStops(id),
    getActivities(id),
    getAccommodations(id),
    getTransportations(id),
    getExpenses(id),
    getExchangeRates(id),
    getTravelers(id),
    getSettlements(id),
  ]);
  if (!trip) notFound();
  const editable = canEdit(role);
  const cur = trip.currency;
  const money = (cents: number) => formatMoney(cents, cur);

  const summary = summarizeBudget({
    tripCurrency: cur,
    budgetAmount: trip.budget_amount === null ? null : Number(trip.budget_amount),
    rates,
    planned: plannedItems({ stays, legs, activities }),
    expenses: spentItems(expenses),
  });
  // "Tu moneda" (a setting of the person): totals also shown in it when the
  // trip is in another one, at the trip's rate or, until there is one, the ECB's.
  const homeSetting = parseHomeCurrency((await cookies()).get(HOME_CURRENCY_COOKIE)?.value);
  const home = homeSetting !== cur ? homeSetting : null;
  const rateCurrencies = home && !summary.currencies.includes(home) ? [...summary.currencies, home].sort() : summary.currencies;
  const suggestions = await suggestRates(editable ? rateCurrencies : home ? [home] : [], cur);
  const homeRate = home ? (rates.get(home) ?? suggestions.get(home)?.rate ?? null) : null;
  // Whole units: it's an approximation.
  const inHome = (cents: number) =>
    home && homeRate ? `${formatMoney(Math.round(toHomeCurrency(cents, homeRate) / 100) * 100, home)} ${home}` : null;
  const alsoIn = (cents: number) => (inHome(cents) ? `≈ ${inHome(cents)}` : null);

  const budget = summary.budget;
  // Real percentage for labels; bars are capped at 100%.
  const pct = (cents: number) => (budget ? Math.round((cents / budget) * 100) : 0);
  const bar = (cents: number) => Math.min(100, pct(cents));
  const today = resolveTripNow(stops).today;
  const travelerName = new Map(travelers.map((t) => [t.id, t.name.split(" ")[0]]));
  const defaultCurrency = summary.currencies.find((c) => rates.has(c)) ?? cur;
  const perPerson = travelers.length > 1 ? Math.round(summary.spent / travelers.length / 100) * 100 : summary.spent;
  const beforeTrip = trip.start_date !== null && today < trip.start_date;
  const pace = budgetPace({ budget, spent: summary.spent, startDate: trip.start_date, endDate: trip.end_date, today });

  const tabs: Tab[] = travelers.length > 1 ? ["resumen", "gastos", "cuentas"] : ["resumen", "gastos"];
  const tab: Tab = tabs.find((t) => t === vista) ?? "resumen";
  const tabHref = (t: Tab) => `/viajes/${trip.id}/presupuesto${t === "resumen" ? "" : `?vista=${t}`}`;

  // Who owes whom (only when there's a group to split with).
  const split =
    travelers.length > 1 && (expenses.length > 0 || settlements.length > 0)
      ? computeBalances({ travelerIds: travelers.map((t) => t.id), expenses, settlements, tripCurrency: cur, rates })
      : null;
  const allIds = travelers.map((t) => t.id);
  const splitLabel = (e: (typeof expenses)[number]) => {
    if (travelers.length < 2) return "";
    const n = e.expense_shares.length || travelers.length;
    if (e.split_mode === "amount") return ` · montos entre ${n}`;
    if (e.split_mode === "percent") return ` · % entre ${n}`;
    return e.expense_shares.length === 0 ? " · entre todos" : n === 1 ? ` · solo ${travelerName.get(e.expense_shares[0].traveler_id) ?? ""}` : ` · entre ${n}`;
  };

  // Expenses by day, newest first.
  const byDay = new Map<string, typeof expenses>();
  for (const e of expenses) byDay.set(e.spent_on, [...(byDay.get(e.spent_on) ?? []), e]);

  return (
    <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col gap-5 px-4 pt-6 pb-24 lg:pb-6">
      <header className="flex items-start gap-2">
        <div className="min-w-0 flex-1">
          <h1 className="text-2xl font-bold tracking-tight">Presupuesto</h1>
          <p className="text-sm text-muted-foreground">
            Todo en {cur}, con los tipos de cambio del viaje.
            {home && homeRate && ` También en ${home}${rates.has(home) ? "" : ", al tipo del BCE"}.`}
          </p>
        </div>
        {editable && (
          <ExpenseSheet
            action={saveExpense.bind(null, trip.id, null)}
            travelers={travelers}
            initial={{
              description: "",
              amount: "",
              currency: defaultCurrency,
              category: "food",
              spent_on: today,
              paid_by: travelers.find((t) => t.user_id)?.id ?? "",
              notes: "",
              split_mode: "equal",
              split_ids: allIds,
              shares: {},
            }}
          />
        )}
      </header>

      <nav aria-label="Secciones del presupuesto" className="grid border-b" style={{ gridTemplateColumns: `repeat(${tabs.length}, minmax(0, 1fr))` }}>
        {tabs.map((t) => (
          <Link
            key={t}
            href={tabHref(t)}
            aria-current={t === tab ? "page" : undefined}
            className={
              "-mb-px flex min-h-11 items-center justify-center border-b-2 text-sm font-medium transition-colors " +
              (t === tab ? "border-primary text-primary-text" : "border-transparent text-muted-foreground hover:text-foreground")
            }
          >
            {TABS[t]}
            {t === "gastos" && expenses.length > 0 && <span className="ml-1.5 font-mono text-xs text-muted-foreground">{expenses.length}</span>}
          </Link>
        ))}
      </nav>

      {tab === "resumen" && (
        <>
          {/* Summary */}
          <section aria-labelledby="summary" className="flex flex-col gap-3 rounded-2xl border bg-card p-4">
            <h2 id="summary" className="sr-only">
              Resumen
            </h2>
            <div className="flex items-end justify-between gap-3">
              <div>
                <p className="text-sm text-muted-foreground">Gastado</p>
                <p className="font-mono text-3xl font-bold">{money(summary.spent)}</p>
                {alsoIn(summary.spent) && <p className="font-mono text-sm text-muted-foreground">{alsoIn(summary.spent)}</p>}
              </div>
              {budget !== null && (
                <p className="text-right text-sm text-muted-foreground">
                  de <span className="font-mono font-semibold text-foreground">{money(budget)}</span>
                  {alsoIn(budget) && (
                    <>
                      <br />
                      <span className="font-mono text-xs">{alsoIn(budget)}</span>
                    </>
                  )}
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

            {(pace || (travelers.length > 1 && summary.spent > 0)) && (
              <ul className="flex flex-wrap gap-2 text-sm">
                {pace && (
                  <li className="flex items-center gap-2 rounded-xl bg-secondary px-3 py-2 text-secondary-foreground">
                    <CalendarDays className="size-4 shrink-0 text-primary-text" aria-hidden="true" />
                    <span>
                      {pace.kind === "left-per-day" ? "≈ " : "Promedio "}
                      <span className="font-mono font-semibold">{money(pace.perDay)}</span>
                        {home && homeRate && <span className="font-mono"> ({inHome(pace.perDay)})</span>} por día
                      {pace.kind === "left-per-day" &&
                        (beforeTrip
                          ? ` en los ${pace.days} días del viaje`
                          : pace.days === 1
                            ? " hoy, último día"
                            : ` en los ${pace.days} días que quedan`)}
                    </span>
                  </li>
                )}
                {travelers.length > 1 && summary.spent > 0 && (
                  <li className="flex items-center gap-2 rounded-xl bg-secondary px-3 py-2 text-secondary-foreground">
                    <Users className="size-4 shrink-0 text-primary-text" aria-hidden="true" />
                    <span>
                      <span className="font-mono font-semibold">{money(perPerson)}</span>
                        {home && homeRate && <span className="font-mono"> ({inHome(perPerson)})</span>} por persona
                    </span>
                  </li>
                )}
              </ul>
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

          <section aria-labelledby="by-category" className="flex flex-col gap-2">
            <h2 id="by-category" className="font-semibold">
              Por categoría
            </h2>
            <div className="rounded-2xl border bg-card p-4">
              <CategoryDonut rows={summary.byCategory} currency={cur} home={home && homeRate ? { currency: home, rate: homeRate } : null} />
            </div>
            <p className="text-xs text-muted-foreground">El estimado sale de los costos de hospedajes, trayectos y actividades.</p>
          </section>

          {/* Exchange rates */}
          {rateCurrencies.length > 0 && (
            <section id="tipos-de-cambio" aria-labelledby="rates" className="flex scroll-mt-4 flex-col gap-2">
              <h2 id="rates" className="font-semibold">
                Tipos de cambio
              </h2>
              <p className="text-xs text-muted-foreground">
                Los fija el viaje, así los totales no cambian solos. La sugerencia es la referencia del Banco Central Europeo.
              </p>
              {editable ? (
                rateCurrencies.map((c) => (
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
                  {rateCurrencies.map((c) => (
                    <li key={c}>
                      1 {c} = {rates.has(c) ? `${rates.get(c)} ${cur}` : "sin definir"}
                    </li>
                  ))}
                </ul>
              )}
            </section>
          )}
        </>
      )}

      {tab === "gastos" && (
        <section aria-label="Gastos" className="flex flex-col gap-3">
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
                            {splitLabel(e)}
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
                                  split_mode: isSplitMode(e.split_mode) ? e.split_mode : "equal",
                                  split_ids: e.expense_shares.length > 0 ? e.expense_shares.map((x) => x.traveler_id) : allIds,
                                  shares: Object.fromEntries(
                                    e.expense_shares.filter((x) => x.share !== null).map((x) => [x.traveler_id, String(x.share)]),
                                  ),
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
      )}

      {tab === "cuentas" &&
        (split ? (
          <Balances
            tripId={trip.id}
            currency={cur}
            travelers={travelers}
            balances={split.balances}
            transfers={split.transfers}
            settlements={settlements}
            withoutPayer={split.withoutPayer}
            unconverted={split.unconverted}
            editable={editable}
          />
        ) : (
          <p className="rounded-2xl border border-dashed bg-card p-4 text-center text-sm text-muted-foreground">
            Cuando anoten gastos con quién pagó, aquí verán quién le debe a quién.
          </p>
        ))}
    </main>
  );
}
