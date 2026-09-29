"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { Check, Trash2 } from "lucide-react";

import { selectClass } from "@/components/form-field";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { BUDGET_CATEGORIES, BUDGET_META } from "@/lib/budget/categories";
import { CURRENCIES } from "@/lib/trips/currencies";

type Action<S> = (prev: S, formData: FormData) => Promise<S>;
type State = { error?: string; ok?: boolean } | undefined;

function FormError({ state }: { state: State }) {
  return state?.error ? (
    <p role="alert" className="text-sm text-destructive">
      {state.error}
    </p>
  ) : null;
}

/** Total budget for the trip, in its currency. */
export function BudgetAmountForm({ action, currency, initial }: { action: Action<State>; currency: string; initial: string }) {
  const [state, formAction, pending] = useActionState(action, undefined);
  return (
    <form action={formAction} className="flex flex-col gap-2">
      <Label htmlFor="budget_amount">Presupuesto total ({currency})</Label>
      <div className="flex gap-2">
        <Input id="budget_amount" name="budget_amount" inputMode="decimal" placeholder="95000" defaultValue={initial} className="h-11" />
        <Button type="submit" className="h-11" disabled={pending}>
          {pending ? "Guardando…" : "Guardar"}
        </Button>
      </div>
      <FormError state={state} />
    </form>
  );
}

/** "1 EUR = [21.30] MXN", with the ECB's rate one tap away. */
export function RateForm({
  action,
  currency,
  tripCurrency,
  current,
  suggestion,
}: {
  action: Action<State>;
  currency: string;
  tripCurrency: string;
  current: number | null;
  suggestion: { rate: number; date: string } | null;
}) {
  const [state, formAction, pending] = useActionState(action, undefined);
  const input = useRef<HTMLInputElement>(null);
  const suggested = suggestion ? String(Number(suggestion.rate.toFixed(4))) : null;
  return (
    <form action={formAction} className="flex flex-col gap-2 rounded-xl border p-3">
      <div className="flex items-center gap-2">
        <label htmlFor={`rate-${currency}`} className="shrink-0 font-mono text-sm font-semibold">
          1 {currency} =
        </label>
        <Input
          ref={input}
          id={`rate-${currency}`}
          name="rate"
          inputMode="decimal"
          placeholder={suggested ?? "0.00"}
          defaultValue={current === null ? "" : String(current)}
          className="h-11 font-mono"
        />
        <span className="shrink-0 font-mono text-sm">{tripCurrency}</span>
        <Button type="submit" size="icon" className="size-11 shrink-0" disabled={pending} aria-label={`Guardar tipo de cambio de ${currency}`}>
          <Check aria-hidden="true" />
        </Button>
      </div>
      {suggestion && (
        <button
          type="button"
          onClick={() => {
            if (input.current) input.current.value = suggested!;
            input.current?.form?.requestSubmit();
          }}
          className="self-start text-xs text-primary hover:underline"
        >
          Usar {suggested} (BCE, {suggestion.date})
        </button>
      )}
      <FormError state={state} />
    </form>
  );
}

type Traveler = { id: string; name: string };

export type ExpenseValues = {
  description: string;
  amount: string;
  currency: string;
  category: string;
  spent_on: string;
  paid_by: string;
  notes: string;
};

/** Add or edit an expense. Resets itself after adding one. */
export function ExpenseForm({
  action,
  onDelete,
  initial,
  travelers,
  submitLabel,
}: {
  action: Action<State>;
  onDelete?: () => Promise<State>;
  initial: ExpenseValues;
  travelers: Traveler[];
  submitLabel: string;
}) {
  const [state, formAction, pending] = useActionState(action, undefined);
  const [deleting, setDeleting] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const form = useRef<HTMLFormElement>(null);

  // After adding, clear the text fields for the next one (keep date/currency/payer).
  useEffect(() => {
    if (state?.ok && !onDelete && form.current) {
      (form.current.elements.namedItem("description") as HTMLInputElement).value = "";
      (form.current.elements.namedItem("amount") as HTMLInputElement).value = "";
      (form.current.elements.namedItem("notes") as HTMLInputElement).value = "";
    }
  }, [state, onDelete]);

  return (
    <form ref={form} action={formAction} className="flex flex-col gap-3">
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="description">¿En qué?</Label>
        <Input id="description" name="description" maxLength={160} placeholder="Tapas en El Xampanyet" defaultValue={initial.description} className="h-11" />
      </div>
      <div className="grid grid-cols-[1fr_auto] gap-2">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="amount">Monto</Label>
          <Input id="amount" name="amount" inputMode="decimal" placeholder="42.50" defaultValue={initial.amount} className="h-11 font-mono" />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="currency">Moneda</Label>
          <select id="currency" name="currency" defaultValue={initial.currency} className={selectClass}>
            {CURRENCIES.map((c) => (
              <option key={c.code} value={c.code}>
                {c.code}
              </option>
            ))}
          </select>
        </div>
      </div>
      <div className="grid grid-cols-2 gap-2">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="category">Categoría</Label>
          <select id="category" name="category" defaultValue={initial.category} className={selectClass}>
            {BUDGET_CATEGORIES.map((c) => (
              <option key={c} value={c}>
                {BUDGET_META[c].label}
              </option>
            ))}
          </select>
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="spent_on">Fecha</Label>
          <Input id="spent_on" name="spent_on" type="date" defaultValue={initial.spent_on} className="h-11" />
        </div>
      </div>
      {travelers.length > 0 && (
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="paid_by">¿Quién pagó?</Label>
          <select id="paid_by" name="paid_by" defaultValue={initial.paid_by} className={selectClass}>
            <option value="">Sin especificar</option>
            {travelers.map((t) => (
              <option key={t.id} value={t.id}>
                {t.name}
              </option>
            ))}
          </select>
        </div>
      )}
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="notes">Notas</Label>
        <Input id="notes" name="notes" maxLength={1000} defaultValue={initial.notes} className="h-11" />
      </div>
      <FormError state={state} />
      {deleteError && <p role="alert" className="text-sm text-destructive">{deleteError}</p>}
      <div className="flex items-center gap-2">
        {onDelete &&
          (confirming ? (
            <span className="flex items-center gap-1">
              <span className="text-sm">¿Borrar?</span>
              <Button
                type="button"
                size="sm"
                className="bg-destructive text-white hover:bg-destructive/90"
                disabled={deleting}
                onClick={async () => {
                  setDeleting(true);
                  const r = await onDelete();
                  setDeleting(false);
                  if (r?.error) setDeleteError(r.error);
                }}
              >
                {deleting ? "Borrando…" : "Sí, borrar"}
              </Button>
              <Button type="button" size="sm" variant="ghost" onClick={() => setConfirming(false)} disabled={deleting}>
                No
              </Button>
            </span>
          ) : (
            <Button type="button" variant="ghost" className="text-destructive hover:text-destructive" onClick={() => setConfirming(true)}>
              <Trash2 aria-hidden="true" />
              Borrar
            </Button>
          ))}
        <Button type="submit" className="ml-auto h-11" disabled={pending}>
          {pending ? "Guardando…" : submitLabel}
        </Button>
      </div>
      {state?.ok && !onDelete && (
        <p role="status" className="text-sm text-success-foreground">
          Gasto guardado.
        </p>
      )}
    </form>
  );
}
